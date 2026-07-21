'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { Button, Tab, Tabs } from '@mui/material';
import { SquareParking, Plus } from 'lucide-react';
import api from '@/lib/api';
import PageHeader from '@/components/common/PageHeader';
import PageSkeleton from '@/components/common/PageSkeleton';
import ErrorState from '@/components/common/ErrorState';
import useUrlState from '@/lib/use-url-state';
import MapTab from './MapTab';
import SlotsTab from './SlotsTab';
import AllocationsTab from './AllocationsTab';
import RequestsTab from './RequestsTab';
import ReportsTab from './ReportsTab';
import ZoneDialog from './ZoneDialog';
import BulkSlotWizard from './BulkSlotWizard';
import { FlatOption, Zone, apiMessage } from './parking-types';

/**
 * Parking — the map, the inventory, the waiting list and the money.
 *
 * Everything a reader can change lives in the URL: which tab, which area, what
 * was searched for. A committee member who finds the flat that has been parking
 * free for two years can paste that exact screen to the secretary, which is how
 * this actually gets acted on.
 *
 * The whole module is behind Gate 2 on the server — a society that does not
 * manage parking gets a 404 from every route in it, which is why a failure here
 * says "ask the office to switch it on" rather than showing an empty page and
 * letting somebody conclude the software is broken.
 */

const TABS = [
  { value: 'map', label: 'Map' },
  { value: 'slots', label: 'Slots' },
  { value: 'allocations', label: 'Who parks where' },
  { value: 'requests', label: 'Waiting list' },
  { value: 'reports', label: 'Reports' },
] as const;

const DEFAULTS = { tab: 'map', zoneId: '', status: '', q: '' };

function Parking() {
  const url = useUrlState(DEFAULTS);

  const tab = TABS.some(t => t.value === url.get('tab')) ? url.get('tab') : 'map';
  const zoneId = url.get('zoneId');
  const status = url.get('status');
  const q = url.get('q');

  const [zones, setZones] = useState<Zone[]>([]);
  const [flats, setFlats] = useState<FlatOption[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [zoneDialog, setZoneDialog] = useState<{ open: boolean; zone: Zone | null }>({ open: false, zone: null });
  const [wizardFor, setWizardFor] = useState<string | null>(null);

  const bump = useCallback(() => setReloadKey(k => k + 1), []);

  /**
   * What this reader may do, asked once.
   *
   * `/me/entitlements` is the same call the sidebar makes and it fails CLOSED —
   * an error returns everything switched off rather than everything on. So a
   * bad answer here hides the buttons, which is the safe way round.
   */
  const loadShell = useCallback(async () => {
    setLoading(true);
    try {
      const [entRes, zoneRes] = await Promise.all([
        api.get('/me/entitlements').catch(() => null),
        api.get('/parking/zones'),
      ]);
      const ent = entRes?.data?.data;
      const manage = !!ent && (ent.isAdmin === true || ent.permissions?.PARKING_MANAGE === 'FULL');
      setCanManage(manage);
      setZones(zoneRes.data?.data || []);
      setFatal(null);

      // Only needed to give a slot to somebody. Best-effort: a reader who
      // cannot list flats simply gets a map they can read but not act on.
      if (manage) {
        api.get('/societies/flats')
          .then(r => setFlats(r.data?.flats || []))
          .catch(() => setFlats([]));
      }
    } catch (e: any) {
      const code = e?.response?.status;
      setFatal(code === 404
        ? 'Your society does not manage parking in ResiSmart yet.'
        : apiMessage(e, 'The parking screen could not be loaded'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadShell(); }, [loadShell]);

  // Anything that changes a slot changes the reports and the counts too, so one
  // signal refreshes everything rather than each tab going stale on its own.
  const onChanged = useCallback(() => { bump(); }, [bump]);

  const setFilter = useCallback((patch: Record<string, string>) => url.set(patch), [url]);

  if (loading) return <PageSkeleton label="Opening the parking…" />;

  if (fatal) {
    return (
      <div className="space-y-4 pb-24">
        <PageHeader
          breadcrumb="Operations"
          title="Parking"
          icon={<SquareParking className="w-4.5 h-4.5" />}
        />
        <ErrorState
          title="Parking is not available"
          message={fatal}
          hint="Your society admin can switch parking on in Society Settings. Nothing is lost while it is off — slots and allocations are kept and come back."
          onRetry={loadShell}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        breadcrumb="Operations"
        title="Parking"
        icon={<SquareParking className="w-4.5 h-4.5" />}
        subtitle="Every bay in the society, who holds it, and a bill that agrees with both. The count a flat is charged for comes from this screen — nobody types it by hand any more."
        actions={canManage
          ? (
            <Button variant="contained" startIcon={<Plus className="w-4 h-4" />}
              onClick={() => (zones.length ? setWizardFor(zoneId || zones[0]._id) : setZoneDialog({ open: true, zone: null }))}>
              {zones.length ? 'Create slots' : 'Add a parking area'}
            </Button>
          )
          : undefined}
      />

      <Tabs
        value={tab}
        onChange={(_, v) => url.set({ tab: v, q: '', status: '' })}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 44, '& .MuiTab-root': { minHeight: 44, fontWeight: 700 } }}
      >
        {TABS.map(t => <Tab key={t.value} value={t.value} label={t.label} />)}
      </Tabs>

      {tab === 'map' && (
        <MapTab
          zones={zones}
          canManage={canManage}
          flats={flats}
          zoneId={zoneId}
          q={q}
          onFilter={setFilter}
          onAddZone={() => setZoneDialog({ open: true, zone: null })}
          onEditZone={z => setZoneDialog({ open: true, zone: z })}
          onBulkCreate={id => setWizardFor(id)}
          reloadKey={reloadKey}
          onChanged={onChanged}
        />
      )}

      {tab === 'slots' && (
        <SlotsTab
          zones={zones}
          canManage={canManage}
          zoneId={zoneId}
          status={status}
          q={q}
          onFilter={setFilter}
          onBulkCreate={() => setWizardFor(zoneId || zones[0]?._id || '')}
          reloadKey={reloadKey}
        />
      )}

      {tab === 'allocations' && (
        <AllocationsTab
          zones={zones}
          canManage={canManage}
          zoneId={zoneId}
          status={status}
          q={q}
          onFilter={setFilter}
          reloadKey={reloadKey}
          onChanged={onChanged}
        />
      )}

      {tab === 'requests' && (
        <RequestsTab
          canManage={canManage}
          status={status}
          onFilter={setFilter}
          reloadKey={reloadKey}
          onChanged={onChanged}
        />
      )}

      {tab === 'reports' && <ReportsTab reloadKey={reloadKey} />}

      <ZoneDialog
        open={zoneDialog.open}
        zone={zoneDialog.zone}
        onClose={() => setZoneDialog({ open: false, zone: null })}
        onSaved={() => { loadShell(); bump(); }}
      />

      {zones.length > 0 && (
        <BulkSlotWizard
          open={!!wizardFor}
          zones={zones}
          defaultZoneId={wizardFor || undefined}
          onClose={() => setWizardFor(null)}
          onCreated={bump}
        />
      )}
    </div>
  );
}

// `useSearchParams` needs a boundary above it or the production build refuses to
// prerender the route. See node_modules/next/dist/docs — use-search-params.
export default function ParkingPage() {
  return (
    <Suspense fallback={<PageSkeleton label="Opening the parking…" />}>
      <Parking />
    </Suspense>
  );
}
