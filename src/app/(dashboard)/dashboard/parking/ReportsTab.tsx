'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Chip, LinearProgress, Paper } from '@mui/material';
import { SquareParking, CarFront, Home, IndianRupee } from 'lucide-react';
import api from '@/lib/api';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import StatCard from '@/components/common/StatCard';
import SectionHeading from '@/components/common/SectionHeading';
import ErrorState from '@/components/common/ErrorState';
import PageSkeleton from '@/components/common/PageSkeleton';
import EmptyState from '@/components/common/EmptyState';
import {
  Allocation, FlatOption, OccupancyReport, ReconciliationReport, ZONE_KIND_LABEL,
  apiMessage, flatLabelOf,
} from './parking-types';

/**
 * The three numbers a committee opens this module for.
 *
 * How full the place is; who has not been given anything; and — the one that
 * finds real money — every flat where the bill and the map disagree. That last
 * report reads `Flat.quantities` exactly as the invoice generator does, so a
 * row here is a rupee difference on the next bill and not a modelling
 * curiosity. It reports and does not fix, because a silent correction to
 * somebody's bill is a correction nobody can explain afterwards.
 */

type MismatchRow = ReconciliationReport['mismatches'][number];
type ZoneRow = OccupancyReport['byZone'][number];

export default function ReportsTab({ reloadKey }: { reloadKey: number }) {
  const [occupancy, setOccupancy] = useState<OccupancyReport | null>(null);
  const [recon, setRecon] = useState<ReconciliationReport | null>(null);
  const [without, setWithout] = useState<FlatOption[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, r] = await Promise.all([
        api.get('/parking/reports/occupancy'),
        api.get('/parking/reports/reconciliation'),
      ]);
      setOccupancy(o.data?.data || null);
      setRecon(r.data?.data || null);
      setError(null);

      // Which flats specifically, not just how many. The occupancy report gives
      // the count; a committee deciding who gets the next free bay needs names.
      // Best-effort: a reader who cannot list flats still gets the count above.
      try {
        const [flatsRes, allocRes] = await Promise.all([
          api.get('/societies/flats'),
          api.get('/parking/allocations?status=ACTIVE'),
        ]);
        const held = new Set<string>((allocRes.data?.data || []).map((a: Allocation) => String(a.flatId)));
        const flats: FlatOption[] = flatsRes.data?.flats || [];
        setWithout(flats.filter(f => !held.has(String(f._id))));
      } catch { setWithout(null); }
    } catch (e: any) {
      setError(apiMessage(e, 'Could not build the parking reports'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, reloadKey, tick]);

  if (loading) return <PageSkeleton label="Working out the numbers…" />;
  if (error) {
    return (
      <ErrorState
        title="The reports could not be built"
        message={error}
        onRetry={() => setTick(t => t + 1)}
      />
    );
  }

  const t = occupancy?.totals;
  const overall = t && t.slots ? Math.round((t.allotted / t.slots) * 1000) / 10 : 0;

  const zoneColumns: ColumnDef<ZoneRow>[] = [
    {
      id: 'name', label: 'Area', alwaysVisible: true,
      sortValue: z => z.name, exportValue: z => z.name,
      render: z => (
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800">{z.name}</p>
          <p className="text-[11px] text-slate-400">{ZONE_KIND_LABEL[z.kind] || ''}</p>
        </div>
      ),
    },
    {
      id: 'full', label: 'How full', alwaysVisible: true,
      sortValue: z => z.occupancy ?? -1, exportValue: z => (z.occupancy === null ? 'nothing usable' : `${z.occupancy}%`),
      render: z => z.occupancy === null
        ? <span className="text-xs text-slate-400">Nothing usable here</span>
        : (
          <div className="min-w-[130px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-black text-slate-800 tabular-nums">{z.occupancy}%</span>
              <span className="text-[10px] text-slate-400">{z.allotted} of {z.total - z.outOfUse}</span>
            </div>
            <LinearProgress variant="determinate" value={Math.min(100, z.occupancy)}
              sx={{ mt: 0.5, height: 6, borderRadius: 3, bgcolor: '#e2e8f0' }} />
          </div>
        ),
    },
    {
      id: 'free', label: 'Free',
      sortValue: z => z.available, exportValue: z => z.available,
      render: z => <span className="text-sm font-semibold text-emerald-700 tabular-nums">{z.available}</span>,
    },
    {
      id: 'kept', label: 'Kept aside',
      sortValue: z => z.reserved, exportValue: z => z.reserved,
      render: z => <span className="text-sm text-slate-600 tabular-nums">{z.reserved}</span>,
    },
    {
      id: 'out', label: 'Out of use',
      sortValue: z => z.outOfUse, exportValue: z => z.outOfUse,
      render: z => z.outOfUse
        ? <span className="text-sm text-rose-700 tabular-nums">{z.outOfUse}</span>
        : <span className="text-slate-300">—</span>,
    },
    {
      id: 'total', label: 'Bays in all',
      sortValue: z => z.total, exportValue: z => z.total,
      render: z => <span className="text-sm text-slate-600 tabular-nums">{z.total}</span>,
    },
  ];

  const mismatchColumns: ColumnDef<MismatchRow>[] = [
    {
      id: 'flat', label: 'Flat', alwaysVisible: true,
      sortValue: m => m.flatLabel, exportValue: m => m.flatLabel,
      render: m => <span className="text-sm font-bold text-slate-800">{m.flatLabel || '—'}</span>,
    },
    {
      id: 'cars', label: 'Car slots',
      sortValue: m => m.allocatedCars - m.billedCars,
      exportValue: m => `billed ${m.billedCars}, holds ${m.allocatedCars}`,
      render: m => <Delta billed={m.billedCars} held={m.allocatedCars} />,
    },
    {
      id: 'bikes', label: 'Two-wheeler slots',
      sortValue: m => m.allocatedBikes - m.billedBikes,
      exportValue: m => `billed ${m.billedBikes}, holds ${m.allocatedBikes}`,
      render: m => <Delta billed={m.billedBikes} held={m.allocatedBikes} />,
    },
    {
      id: 'what', label: 'What it means', alwaysVisible: true,
      exportValue: m => explain(m),
      render: m => <span className="text-xs text-slate-600 leading-snug">{explain(m)}</span>,
    },
  ];

  const withoutColumns: ColumnDef<FlatOption>[] = [
    {
      id: 'flat', label: 'Flat', alwaysVisible: true,
      sortValue: f => flatLabelOf(f), exportValue: f => flatLabelOf(f),
      render: f => <span className="text-sm font-semibold text-slate-700">{flatLabelOf(f)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="How full" value={`${overall}%`} tone="blue"
          icon={<SquareParking className="w-5 h-5" />}
          sub={`${t?.allotted ?? 0} of ${t?.slots ?? 0} bays given out`} />
        <StatCard label="Flats with a slot" value={t?.flatsWithASlot ?? 0} tone="emerald"
          icon={<CarFront className="w-5 h-5" />}
          sub={`of ${t?.flats ?? 0} flats`} />
        <StatCard label="Flats with nothing" value={t?.flatsWithout ?? 0} tone="amber"
          icon={<Home className="w-5 h-5" />}
          sub="Nobody has given them a bay" />
        <StatCard label="Bills that disagree" value={recon?.mismatches.length ?? 0}
          tone={(recon?.mismatches.length ?? 0) > 0 ? 'rose' : 'slate'}
          icon={<IndianRupee className="w-5 h-5" />}
          sub={`across ${recon?.flatsChecked ?? 0} flats`} />
      </div>

      {/* ---------------------------------------------------------- by area */}
      <div className="space-y-2">
        <SectionHeading hint="Counted against the bays that can actually be used. A bay with a pillar in it is not spare capacity — counting it as such is how a society decides it has room and takes on a car it cannot park.">
          How full each area is
        </SectionHeading>
        <DataTable
          columns={zoneColumns}
          data={occupancy?.byZone || []}
          keyExtractor={z => z.zoneId}
          exportFileName="parking-occupancy"
          emptyTitle="No parking areas yet"
          emptyText="Add an area and create its bays, and this fills in on its own."
        />
      </div>

      {/* ------------------------------------------------- the money report */}
      <div className="space-y-2">
        <SectionHeading hint="Where the bill and the map disagree. Every row here is a rupee difference on the next bill — a flat billed for one slot holding two, or billed for two having given one back years ago.">
          Bills that do not match the slots
        </SectionHeading>
        {recon && recon.mismatches.length === 0 ? (
          <Paper elevation={0} className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
            <p className="font-bold text-slate-800 text-sm">Everything agrees</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              All {recon.flatsChecked} flats are billed for exactly the slots they hold
              ({recon.slotsAllotted} in all). Every time a slot is given or taken back this is
              recalculated, so it stays that way on its own.
            </p>
          </Paper>
        ) : (
          <DataTable
            columns={mismatchColumns}
            data={recon?.mismatches || []}
            keyExtractor={m => m.flatId}
            exportFileName="parking-billing-mismatches"
            emptyTitle="Nothing to reconcile"
            emptyText="No flat is billed for a different number of slots than it holds."
          />
        )}
      </div>

      {/* -------------------------------------------------- who has nothing */}
      <div className="space-y-2">
        <SectionHeading hint="Useful when the next bay comes free and somebody has to decide who gets it.">
          Flats with no parking slot
        </SectionHeading>
        {without === null ? (
          <EmptyState compact title="The list of flats is not available to you"
            message={`Your society has ${t?.flatsWithout ?? 0} flats with no slot. Ask the society office for the list.`} />
        ) : (
          <DataTable
            columns={withoutColumns}
            data={without}
            keyExtractor={f => f._id}
            exportFileName="flats-without-parking"
            emptyTitle="Every flat has a slot"
            emptyText="Nobody in the society is without parking."
          />
        )}
      </div>
    </div>
  );
}

function Delta({ billed, held }: { billed: number; held: number }) {
  if (billed === held) return <span className="text-sm text-slate-500 tabular-nums">{held}</span>;
  const under = billed < held;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-sm font-bold tabular-nums text-slate-800">{held}</span>
      <Chip size="small" label={`billed ${billed}`}
        sx={{
          bgcolor: under ? '#fff1f2' : '#fffbeb',
          color: under ? '#be123c' : '#92400e',
          fontWeight: 700,
        }} />
    </span>
  );
}

/** Say what it means for the money, not what the numbers are. */
function explain(m: MismatchRow): string {
  const shortCars = m.allocatedCars - m.billedCars;
  const shortBikes = m.allocatedBikes - m.billedBikes;
  const under = shortCars + shortBikes;
  if (under > 0) return `Parks more than it pays for — ${under} slot${under > 1 ? 's' : ''} not on the bill.`;
  if (under < 0) return `Being charged for ${-under} slot${-under > 1 ? 's' : ''} it does not hold.`;
  return 'The car and two-wheeler counts are swapped over.';
}
