'use client';

import React, { useMemo, useState } from 'react';
import {
  Box, Button, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Step, StepLabel,
  Stepper, Switch, TextField,
} from '@mui/material';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import AppDialog from '@/components/common/AppDialog';
import {
  SlotSize, SlotVehicleKind, VEHICLE_KIND_LABEL, SIZE_LABEL, Zone, apiMessage, SLOT_TOKENS,
} from './parking-types';

/**
 * A whole level in one step.
 *
 * Nobody hand-creates two hundred slots, and a module that asks them to is a
 * module whose inventory stays empty — which is exactly how a twenty-character
 * free-text slot label survived this long. The wizard is not a convenience; it
 * is the thing that makes the rest of the module reachable.
 *
 * The preview is the point of the third step: a person can see the codes and
 * the shape they will make BEFORE anything is written, because the API refuses
 * a partial run and a society that guessed wrong has 200 rows to unpick.
 */

const MAX = 500;

const STEPS = ['What they are called', 'Where they sit', 'What goes in them'];

export default function BulkSlotWizard({
  open, zones, defaultZoneId, onClose, onCreated,
}: {
  open: boolean;
  zones: Zone[];
  defaultZoneId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { showToast } = useToastConfirm();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const [zoneId, setZoneId] = useState(defaultZoneId || zones[0]?._id || '');
  const [prefix, setPrefix] = useState('B1-');
  const [startNumber, setStartNumber] = useState('1');
  const [count, setCount] = useState('20');
  const [pad, setPad] = useState(true);

  const [startRow, setStartRow] = useState('1');
  const [startCol, setStartCol] = useState('1');
  const [perRow, setPerRow] = useState('');

  const [vehicleKind, setVehicleKind] = useState<SlotVehicleKind>('CAR');
  const [size, setSize] = useState<SlotSize>('STANDARD');
  const [isAccessible, setIsAccessible] = useState(false);
  const [hasEvCharger, setHasEvCharger] = useState(false);

  // Reopened fresh, so a run that failed does not silently reuse a number range
  // the API has already refused.
  React.useEffect(() => {
    if (!open) return;
    setStep(0);
    setZoneId(defaultZoneId || zones[0]?._id || '');
  }, [open, defaultZoneId, zones]);

  const zone = zones.find(z => z._id === zoneId);

  /**
   * The same arithmetic the service does, run here so the preview cannot
   * disagree with what gets written. Kept deliberately close to
   * `bulkCreateSlots`: prefix + padded number, wrapping every `perRow`.
   */
  const plan = useMemo(() => {
    const n = Math.max(0, Math.min(MAX, parseInt(count, 10) || 0));
    const from = parseInt(startNumber, 10) || 0;
    const cols = zone?.layout?.cols || 10;
    const rows = zone?.layout?.rows || 10;
    const wrapAt = Math.max(1, Math.min(parseInt(perRow, 10) || cols, cols));
    const sr = Math.max(1, parseInt(startRow, 10) || 1);
    const sc = Math.max(1, parseInt(startCol, 10) || 1);
    const width = pad ? String(from + n - 1).length : 1;
    const clean = prefix.trim().toUpperCase();

    const cells = Array.from({ length: n }, (_, i) => {
      const offset = (sc - 1) + i;
      return {
        code: `${clean}${String(from + i).padStart(width, '0')}`,
        row: sr + Math.floor(offset / wrapAt),
        col: (offset % wrapAt) + 1,
      };
    });

    const lastRow = cells.length ? Math.max(...cells.map(c => c.row)) : sr;
    const fits = cells.every(c => c.row <= rows && c.col <= cols);

    return { cells, n, lastRow, fits, rows, cols, firstRow: sr };
  }, [count, startNumber, prefix, pad, perRow, startRow, startCol, zone]);

  const create = async () => {
    if (!zoneId) return showToast('Which area are these in?', 'error');
    if (!prefix.trim()) return showToast('What do the slots start with? “B1-”, “S-”, “P”.', 'error');
    if (plan.n < 1) return showToast('How many slots? Enter at least one.', 'error');
    if (!plan.fits) return showToast(`They do not fit in a ${plan.rows} × ${plan.cols} area. Make the area bigger, or create fewer.`, 'error');

    setBusy(true);
    try {
      const res = await api.post('/parking/slots/bulk', {
        zoneId,
        prefix: prefix.trim().toUpperCase(),
        startNumber: parseInt(startNumber, 10) || 1,
        count: plan.n,
        padTo: pad ? String((parseInt(startNumber, 10) || 1) + plan.n - 1).length : 1,
        startRow: parseInt(startRow, 10) || 1,
        startCol: parseInt(startCol, 10) || 1,
        perRow: parseInt(perRow, 10) || undefined,
        vehicleKind, size, isAccessible, hasEvCharger,
      });
      showToast(res.data?.message || `${plan.n} slots created.`, 'success');
      onCreated();
      onClose();
    } catch (e: any) {
      showToast(apiMessage(e, 'Could not create those slots'), 'error');
    } finally { setBusy(false); }
  };

  const last = step === STEPS.length - 1;

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      busy={busy}
      maxWidth="sm"
      title="Create a lot of slots at once"
      subtitle="Nobody types two hundred bays by hand. Say what they are called and where they sit, and they are all drawn in one go."
      confirmText={last ? `Create ${plan.n} slots` : 'Next'}
      confirmDisabled={last && (!plan.fits || plan.n < 1)}
      onConfirm={last ? create : () => setStep(s => s + 1)}
      extraActions={step > 0
        ? <Button size="small" color="inherit" onClick={() => setStep(s => s - 1)} disabled={busy}>Back</Button>
        : undefined}
    >
      <Stepper activeStep={step} alternativeLabel sx={{ mb: 1 }}>
        {STEPS.map(s => <Step key={s}><StepLabel sx={{ '& .MuiStepLabel-label': { fontSize: 11, fontWeight: 700 } }}>{s}</StepLabel></Step>)}
      </Stepper>

      {/* ---------------------------------------------------------- step one */}
      {step === 0 && (
        <>
          <FormControl fullWidth size="small">
            <InputLabel>Which area</InputLabel>
            <Select label="Which area" value={zoneId} onChange={e => setZoneId(e.target.value)}>
              {zones.map(z => (
                <MenuItem key={z._id} value={z._id}>
                  {z.name} · {z.layout?.rows} × {z.layout?.cols}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField fullWidth size="small" label="What they start with" value={prefix}
            onChange={e => setPrefix(e.target.value)} placeholder="B1-"
            helperText="Whatever is painted on the floor. “B1-”, “S-”, “P”." />

          <div className="flex gap-2">
            <TextField fullWidth size="small" type="number" label="First number" value={startNumber}
              onChange={e => setStartNumber(e.target.value)} />
            <TextField fullWidth size="small" type="number" label="How many" value={count}
              onChange={e => setCount(e.target.value)} helperText={`Up to ${MAX} at a time`} />
          </div>

          <FormControlLabel
            control={<Switch checked={pad} onChange={e => setPad(e.target.checked)} />}
            label={<span className="text-sm">Write them as B1-01, not B1-1</span>}
          />
          <p className="text-[11px] text-slate-400 -mt-2 leading-relaxed">
            Keeps the list in the order a person reads it — B1-09 before B1-10, instead of after it.
          </p>
        </>
      )}

      {/* ---------------------------------------------------------- step two */}
      {step === 1 && (
        <>
          <p className="text-xs text-slate-500 leading-relaxed">
            {zone ? `${zone.name} is ${zone.layout?.rows} rows deep and ${zone.layout?.cols} columns wide.` : ''}
            {' '}Say where this block of bays starts and how many sit side by side before the next row.
            Leave the aisles empty — the drawing matches the floor because most of it has nothing on it.
          </p>
          <div className="flex gap-2">
            <TextField fullWidth size="small" type="number" label="Starting row" value={startRow}
              onChange={e => setStartRow(e.target.value)} />
            <TextField fullWidth size="small" type="number" label="Starting column" value={startCol}
              onChange={e => setStartCol(e.target.value)} />
          </div>
          <TextField fullWidth size="small" type="number" label="How many side by side" value={perRow}
            onChange={e => setPerRow(e.target.value)}
            placeholder={String(zone?.layout?.cols || 10)}
            helperText="Leave empty to fill the whole width of the area." />

          <Preview plan={plan} />
        </>
      )}

      {/* -------------------------------------------------------- step three */}
      {step === 2 && (
        <>
          <div className="flex gap-2">
            <FormControl fullWidth size="small">
              <InputLabel>What parks here</InputLabel>
              <Select label="What parks here" value={vehicleKind}
                onChange={e => setVehicleKind(e.target.value as SlotVehicleKind)}>
                {(Object.keys(VEHICLE_KIND_LABEL) as SlotVehicleKind[]).map(k => (
                  <MenuItem key={k} value={k}>{VEHICLE_KIND_LABEL[k]}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>How big</InputLabel>
              <Select label="How big" value={size} onChange={e => setSize(e.target.value as SlotSize)}>
                {(Object.keys(SIZE_LABEL) as SlotSize[]).map(k => (
                  <MenuItem key={k} value={k}>{SIZE_LABEL[k]}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </div>
          <p className="text-[11px] text-slate-400 -mt-2 leading-relaxed">
            Two-wheeler bays can be billed at their own rate. Everything else is billed as a car slot.
          </p>

          <FormControlLabel
            control={<Switch checked={isAccessible} onChange={e => setIsAccessible(e.target.checked)} />}
            label={<span className="text-sm">Easy to reach — near the lift or the ramp</span>} />
          <FormControlLabel
            control={<Switch checked={hasEvCharger} onChange={e => setHasEvCharger(e.target.checked)} />}
            label={<span className="text-sm">Has a charging point</span>} />

          <Preview plan={plan} />
        </>
      )}
    </AppDialog>
  );
}

/** What is about to be written, before it is written. */
function Preview({ plan }: { plan: { cells: { code: string; row: number; col: number }[]; n: number; lastRow: number; fits: boolean; rows: number; cols: number; firstRow: number } }) {
  const first = plan.cells[0];
  const last = plan.cells[plan.cells.length - 1];

  return (
    <Box sx={{
      borderRadius: '14px', p: 2,
      border: `1px solid ${plan.fits ? '#e2e8f0' : '#fda4af'}`,
      bgcolor: plan.fits ? '#f8fafc' : '#fff1f2',
    }}>
      {plan.n < 1 || !first ? (
        <p className="text-xs text-slate-500">Nothing to create yet.</p>
      ) : !plan.fits ? (
        <p className="text-xs font-semibold text-rose-700 leading-relaxed">
          These would run past the edge — they need {plan.lastRow} rows and the area has {plan.rows}.
          Make the area bigger, start from a lower row, or create fewer.
        </p>
      ) : (
        <>
          <p className="text-xs font-bold text-slate-800">
            {plan.n} slots, {first.code} to {last.code}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Rows {plan.firstRow} to {plan.lastRow} of {plan.rows}.
          </p>
          {/* A miniature of the real map, so the shape is checked by eye. */}
          <Box sx={{
            mt: 1.5, display: 'grid', gap: '2px',
            gridTemplateColumns: `repeat(${plan.cols}, 1fr)`,
            gridTemplateRows: `repeat(${Math.min(plan.rows, plan.lastRow + 1)}, 8px)`,
          }}>
            {plan.cells.slice(0, 500).map(c => (
              <Box key={c.code} sx={{
                gridColumn: c.col, gridRow: c.row,
                bgcolor: SLOT_TOKENS.AVAILABLE.dot, borderRadius: '2px',
              }} />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
