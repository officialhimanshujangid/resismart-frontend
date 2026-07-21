'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Autocomplete, Box, Button, Divider, Drawer, FormControl, FormControlLabel, IconButton,
  InputLabel, MenuItem, Select, Switch, TextField, useMediaQuery, useTheme,
} from '@mui/material';
import { X, CarFront, Undo2, ArrowLeftRight, Wrench, History, Check } from 'lucide-react';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import SectionHeading from '@/components/common/SectionHeading';
import { SlotCard } from './SlotMap';
import {
  Allocation, FlatOption, MapSlot, SETTABLE_STATUSES, SlotStatus, VEHICLE_KIND_LABEL,
  ALLOCATION_KIND_LABEL, AllocationKind, apiMessage, flatLabelOf, fmtDate, tokenFor, SIZE_LABEL,
} from './parking-types';

/**
 * One slot, and everything a committee member can do to it.
 *
 * A drawer rather than a dialog because the map has to stay visible: "give
 * B1-14 to A-102" is a decision somebody makes while looking at what is next to
 * B1-14. On a phone the same panel arrives from the bottom, which is where a
 * thumb already is.
 *
 * Every action here is one call to the API and then a reload of the map. None
 * of it is optimistic — a slot that appeared to be given and was not is the one
 * outcome this module exists to prevent.
 */

interface Vehicle { _id: string; displayNumber: string; flatId: string; kind: string; make?: string }

type Mode = 'none' | 'allocate' | 'release' | 'transfer' | 'status';

export interface SlotDrawerProps {
  slot: MapSlot | null;
  zoneId: string;
  zoneName: string;
  canManage: boolean;
  canSeeHolders: boolean;
  flats: FlatOption[];
  onClose: () => void;
  onChanged: () => void;
}

export default function SlotDrawer({
  slot, zoneId, zoneName, canManage, canSeeHolders, flats, onClose, onChanged,
}: SlotDrawerProps) {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'));
  const { showToast } = useToastConfirm();

  const [mode, setMode] = useState<Mode>('none');
  const [busy, setBusy] = useState(false);

  const [flat, setFlat] = useState<FlatOption | null>(null);
  const [vehicleId, setVehicleId] = useState('');
  const [kind, setKind] = useState<AllocationKind>('PERMANENT');
  const [chargeable, setChargeable] = useState(true);
  const [reason, setReason] = useState('');
  const [nextStatus, setNextStatus] = useState<SlotStatus>('RESERVED');

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [history, setHistory] = useState<Allocation[] | null>(null);

  // Fresh panel every time. A flat left selected from the last slot is how
  // somebody gives B1-15 to the flat they were looking at two clicks ago.
  useEffect(() => {
    setMode('none'); setFlat(null); setVehicleId(''); setKind('PERMANENT');
    setChargeable(true); setReason(''); setNextStatus('RESERVED'); setHistory(null);
  }, [slot?._id]);

  /**
   * The society's registered cars, when this reader is allowed them.
   *
   * The vehicle register lives behind the gate's permission, and plenty of
   * parking managers do not hold it. A 403 here means the picker simply is not
   * offered — attaching a car to an allocation is optional in the API too.
   */
  useEffect(() => {
    if (!canManage) return;
    api.get('/visitors/vehicles')
      .then(r => setVehicles(r.data?.data || []))
      .catch(() => setVehicles([]));
  }, [canManage]);

  const loadHistory = useCallback(async () => {
    if (!slot) return;
    try {
      const r = await api.get(`/parking/allocations?zoneId=${zoneId}`);
      const rows: Allocation[] = r.data?.data || [];
      setHistory(rows.filter(a => String(a.slotId) === slot._id));
    } catch (e: any) {
      showToast(apiMessage(e, 'Could not load this slot’s history'), 'error');
      setHistory([]);
    }
  }, [slot, zoneId, showToast]);

  const run = async (fn: () => Promise<any>, done: string) => {
    setBusy(true);
    try {
      const res = await fn();
      showToast(res?.data?.message || done, 'success');
      setMode('none');
      onChanged();
      onClose();
    } catch (e: any) {
      showToast(apiMessage(e, 'That did not go through'), 'error');
    } finally { setBusy(false); }
  };

  const allocate = () => {
    if (!flat) return showToast('Which flat is it for?', 'error');
    run(() => api.post('/parking/allocations', {
      slotId: slot!._id, flatId: flat._id, kind, chargeable,
      vehicleId: vehicleId || undefined,
    }), 'Slot given.');
  };

  const release = () => run(
    () => api.post(`/parking/allocations/${slot!.holder!.allocationId}/release`, {
      reason: reason.trim() || undefined,
    }),
    'Slot taken back.',
  );

  const transfer = () => {
    if (!flat) return showToast('Which flat is it moving to?', 'error');
    run(() => api.post(`/parking/allocations/${slot!.holder!.allocationId}/transfer`, {
      toFlatId: flat._id, reason: reason.trim() || undefined,
    }), 'Moved.');
  };

  const setStatus = () => run(
    () => api.patch(`/parking/slots/${slot!._id}`, { status: nextStatus }),
    'Saved.',
  );

  const t = slot ? tokenFor(slot.status) : null;
  const held = !!slot?.holder;

  const vehiclesForFlat = flat ? vehicles.filter(v => String(v.flatId) === flat._id) : [];

  return (
    <Drawer
      anchor={isPhone ? 'bottom' : 'right'}
      open={!!slot}
      onClose={busy ? undefined : onClose}
      slotProps={{
        paper: {
          sx: isPhone
            ? { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88vh' }
            : { width: 400, maxWidth: '100vw' },
        },
      }}
    >
      {slot && (
        <div className="flex flex-col h-full">
          <div className="flex items-start justify-between gap-3 p-4 pb-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{zoneName}</p>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">{slot.code}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Row {slot.row}, column {slot.col} · {VEHICLE_KIND_LABEL[slot.vehicleKind]} · {SIZE_LABEL[slot.size]}
              </p>
            </div>
            <IconButton size="small" onClick={onClose} disabled={busy} aria-label="Close">
              <X className="w-4.5 h-4.5 text-slate-400" />
            </IconButton>
          </div>

          <div className="px-4 pb-6 overflow-y-auto flex-1 space-y-4">
            <SlotCard slot={slot} canSeeHolders={canSeeHolders} />

            {!canManage && (
              <p className="text-xs text-slate-500 leading-relaxed">
                {t?.hint} Ask the society office if you would like this slot.
              </p>
            )}

            {/* ------------------------------------------------ what you can do */}
            {canManage && mode === 'none' && (
              <div className="space-y-2">
                <SectionHeading>What would you like to do</SectionHeading>
                {!held && slot.status !== 'BLOCKED' && slot.status !== 'OUT_OF_SERVICE' && (
                  <Button fullWidth variant="contained" startIcon={<CarFront className="w-4 h-4" />}
                    onClick={() => setMode('allocate')}>
                    Give this slot to a flat
                  </Button>
                )}
                {held && (
                  <>
                    <Button fullWidth variant="outlined" startIcon={<Undo2 className="w-4 h-4" />}
                      onClick={() => setMode('release')}>
                      Take the slot back
                    </Button>
                    <Button fullWidth variant="outlined" startIcon={<ArrowLeftRight className="w-4 h-4" />}
                      onClick={() => setMode('transfer')}>
                      Move it to another flat
                    </Button>
                  </>
                )}
                {!held && (
                  <Button fullWidth variant="outlined" startIcon={<Wrench className="w-4 h-4" />}
                    onClick={() => { setNextStatus(slot.status === 'AVAILABLE' ? 'RESERVED' : 'AVAILABLE'); setMode('status'); }}>
                    Change what this slot is for
                  </Button>
                )}
                {held && (
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    A slot that a flat holds cannot be marked out of use. Take it back first —
                    the flat stops being billed for it in the same step.
                  </p>
                )}
              </div>
            )}

            {/* ------------------------------------------------------- allocate */}
            {canManage && mode === 'allocate' && (
              <div className="space-y-3">
                <SectionHeading hint="The flat's bill counts the slots it holds, so this changes what they pay from the next bill.">
                  Give a parking slot
                </SectionHeading>
                <Autocomplete
                  size="small" options={flats} value={flat}
                  getOptionLabel={flatLabelOf}
                  isOptionEqualToValue={(a, b) => a._id === b._id}
                  onChange={(_, v) => { setFlat(v); setVehicleId(''); }}
                  renderInput={p => <TextField {...p} label="Which flat" placeholder="Search a flat" />}
                />
                {vehiclesForFlat.length > 0 && (
                  <FormControl fullWidth size="small">
                    <InputLabel>Which car (optional)</InputLabel>
                    <Select label="Which car (optional)" value={vehicleId}
                      onChange={e => setVehicleId(e.target.value)}>
                      <MenuItem value="">Not saying</MenuItem>
                      {vehiclesForFlat.map(v => (
                        <MenuItem key={v._id} value={v._id}>{v.displayNumber}{v.make ? ` · ${v.make}` : ''}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                <FormControl fullWidth size="small">
                  <InputLabel>For how long</InputLabel>
                  <Select label="For how long" value={kind} onChange={e => setKind(e.target.value as AllocationKind)}>
                    {(Object.keys(ALLOCATION_KIND_LABEL) as AllocationKind[]).map(k => (
                      <MenuItem key={k} value={k}>{ALLOCATION_KIND_LABEL[k]}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={<Switch checked={chargeable} onChange={e => setChargeable(e.target.checked)} />}
                  label={<span className="text-sm">Charge the flat for it</span>}
                />
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Turn this off for a slot the society gives free — a watchman’s bay, or the first
                  slot when only the second one is charged.
                </p>
                <ActionBar busy={busy} confirm="Give the slot" onConfirm={allocate} onBack={() => setMode('none')} />
              </div>
            )}

            {/* -------------------------------------------------------- release */}
            {canManage && mode === 'release' && slot.holder && (
              <div className="space-y-3">
                <SectionHeading hint="Nothing is deleted. The record of who held it stays, and the flat stops being billed for it.">
                  Take the slot back
                </SectionHeading>
                <TextField fullWidth size="small" label="Why (optional)" value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Sold the car, moved out, swapped with B1-20" />
                <ActionBar busy={busy} confirm="Take it back" onConfirm={release} onBack={() => setMode('none')} />
              </div>
            )}

            {/* ------------------------------------------------------- transfer */}
            {canManage && mode === 'transfer' && slot.holder && (
              <div className="space-y-3">
                <SectionHeading hint="The flat losing it stops being billed and the flat gaining it starts, in the same step.">
                  Move this slot to another flat
                </SectionHeading>
                <Autocomplete
                  size="small" options={flats} value={flat}
                  getOptionLabel={flatLabelOf}
                  isOptionEqualToValue={(a, b) => a._id === b._id}
                  onChange={(_, v) => setFlat(v)}
                  renderInput={p => <TextField {...p} label="Moving to" placeholder="Search a flat" />}
                />
                <TextField fullWidth size="small" label="Why (optional)" value={reason}
                  onChange={e => setReason(e.target.value)} placeholder="Flat sold, slot swapped" />
                <ActionBar busy={busy} confirm="Move it" onConfirm={transfer} onBack={() => setMode('none')} />
              </div>
            )}

            {/* ---------------------------------------------------------- status */}
            {canManage && mode === 'status' && (
              <div className="space-y-3">
                <SectionHeading hint="Use this for a bay with a pillar in it, one kept for the fire tender, or one held for guests.">
                  What is this slot for
                </SectionHeading>
                <div className="space-y-1.5">
                  {SETTABLE_STATUSES.map(s => {
                    const tok = tokenFor(s);
                    const on = nextStatus === s;
                    return (
                      <Box key={s} component="button" type="button" onClick={() => setNextStatus(s)}
                        sx={{
                          width: '100%', textAlign: 'left', p: 1.25, borderRadius: '12px', cursor: 'pointer',
                          border: `1.5px solid ${on ? '#0a5bd7' : '#e2e8f0'}`,
                          bgcolor: on ? 'rgba(10,91,215,0.04)' : '#fff',
                          display: 'flex', alignItems: 'flex-start', gap: 1.25,
                        }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: tok.dot, mt: '4px', flexShrink: 0 }} />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-slate-800">{tok.label}</span>
                          <span className="block text-[11px] text-slate-500 leading-snug">{tok.hint}</span>
                        </span>
                        {on && <Check className="w-4 h-4 text-[#0a5bd7] shrink-0" />}
                      </Box>
                    );
                  })}
                </div>
                <ActionBar busy={busy} confirm="Save" onConfirm={setStatus} onBack={() => setMode('none')} />
              </div>
            )}

            {/* --------------------------------------------------------- history */}
            {mode === 'none' && (
              <>
                <Divider />
                {history === null ? (
                  <Button size="small" startIcon={<History className="w-4 h-4" />} onClick={loadHistory}>
                    Who has parked here before
                  </Button>
                ) : history.length === 0 ? (
                  <p className="text-xs text-slate-400">No flat has ever held this slot.</p>
                ) : (
                  <div className="space-y-2">
                    <SectionHeading>Who has parked here</SectionHeading>
                    {history.map(a => (
                      <div key={a._id} className="rounded-xl border border-slate-200/70 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-800">{a.flatLabel || 'A flat'}</span>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                            {a.status === 'ACTIVE' ? 'Now' : 'Before'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {fmtDate(a.startDate)} — {a.endDate ? fmtDate(a.endDate) : 'still theirs'}
                        </p>
                        {a.endReason && <p className="text-[11px] text-slate-400 italic">{a.endReason}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function ActionBar({ busy, confirm, onConfirm, onBack }: {
  busy: boolean; confirm: string; onConfirm: () => void; onBack: () => void;
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Button onClick={onBack} disabled={busy} color="inherit" size="small">Back</Button>
      <div className="flex-1" />
      <Button variant="contained" onClick={onConfirm} disabled={busy}>
        {busy ? 'Working…' : confirm}
      </Button>
    </div>
  );
}
