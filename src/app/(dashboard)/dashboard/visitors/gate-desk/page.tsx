'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, TextField, Autocomplete, Chip, IconButton,
} from '@mui/material';
import {
  LogIn, LogOut, Users, Clock, AlertTriangle, Search, RefreshCw, DoorOpen, X,
} from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { gateStrings } from '@/lib/gate-i18n';
import PageHeader from '@/components/common/PageHeader';
import PageSkeleton from '@/components/common/PageSkeleton';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import AppDialog from '@/components/common/AppDialog';
import useUrlState from '@/lib/use-url-state';

/**
 * The gate desk.
 *
 * Written for a cheap Android tablet on a bracket, used by somebody standing
 * up, often in poor light, sometimes in a hurry, and — going by every study of
 * these systems — the person on whom the whole record depends and the one most
 * likely to give up on a screen that fights them.
 *
 * So: big targets, three taps to log an arrival, one tap to log a departure,
 * and the two lists that matter (who is inside, who is overdue) always visible
 * without navigating anywhere.
 */

interface InsideRow {
  _id: string;
  entryCode: string;
  category: string;
  visitorName: string;
  flatLabel?: string;
  enteredAt: string;
  overdueMinutes: number;
  vehicleNumber?: string;
}
interface FlatOption { _id: string; label: string }
interface GateOption { _id: string; name: string; handlesEntry: boolean; handlesExit: boolean }
interface PlateHint {
  _id: string; number: string; displayNumber: string;
  flatId: string; flatLabel?: string; kind: string; make?: string; colour?: string;
}
interface Policy {
  gate: {
    capture: { photo: string; phone: string; idProof: string; categoriesEnabled: string[] };
    exit: { trackExit: boolean };
    vehicles: { track: boolean };
    residents: { logMovement: boolean; logVehicleOnly: boolean };
  };
  guardApp?: { language?: string };
}

const CATEGORY_LABEL: Record<string, string> = {
  GUEST: 'Guest',
  DELIVERY: 'Delivery',
  CAB: 'Cab',
  HOUSEHOLD_STAFF: 'Daily help',
  CONTRACTOR: 'Contractor',
  OTHER: 'Other',
  // Offered only when the society has switched resident logging on. See
  // society-ops-policy.model: RESIDENT is deliberately not a visitor category.
  RESIDENT: 'Resident',
};

/**
 * Minutes as a person says them.
 *
 * The overdue chip used to build its own label inline and dropped the minutes
 * for anything past the hour — 1h 45m over rendered as "1h over", which
 * understates every long overstay by up to 59 minutes on the one screen where
 * that number is the whole point.
 */
const hm = (mins: number) => (mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`);

const since = (iso: string) => hm(Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));

function GateDesk() {
  const { showToast, confirm } = useToastConfirm();
  const url = useUrlState({ q: '' });

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [inside, setInside] = useState<InsideRow[]>([]);
  const [flats, setFlats] = useState<FlatOption[]>([]);

  // The search sits in the URL so a guard can bookmark "everyone for B wing",
  // and so a reload in the middle of a shift does not clear it. Typed into
  // local state first and pushed after a pause — a router navigation per
  // keystroke is noticeable on the tablets these run on.
  const appliedSearch = url.get('q');
  const [search, setSearch] = useState(appliedSearch);

  useEffect(() => {
    if (search === appliedSearch) return;
    const timer = setTimeout(() => url.set({ q: search }), 300);
    return () => clearTimeout(timer);
  }, [search, appliedSearch, url]);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState('GUEST');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [flat, setFlat] = useState<FlatOption | null>(null);
  const [vehicle, setVehicle] = useState('');
  const [gates, setGates] = useState<GateOption[]>([]);
  const [gateId, setGateId] = useState('');
  const [plateHints, setPlateHints] = useState<PlateHint[]>([]);

  /**
   * Ask the register what this plate might be, once the guard has typed enough
   * to mean something. Debounced, because this fires on a shared tablet on a
   * gate's wifi and a request per keystroke is how that connection dies.
   */
  useEffect(() => {
    const q = vehicle.replace(/[^A-Za-z0-9]/g, '');
    if (q.length < 2) { setPlateHints([]); return; }
    const timer = setTimeout(() => {
      api.get(`/visitors/vehicles/suggest?q=${encodeURIComponent(q)}`)
        .then(r => setPlateHints(r.data?.data || []))
        .catch(() => setPlateHints([]));   // a silent hint is better than a toast
    }, 250);
    return () => clearTimeout(timer);
  }, [vehicle]);

  const loadInside = useCallback(async () => {
    try {
      const res = await api.get('/visitors/inside');
      setInside(res.data?.data || []);
      setFailed(false);
    } catch (e: any) {
      setFailed(true);
      showToast(e.response?.data?.message || 'Could not load who is inside', 'error');
    }
  }, [showToast]);

  const boot = useCallback(async () => {
    setLoading(true);
    try {
      const [p, f, g] = await Promise.all([
        api.get('/visitors/policy').catch(() => null),
        api.get('/visitors/flats'),
        api.get('/visitors/gates').catch(() => null),
      ]);
      if (p) setPolicy(p.data?.data?.policy);
      setFlats(f.data?.data || []);
      const doors: GateOption[] = g?.data?.data || [];
      setGates(doors);
      // A society with exactly one gate never has to pick — the backend falls
      // back to it anyway, and asking would be a tap a guard makes a hundred
      // times a day for no information.
      if (doors.length === 1) setGateId(doors[0]._id);
      await loadInside();
    } catch (e: any) {
      setFailed(true);
      showToast(e.response?.data?.message || 'The gate desk could not start up', 'error');
    } finally { setLoading(false); }
  }, [loadInside, showToast]);

  useEffect(() => { boot(); }, [boot]);

  // A gate is a shared screen — the guard who logged an exit may not be the one
  // looking. Refresh on a slow tick rather than making them remember to.
  useEffect(() => {
    const t = setInterval(loadInside, 45_000);
    return () => clearInterval(t);
  }, [loadInside]);

  // The guard's own language. `guardApp.language` has been on the policy since
  // Phase 4 and did nothing until there were dictionaries to read.
  const t = gateStrings(policy?.guardApp?.language);

  const logsResidents = !!policy?.gate.residents?.logMovement;
  const residentVehicleOnly = !!policy?.gate.residents?.logVehicleOnly;
  const categories = [
    ...(policy?.gate.capture.categoriesEnabled || ['GUEST', 'DELIVERY', 'CAB', 'HOUSEHOLD_STAFF', 'CONTRACTOR', 'OTHER']),
    // Appears ONLY when the society switched it on. With it off the endpoint
    // refuses the category outright, so offering the chip would be a button
    // whose only outcome is an error.
    ...(logsResidents ? ['RESIDENT'] : []),
  ];
  const isResident = category === 'RESIDENT';
  const phoneRequired = policy?.gate.capture.phone === 'REQUIRED' && !isResident;
  const phoneOff = policy?.gate.capture.phone === 'OFF' || isResident;
  // A resident logged for parking still needs their plate even when visitor
  // vehicles are not being recorded at all — that IS the record.
  const tracksVehicles = policy?.gate.vehicles.track || isResident;
  const tracksExit = policy?.gate.exit.trackExit !== false;

  const entryGates = gates.filter(g => g.handlesEntry);
  const exitGates = gates.filter(g => g.handlesExit);

  const reset = () => { setName(''); setPhone(''); setFlat(null); setVehicle(''); setCategory('GUEST'); };

  const submit = async () => {
    // A resident under "only the vehicle" is a plate and a flat, by design —
    // there is no name to ask for.
    if (!isResident && !name.trim()) return showToast(t.whoIsHere, 'error');
    if (isResident && !flat) return showToast('Which flat?', 'error');
    if (isResident && residentVehicleOnly && !vehicle.trim()) {
      return showToast('This society records only the vehicle — a number is needed', 'error');
    }
    if (phoneRequired && !phone.trim()) return showToast('A phone number is required here', 'error');
    setSaving(true);
    try {
      const res = await api.post('/visitors/entries', {
        category,
        visitorName: isResident && residentVehicleOnly ? undefined : (name.trim() || undefined),
        visitorPhone: phoneOff ? undefined : (phone.trim() || undefined),
        flatId: flat?._id,
        vehicleNumber: tracksVehicles ? (vehicle.trim().toUpperCase() || undefined) : undefined,
        entryGateId: gateId || undefined,
      });
      // The gate now has three possible outcomes, not one. AWAITING means the
      // flat was asked and the visitor is NOT in yet — saying "logged in" there
      // would tell the guard to wave somebody through who has not been allowed.
      const outcome = res.data?.data?._outcome;
      showToast(
        res.data?.message || 'Logged in',
        outcome === 'AWAITING' ? 'info' : outcome === 'LEFT_AT_GATE' ? 'warning' : 'success',
      );
      setOpen(false); reset();
      await loadInside();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not log that entry', 'error');
    } finally { setSaving(false); }
  };

  const markOut = async (row: InsideRow) => {
    const yes = await confirm({
      title: `${row.visitorName} leaving?`,
      message: row.flatLabel ? `Came to see ${row.flatLabel}, ${since(row.enteredAt)} ago.` : `Entered ${since(row.enteredAt)} ago.`,
      confirmText: 'Mark as gone', cancelText: 'Not yet',
    });
    if (!yes) return;
    try {
      // The door they are leaving by — the one this desk is standing at, if
      // it can take exits at all. A service gate that only lets people in would
      // be refused by the server, so it is never offered as the default.
      const leavingBy = exitGates.some(g => g._id === gateId) ? gateId : (exitGates.length === 1 ? exitGates[0]._id : undefined);
      await api.post(`/visitors/entries/${row._id}/exit`, { exitGateId: leavingBy });
      showToast(`${row.visitorName} marked as gone`, 'success');
      await loadInside();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not record that exit', 'error');
    }
  };

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inside;
    return inside.filter(r =>
      r.visitorName.toLowerCase().includes(q) ||
      (r.flatLabel || '').toLowerCase().includes(q) ||
      r.entryCode.includes(q) ||
      (r.vehicleNumber || '').toLowerCase().includes(q));
  }, [inside, search]);

  const overdue = inside.filter(r => r.overdueMinutes > 0);

  if (loading) return <PageSkeleton label="Opening the gate desk" />;
  if (failed && inside.length === 0) {
    return (
      <ErrorState
        title="The gate desk could not load"
        message="Nobody's arrival can be recorded until this list comes back."
        hint="If this keeps happening, the tablet has probably lost the society wifi — check the signal before restarting anything."
        onRetry={boot}
      />
    );
  }

  return (
    <div className="space-y-4 pb-28">
      <PageHeader
        breadcrumb="Visitor Management"
        title={t.console}
        icon={<DoorOpen className="w-4.5 h-4.5" />}
        subtitle={
          inside.length === 0
            ? t.nobodyInside
            : `${inside.length} · ${t.inside}${overdue.length > 0 ? ` · ${overdue.length} ${t.overstaying}` : ''}`
        }
        actions={
          <IconButton onClick={loadInside} aria-label="Refresh">
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </IconButton>
        }
      />

      {overdue.length > 0 && (
        <Paper elevation={0} className="rounded-2xl border border-amber-300 bg-amber-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-black uppercase tracking-wider text-amber-800">Should have left</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {overdue.map(r => (
              <Chip key={r._id} size="small" clickable onClick={() => markOut(r)}
                label={`${r.visitorName}${r.flatLabel ? ` · ${r.flatLabel}` : ''} · ${hm(r.overdueMinutes)} over`}
                sx={{ bgcolor: '#ffffff', border: '1px solid #fcd34d', color: '#78350f' }} />
            ))}
          </div>
        </Paper>
      )}

      <TextField
        fullWidth placeholder="Search name, flat, vehicle…"
        value={search} onChange={e => setSearch(e.target.value)}
        slotProps={{
          input: {
            startAdornment: <Search className="w-4 h-4 text-slate-400 mr-2" />,
            endAdornment: search ? (
              <IconButton size="small" onClick={() => setSearch('')} aria-label="Clear search">
                <X className="w-4 h-4 text-slate-400" />
              </IconButton>
            ) : undefined,
          },
        }}
      />

      {/* ------------------------------------------------------- inside list */}
      {shown.length === 0 ? (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title={inside.length === 0 ? 'Nobody is inside' : 'Nothing matches'}
          message={inside.length === 0
            ? 'Log an arrival with the button below.'
            : 'Try a different name, flat or number plate.'}
        />
      ) : (
        <div className="grid gap-2">
          {shown.map(r => (
            <Paper key={r._id} elevation={0}
              className={`rounded-2xl border p-3 flex items-center gap-3 ${r.overdueMinutes > 0 ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200/70'}`}>
              <div className="w-14 shrink-0 text-center">
                <p className="text-[10px] font-black text-slate-400">{r.entryCode.split('-')[1]}</p>
                <p className="text-[10px] text-slate-400 flex items-center justify-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />{since(r.enteredAt)}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 truncate">{r.visitorName}</p>
                <p className="text-xs text-slate-500 truncate">
                  {CATEGORY_LABEL[r.category] || r.category}
                  {r.flatLabel && ` → ${r.flatLabel}`}
                  {r.vehicleNumber && ` · ${r.vehicleNumber}`}
                </p>
              </div>
              {tracksExit && (
                <Button variant="outlined" onClick={() => markOut(r)} className="shrink-0"
                  startIcon={<LogOut className="w-4 h-4" />}>
                  Out
                </Button>
              )}
            </Paper>
          ))}
        </div>
      )}

      {/* Big, fixed, thumb-reachable. This is the button that gets pressed all day. */}
      <div className="fixed bottom-4 left-0 right-0 px-4 z-10 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <Button fullWidth variant="contained" size="large"
            startIcon={<LogIn className="w-5 h-5" />}
            onClick={() => { reset(); setOpen(true); }}
            sx={{ py: 2, fontSize: '1rem', boxShadow: '0 12px 28px rgba(15,23,42,0.18)' }}>
            {t.recordEntry}
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------ entry */}
      <AppDialog
        open={open}
        onClose={() => setOpen(false)}
        title={t.whoIsHere}
        busy={saving}
        actionsLayout="stacked"
        confirmText={saving ? 'Logging…' : 'Let them in'}
        onConfirm={submit}
      >
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">They are a</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {categories.map(c => (
              <Chip key={c} label={CATEGORY_LABEL[c] || c} clickable onClick={() => setCategory(c)}
                color={category === c ? 'primary' : 'default'}
                variant={category === c ? 'filled' : 'outlined'}
                sx={{ py: 2 }} />
            ))}
          </div>
        </div>

        {isResident && (
          <div className="rounded-xl bg-slate-100 border border-slate-200 p-2.5 text-[11px] text-slate-600 leading-relaxed">
            {residentVehicleOnly
              ? 'This society records only the vehicle for residents — the flat and the number plate, and no name.'
              : 'A resident of this society. They are not asked for permission and the flat is not notified.'}
          </div>
        )}

        {!(isResident && residentVehicleOnly) && (
          <TextField autoFocus fullWidth label={t.visitorName} value={name}
            onChange={e => setName(e.target.value)} />
        )}

        {!phoneOff && (
          <TextField fullWidth label={`${t.phone}${phoneRequired ? ' *' : ''}`} value={phone}
            onChange={e => setPhone(e.target.value)} type="tel" />
        )}

        <Autocomplete
          options={flats} getOptionLabel={o => o.label} value={flat}
          onChange={(_, v) => setFlat(v)}
          renderInput={p => <TextField {...p} label={t.whichFlat} />}
        />

        {/* ------------------------------------------------- the plate box
          *
          * Reads the resident vehicle register as the guard types.
          * `GET /gate/vehicles/suggest` shipped complete and nothing called
          * it, so the register was a list nobody's typing ever touched —
          * and a resident's own car got logged as a visitor every time.
          *
          * Picking a suggestion fills the flat too, which is the whole point:
          * three taps become one, and the entry is right rather than nearly.
          */}
        {tracksVehicles && (
          <Autocomplete
            freeSolo
            options={plateHints}
            inputValue={vehicle}
            filterOptions={x => x}   /* the server already did the filtering */
            getOptionLabel={o => typeof o === 'string' ? o : o.displayNumber}
            onInputChange={(_, v) => setVehicle((v || '').toUpperCase())}
            onChange={(_, v) => {
              if (!v || typeof v === 'string') return;
              setVehicle(v.displayNumber);
              const home = flats.find(f => f._id === String(v.flatId));
              if (home) setFlat(home);
            }}
            renderOption={(props, o) => (
              <li {...props} key={o._id}>
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 font-mono text-sm">{o.displayNumber}</p>
                  <p className="text-[11px] text-slate-500">
                    {o.flatLabel}{o.make && ` · ${o.make}`}{o.colour && ` ${o.colour}`}
                  </p>
                </div>
              </li>
            )}
            renderInput={p => (
              <TextField {...p} fullWidth
                label={`${t.vehicle}${isResident && residentVehicleOnly ? ' *' : ''}`}
                helperText={plateHints.length ? 'A registered vehicle — picking it fills the flat too' : undefined} />
            )}
          />
        )}

        {/* Only asked when there is genuinely a choice. One gate answers itself. */}
        {entryGates.length > 1 && (
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Which gate</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {entryGates.map(g => (
                <Chip key={g._id} label={g.name} clickable onClick={() => setGateId(g._id)}
                  color={gateId === g._id ? 'primary' : 'default'}
                  variant={gateId === g._id ? 'filled' : 'outlined'}
                  sx={{ py: 2 }} />
              ))}
            </div>
          </div>
        )}
      </AppDialog>
    </div>
  );
}

// `useSearchParams` needs a boundary above it or the production build refuses
// to prerender the route. See node_modules/next/dist/docs — use-search-params.
export default function GateConsolePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <GateDesk />
    </Suspense>
  );
}
