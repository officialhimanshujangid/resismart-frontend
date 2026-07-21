'use client';

import React, { useEffect, useState } from 'react';
import { FormControl, InputLabel, MenuItem, Select, TextField, Button } from '@mui/material';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import AppDialog from '@/components/common/AppDialog';
import { Zone, ZoneKind, ZONE_KIND_LABEL, apiMessage } from './parking-types';

/**
 * A parking area — the thing you draw a map of.
 *
 * `rows`/`cols` is the size of the sheet of paper, not a claim that every cell
 * has a bay in it: most of a real basement is aisle. It is asked for here
 * because without it a society with one slot at row 40 gets forty rows of
 * nothing, and because the bulk wizard needs to know when a block of slots will
 * not fit before it writes any of them.
 */

export default function ZoneDialog({
  open, zone, onClose, onSaved,
}: {
  open: boolean;
  /** Null to add a new one. */
  zone: Zone | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast, confirm } = useToastConfirm();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '', kind: 'BASEMENT' as ZoneKind, levelIndex: '0', rows: '10', cols: '10',
  });

  useEffect(() => {
    if (!open) return;
    setForm(zone
      ? {
        name: zone.name, kind: zone.kind, levelIndex: String(zone.levelIndex ?? 0),
        rows: String(zone.layout?.rows ?? 10), cols: String(zone.layout?.cols ?? 10),
      }
      : { name: '', kind: 'BASEMENT', levelIndex: '0', rows: '10', cols: '10' });
  }, [open, zone]);

  const save = async () => {
    if (!form.name.trim()) return showToast('Give the area a name — “Basement 1”, “Open compound”.', 'error');
    const rows = parseInt(form.rows, 10);
    const cols = parseInt(form.cols, 10);
    if (!rows || !cols || rows < 1 || cols < 1) return showToast('How big is it? Rows and columns must be at least 1.', 'error');

    setBusy(true);
    try {
      const body = {
        name: form.name.trim(), kind: form.kind,
        levelIndex: parseInt(form.levelIndex, 10) || 0,
        rows, cols,
      };
      const res = zone
        ? await api.put(`/parking/zones/${zone._id}`, body)
        : await api.post('/parking/zones', body);
      showToast(res.data?.message || 'Saved.', 'success');
      onSaved();
      onClose();
    } catch (e: any) {
      showToast(apiMessage(e, 'Could not save that parking area'), 'error');
    } finally { setBusy(false); }
  };

  const retire = async () => {
    if (!zone) return;
    if (!(await confirm({
      title: `Stop using ${zone.name}?`,
      message: 'Nothing is deleted. The slots and the record of who parked where are kept, and the area comes back if you switch it on again.',
      confirmText: 'Stop using it',
      severity: 'warning',
    }))) return;
    setBusy(true);
    try {
      await api.put(`/parking/zones/${zone._id}`, { isActive: false });
      showToast(`${zone.name} is no longer in use.`, 'success');
      onSaved();
      onClose();
    } catch (e: any) {
      showToast(apiMessage(e, 'Could not do that'), 'error');
    } finally { setBusy(false); }
  };

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      busy={busy}
      maxWidth="xs"
      title={zone ? `Edit ${zone.name}` : 'Add a parking area'}
      subtitle={zone ? undefined : 'A level, a basement or the open compound — whatever your society already calls it.'}
      confirmText={zone ? 'Save' : 'Add it'}
      onConfirm={save}
      extraActions={zone && zone.isActive
        ? <Button color="error" size="small" onClick={retire} disabled={busy}>Stop using it</Button>
        : undefined}
    >
      <TextField autoFocus fullWidth size="small" label="Name" value={form.name}
        onChange={e => setForm({ ...form, name: e.target.value })}
        placeholder="Basement 1" />

      <FormControl fullWidth size="small">
        <InputLabel>What kind of parking</InputLabel>
        <Select label="What kind of parking" value={form.kind}
          onChange={e => setForm({ ...form, kind: e.target.value as ZoneKind })}>
          {(Object.keys(ZONE_KIND_LABEL) as ZoneKind[]).map(k => (
            <MenuItem key={k} value={k}>{ZONE_KIND_LABEL[k]}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField fullWidth size="small" type="number" label="Which level" value={form.levelIndex}
        onChange={e => setForm({ ...form, levelIndex: e.target.value })}
        helperText="0 for the ground, −1 for the first basement. This is only what order the areas appear in." />

      <div className="flex gap-2">
        <TextField fullWidth size="small" type="number" label="Rows" value={form.rows}
          onChange={e => setForm({ ...form, rows: e.target.value })} />
        <TextField fullWidth size="small" type="number" label="Columns" value={form.cols}
          onChange={e => setForm({ ...form, cols: e.target.value })} />
      </div>
      <p className="text-[11px] text-slate-400 leading-relaxed -mt-2">
        How big the drawing is, not how many slots there are. Most of a real basement is aisle,
        so leave room — you can make it bigger later, but not smaller than the slots already on it.
      </p>
    </AppDialog>
  );
}
