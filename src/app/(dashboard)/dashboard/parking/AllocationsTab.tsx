'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Chip, FormControl, MenuItem, Select, TextField } from '@mui/material';
import { Undo2, CarFront } from 'lucide-react';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import AppDialog from '@/components/common/AppDialog';
import ErrorState from '@/components/common/ErrorState';
import SearchBox from './SearchBox';
import {
  Allocation, Zone, ALLOCATION_KIND_LABEL, VEHICLE_KIND_LABEL, apiMessage, fmtDate, sinceWhen, squash,
} from './parking-types';

/**
 * Who parks where, and who parked there before them.
 *
 * Append-only on the server: ending an allocation stamps a date and a reason,
 * it never deletes the row. So this screen is the answer to "B1-14 was ours
 * until 2023" — and, because the flat's billed count is recomputed from exactly
 * these rows, it is also the explanation for every parking line on a bill.
 */

export default function AllocationsTab({
  zones, canManage, zoneId, status, q, onFilter, reloadKey, onChanged,
}: {
  zones: Zone[];
  canManage: boolean;
  zoneId: string;
  status: string;
  q: string;
  onFilter: (patch: Record<string, string>) => void;
  reloadKey: number;
  onChanged: () => void;
}) {
  const { showToast } = useToastConfirm();
  const [rows, setRows] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  const [releasing, setReleasing] = useState<Allocation | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState(q);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (zoneId) params.set('zoneId', zoneId);
      if (status) params.set('status', status);
      const res = await api.get(`/parking/allocations?${params}`);
      setRows(res.data?.data || []);
      setFailed(false);
    } catch (e: any) {
      setFailed(true);
      showToast(apiMessage(e, 'Could not load who parks where'), 'error');
    } finally { setLoading(false); }
  }, [zoneId, status, showToast]);

  useEffect(() => { load(); }, [load, reloadKey, tick]);

  const needle = squash(typed);
  const filtered = useMemo(
    () => (needle
      ? rows.filter(r => squash(r.slotCode).includes(needle) || squash(r.flatLabel).includes(needle))
      : rows),
    [rows, needle],
  );

  const release = async () => {
    if (!releasing) return;
    setBusy(true);
    try {
      const res = await api.post(`/parking/allocations/${releasing._id}/release`, {
        reason: reason.trim() || undefined,
      });
      showToast(res.data?.message || 'Slot taken back.', 'success');
      setReleasing(null); setReason('');
      setTick(t => t + 1);
      onChanged();
    } catch (e: any) {
      showToast(apiMessage(e, 'Could not take that slot back'), 'error');
    } finally { setBusy(false); }
  };

  const columns: ColumnDef<Allocation>[] = [
    {
      id: 'slot', label: 'Slot', alwaysVisible: true,
      sortValue: a => a.slotCode, exportValue: a => a.slotCode,
      render: a => <span className="font-bold text-slate-800">{a.slotCode}</span>,
    },
    {
      id: 'flat', label: 'Flat', alwaysVisible: true,
      sortValue: a => a.flatLabel || '', exportValue: a => a.flatLabel || '',
      render: a => <span className="text-sm font-semibold text-slate-700">{a.flatLabel || '—'}</span>,
    },
    {
      id: 'vehKind', label: 'Billed as', defaultHidden: true,
      sortValue: a => VEHICLE_KIND_LABEL[a.slotKind],
      exportValue: a => VEHICLE_KIND_LABEL[a.slotKind],
      render: a => <span className="text-xs text-slate-600">{VEHICLE_KIND_LABEL[a.slotKind]}</span>,
    },
    {
      id: 'kind', label: 'Given',
      sortValue: a => ALLOCATION_KIND_LABEL[a.kind], exportValue: a => ALLOCATION_KIND_LABEL[a.kind],
      render: a => <span className="text-xs text-slate-600">{ALLOCATION_KIND_LABEL[a.kind]}</span>,
    },
    {
      id: 'from', label: 'From',
      sortValue: a => a.startDate, exportValue: a => fmtDate(a.startDate),
      render: a => (
        <span className="text-xs text-slate-600">
          {fmtDate(a.startDate)}
          <span className="block text-[10px] text-slate-400">{sinceWhen(a.startDate)}</span>
        </span>
      ),
    },
    {
      id: 'until', label: 'Until',
      sortValue: a => a.endDate || '', exportValue: a => (a.endDate ? fmtDate(a.endDate) : 'still theirs'),
      render: a => a.status === 'ACTIVE'
        ? <Chip size="small" label="Still theirs" sx={{ bgcolor: '#ecfdf5', color: '#047857', fontWeight: 700 }} />
        : (
          <span className="text-xs text-slate-600">
            {fmtDate(a.endDate)}
            {a.endReason && <span className="block text-[10px] text-slate-400 italic">{a.endReason}</span>}
          </span>
        ),
    },
    {
      id: 'charged', label: 'Charged',
      sortValue: a => (a.chargeable ? 'Yes' : 'No'), exportValue: a => (a.chargeable ? 'Yes' : 'No'),
      render: a => a.chargeable
        ? <span className="text-xs font-semibold text-slate-700">Yes</span>
        : <span className="text-xs text-slate-400">Free</span>,
    },
    {
      id: 'by', label: 'Given by', defaultHidden: true,
      sortValue: a => a.allocatedByName || '', exportValue: a => a.allocatedByName || '',
      render: a => (
        <span className="text-[11px] text-slate-500">
          {a.allocatedByName || '—'}
          {a.endedByName && <span className="block">taken back by {a.endedByName}</span>}
        </span>
      ),
    },
  ];

  if (canManage) {
    columns.push({
      id: 'act', label: '', align: 'right', alwaysVisible: true,
      render: a => a.status === 'ACTIVE'
        ? (
          <Button size="small" startIcon={<Undo2 className="w-3.5 h-3.5" />}
            onClick={() => { setReleasing(a); setReason(''); }}>
            Take it back
          </Button>
        )
        : <span className="text-slate-300">—</span>,
    });
  }

  if (failed && !loading) {
    return (
      <ErrorState
        title="This list could not be loaded"
        message="Something went wrong reading who parks where."
        onRetry={() => setTick(t => t + 1)}
      />
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        keyExtractor={a => a._id}
        exportFileName="who-parks-where"
        columnToggle
        emptyTitle="Nobody has been given a slot yet"
        emptyText="Open the map, tap a free bay and give it to a flat. The flat's bill counts it from that moment."
        emptyIcon={<CarFront className="w-6 h-6" />}
        toolbar={
          <>
            <SearchBox value={q} onChange={setTyped} onCommit={v => onFilter({ q: v })}
              placeholder="Slot number or flat" className="min-w-56" />
            <FormControl size="small" className="min-w-44">
              <Select displayEmpty value={zoneId} onChange={e => onFilter({ zoneId: e.target.value })}>
                <MenuItem value="">Every area</MenuItem>
                {zones.map(z => <MenuItem key={z._id} value={z._id}>{z.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" className="min-w-44">
              <Select displayEmpty value={status} onChange={e => onFilter({ status: e.target.value })}>
                <MenuItem value="">Now and before</MenuItem>
                <MenuItem value="ACTIVE">Held right now</MenuItem>
                <MenuItem value="ENDED">Given back</MenuItem>
              </Select>
            </FormControl>
          </>
        }
      />

      <AppDialog
        open={!!releasing}
        onClose={() => setReleasing(null)}
        busy={busy}
        maxWidth="xs"
        title={releasing ? `Take ${releasing.slotCode} back?` : ''}
        subtitle={releasing ? `${releasing.flatLabel || 'This flat'} stops being billed for it straight away.` : undefined}
        confirmText="Take it back"
        confirmColor="warning"
        onConfirm={release}
      >
        <p className="text-sm text-slate-600 leading-relaxed">
          Nothing is deleted. The record of who held it stays, so this can still be explained at the AGM.
        </p>
        <TextField fullWidth size="small" label="Why (optional)" value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Sold the car, moved out, swapped slots" />
      </AppDialog>
    </>
  );
}
