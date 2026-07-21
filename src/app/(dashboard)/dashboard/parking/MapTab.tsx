'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button, Tab, Tabs } from '@mui/material';
import { Plus, Pencil, Map } from 'lucide-react';
import api from '@/lib/api';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import PageSkeleton from '@/components/common/PageSkeleton';
import SlotMap from './SlotMap';
import SlotDrawer from './SlotDrawer';
import SearchBox from './SearchBox';
import { FlatOption, MapSlot, Zone, apiMessage } from './parking-types';

/**
 * The centrepiece — a movie-ticket seat picker for a basement.
 *
 * A committee member should be able to answer "where does A-102 park?" in about
 * a second: type the flat number, everything else dims, and the one bay that is
 * theirs pulses. That is the whole reason this screen exists rather than
 * another table, and it is why the search box sits above the map and not inside
 * a filter panel.
 */

export default function MapTab({
  zones, canManage, flats, zoneId, q, onFilter, onAddZone, onEditZone, onBulkCreate, reloadKey, onChanged,
}: {
  zones: Zone[];
  canManage: boolean;
  flats: FlatOption[];
  zoneId: string;
  q: string;
  onFilter: (patch: Record<string, string>) => void;
  onAddZone: () => void;
  onEditZone: (z: Zone) => void;
  onBulkCreate: (zoneId: string) => void;
  reloadKey: number;
  onChanged: () => void;
}) {
  const [slots, setSlots] = useState<MapSlot[]>([]);
  const [canSeeHolders, setCanSeeHolders] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [picked, setPicked] = useState<MapSlot | null>(null);
  // What is in the box right now. The highlight follows this, not the URL, so
  // bays light up as the number is typed rather than a third of a second later.
  const [typed, setTyped] = useState(q);

  // The tab that is actually showing: the one in the URL when it still exists,
  // otherwise the first area. A stale zone id in a pasted link must not leave
  // somebody staring at nothing.
  const active = zones.find(z => z._id === zoneId) || zones[0];

  const load = useCallback(async () => {
    if (!active) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await api.get(`/parking/map/${active._id}`);
      setSlots(res.data?.data?.slots || []);
      setCanSeeHolders(!!res.data?.data?.canSeeHolders);
      setError(null);
    } catch (e: any) {
      setError(apiMessage(e, 'Could not load the map'));
    } finally { setLoading(false); }
  }, [active]);

  useEffect(() => { load(); }, [load, reloadKey, tick]);

  // Keep the drawer looking at fresh data after an allocate or a release.
  useEffect(() => {
    if (!picked) return;
    const fresh = slots.find(s => s._id === picked._id);
    if (fresh && fresh !== picked) setPicked(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  // One signal, not two: `reloadKey` is already in this screen's fetch, so
  // bumping the parent is enough and asking twice would double every request.
  const refresh = () => onChanged();

  if (!zones.length) {
    return (
      <EmptyState
        title="No parking areas yet"
        message="Start with the place itself — “Basement 1”, “Stilt”, “Open compound” — then draw its bays in one go. Whatever your society already calls it is the right name."
        icon={<Map className="w-6 h-6" />}
        action={canManage ? { label: 'Add a parking area', onClick: onAddZone, icon: <Plus className="w-4 h-4" /> } : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap border-b border-slate-200/70">
        <Tabs
          value={active?._id || false}
          onChange={(_, v) => onFilter({ zoneId: v })}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 44, '& .MuiTab-root': { minHeight: 44, fontWeight: 700, fontSize: 13 } }}
        >
          {zones.map(z => <Tab key={z._id} value={z._id} label={z.name} />)}
        </Tabs>
        {canManage && (
          <div className="flex items-center gap-1 pb-1">
            {active && (
              <Button size="small" color="inherit" startIcon={<Pencil className="w-3.5 h-3.5" />}
                onClick={() => onEditZone(active)}>
                Edit this area
              </Button>
            )}
            <Button size="small" color="inherit" startIcon={<Plus className="w-3.5 h-3.5" />} onClick={onAddZone}>
              Add an area
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <SearchBox
          value={q}
          onChange={setTyped}
          onCommit={v => onFilter({ q: v })}
          placeholder="Flat number, number plate or slot"
          className="flex-1 min-w-56 max-w-md"
        />
        <p className="text-[11px] text-slate-400 hidden sm:block">
          Type A-102 or MH12AB1234 — the matching bay lights up and the rest fades.
        </p>
      </div>

      {loading ? (
        <PageSkeleton label="Drawing the floor…" />
      ) : error ? (
        <ErrorState
          title="This area could not be drawn"
          message={error}
          onRetry={() => setTick(t => t + 1)}
        />
      ) : slots.length === 0 ? (
        <EmptyState
          title={`${active?.name} has no bays drawn on it yet`}
          message="Nobody hand-creates two hundred slots. Say what they are called and where they sit, and the whole level is drawn in one step."
          icon={<Map className="w-6 h-6" />}
          action={canManage && active
            ? { label: 'Create slots here', onClick: () => onBulkCreate(active._id), icon: <Plus className="w-4 h-4" /> }
            : undefined}
        />
      ) : active ? (
        <SlotMap
          zone={active}
          slots={slots}
          canSeeHolders={canSeeHolders}
          query={typed}
          selectedId={picked?._id}
          onPick={setPicked}
        />
      ) : null}

      <SlotDrawer
        slot={picked}
        zoneId={active?._id || ''}
        zoneName={active?.name || ''}
        canManage={canManage}
        canSeeHolders={canSeeHolders}
        flats={flats}
        onClose={() => setPicked(null)}
        onChanged={refresh}
      />
    </div>
  );
}
