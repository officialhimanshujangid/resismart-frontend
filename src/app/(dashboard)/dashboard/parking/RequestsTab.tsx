'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Autocomplete, Button, Chip, FormControl, FormControlLabel, MenuItem, Select, Switch, TextField,
} from '@mui/material';
import { ListChecks, Check, X } from 'lucide-react';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import AppDialog from '@/components/common/AppDialog';
import ErrorState from '@/components/common/ErrorState';
import {
  ParkingRequestRow, Slot, VEHICLE_KIND_LABEL, REQUEST_STATUS_LABEL, apiMessage, fmtDate, sinceWhen,
} from './parking-types';

/**
 * The waiting list.
 *
 * Every society with fewer slots than cars already has one — in a register, or
 * in the secretary's memory, which is the version that causes fights. The only
 * thing that makes a queue acceptable is that its order is visible and dated,
 * so the oldest ask is at the top and nothing here can reorder it.
 */

const TONE: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: '#fffbeb', color: '#92400e' },
  APPROVED: { bg: '#ecfdf5', color: '#047857' },
  REJECTED: { bg: '#fff1f2', color: '#be123c' },
  WITHDRAWN: { bg: '#f1f5f9', color: '#475569' },
};

export default function RequestsTab({
  canManage, status, onFilter, reloadKey, onChanged,
}: {
  canManage: boolean;
  status: string;
  onFilter: (patch: Record<string, string>) => void;
  reloadKey: number;
  onChanged: () => void;
}) {
  const { showToast, confirm } = useToastConfirm();
  const [rows, setRows] = useState<ParkingRequestRow[]>([]);
  const [free, setFree] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  const [deciding, setDeciding] = useState<{ row: ParkingRequestRow; decision: 'APPROVE' | 'REJECT' } | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [chargeable, setChargeable] = useState(true);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      const res = await api.get(`/parking/requests?${params}`);
      setRows(res.data?.data || []);
      setFailed(false);
    } catch (e: any) {
      setFailed(true);
      showToast(apiMessage(e, 'Could not load the waiting list'), 'error');
    } finally { setLoading(false); }
  }, [status, showToast]);

  useEffect(() => { load(); }, [load, reloadKey, tick]);

  // The slots that can actually be offered. Fetched once the screen opens so
  // approving is one dialog rather than a trip to the map and back.
  useEffect(() => {
    if (!canManage) return;
    api.get('/parking/slots?status=AVAILABLE')
      .then(r => setFree(r.data?.data || []))
      .catch(() => setFree([]));
  }, [canManage, reloadKey, tick]);

  const openDecide = (row: ParkingRequestRow, decision: 'APPROVE' | 'REJECT') => {
    setDeciding({ row, decision });
    // Offer a bay that suits what they asked for first — a two-wheeler request
    // pointed at a car bay is how a society ends up with a bike in a car slot
    // and a bill that says car.
    setSlot(free.find(s => s.vehicleKind === row.vehicleKind) || null);
    setChargeable(true);
    setNote('');
  };

  const decide = async () => {
    if (!deciding) return;
    if (deciding.decision === 'APPROVE' && !slot) return showToast('Pick the slot you are giving them.', 'error');
    if (deciding.decision === 'REJECT' && !note.trim()) {
      return showToast('Say why. They are told this, and “no” on its own is what starts arguments.', 'error');
    }
    setBusy(true);
    try {
      const res = await api.post(`/parking/requests/${deciding.row._id}/decide`, {
        decision: deciding.decision,
        slotId: deciding.decision === 'APPROVE' ? slot!._id : undefined,
        chargeable: deciding.decision === 'APPROVE' ? chargeable : undefined,
        note: note.trim() || undefined,
      });
      showToast(res.data?.message || 'Saved.', 'success');
      setDeciding(null);
      setTick(t => t + 1);
      onChanged();
    } catch (e: any) {
      showToast(apiMessage(e, 'Could not record that decision'), 'error');
    } finally { setBusy(false); }
  };

  const withdraw = async (row: ParkingRequestRow) => {
    if (!(await confirm({
      title: `Take ${row.flatLabel || 'this flat'} off the waiting list?`,
      message: 'They keep their place in the record but stop waiting. They can ask again later.',
      confirmText: 'Take them off',
      severity: 'warning',
    }))) return;
    try {
      await api.post(`/parking/requests/${row._id}/withdraw`, {});
      showToast('Taken off the waiting list.', 'success');
      setTick(t => t + 1);
    } catch (e: any) {
      showToast(apiMessage(e, 'Could not do that'), 'error');
    }
  };

  const columns: ColumnDef<ParkingRequestRow>[] = [
    {
      id: 'flat', label: 'Flat', alwaysVisible: true,
      sortValue: r => r.flatLabel || '', exportValue: r => r.flatLabel || '',
      render: r => (
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800">{r.flatLabel || '—'}</p>
          <p className="text-[11px] text-slate-400">asked by {r.requestedByName}</p>
        </div>
      ),
    },
    {
      id: 'kind', label: 'Asked for',
      sortValue: r => VEHICLE_KIND_LABEL[r.vehicleKind], exportValue: r => VEHICLE_KIND_LABEL[r.vehicleKind],
      render: r => <span className="text-sm text-slate-600">{VEHICLE_KIND_LABEL[r.vehicleKind]}</span>,
    },
    {
      id: 'queued', label: 'Waiting since', alwaysVisible: true,
      sortValue: r => r.queuedAt, exportValue: r => fmtDate(r.queuedAt),
      render: r => (
        <span className="text-xs text-slate-600">
          {fmtDate(r.queuedAt)}
          <span className="block text-[10px] text-slate-400">{sinceWhen(r.queuedAt)}</span>
        </span>
      ),
    },
    {
      id: 'note', label: 'What they said', defaultHidden: true,
      exportValue: r => r.note || '',
      render: r => <span className="text-xs text-slate-500">{r.note || '—'}</span>,
    },
    {
      id: 'status', label: 'Where it stands',
      sortValue: r => REQUEST_STATUS_LABEL[r.status] || r.status,
      exportValue: r => REQUEST_STATUS_LABEL[r.status] || r.status,
      render: r => (
        <div className="min-w-0">
          <Chip size="small" label={REQUEST_STATUS_LABEL[r.status] || r.status}
            sx={{ ...(TONE[r.status] || TONE.WITHDRAWN), fontWeight: 700 }} />
          {r.decisionNote && <p className="text-[10px] text-slate-400 mt-0.5 italic">{r.decisionNote}</p>}
        </div>
      ),
    },
    {
      id: 'decided', label: 'Decided by', defaultHidden: true,
      sortValue: r => r.decidedByName || '', exportValue: r => r.decidedByName || '',
      render: r => (
        <span className="text-[11px] text-slate-500">
          {r.decidedByName || '—'}
          {r.decidedAt && <span className="block">{fmtDate(r.decidedAt)}</span>}
        </span>
      ),
    },
  ];

  if (canManage) {
    columns.push({
      id: 'act', label: '', align: 'right', alwaysVisible: true,
      render: r => r.status !== 'PENDING'
        ? <span className="text-slate-300">—</span>
        : (
          <div className="flex items-center justify-end gap-1 flex-wrap">
            <Button size="small" variant="contained" startIcon={<Check className="w-3.5 h-3.5" />}
              onClick={() => openDecide(r, 'APPROVE')}>Give a slot</Button>
            <Button size="small" color="inherit" startIcon={<X className="w-3.5 h-3.5" />}
              onClick={() => openDecide(r, 'REJECT')}>Turn down</Button>
            <Button size="small" color="inherit" onClick={() => withdraw(r)}>Take off</Button>
          </div>
        ),
    });
  }

  if (failed && !loading) {
    return (
      <ErrorState
        title="The waiting list could not be loaded"
        message="Something went wrong reading who is waiting for a slot."
        onRetry={() => setTick(t => t + 1)}
      />
    );
  }

  const approving = deciding?.decision === 'APPROVE';

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        keyExtractor={r => r._id}
        exportFileName="parking-waiting-list"
        columnToggle
        emptyTitle="Nobody is waiting"
        emptyText="When a resident asks for a slot they appear here, oldest first, so the queue can be seen rather than remembered."
        emptyIcon={<ListChecks className="w-6 h-6" />}
        toolbar={
          <FormControl size="small" className="min-w-52">
            <Select displayEmpty value={status} onChange={e => onFilter({ status: e.target.value })}>
              <MenuItem value="">Everybody who has asked</MenuItem>
              <MenuItem value="PENDING">Still waiting</MenuItem>
              <MenuItem value="APPROVED">Given a slot</MenuItem>
              <MenuItem value="REJECTED">Turned down</MenuItem>
              <MenuItem value="WITHDRAWN">Taken off the list</MenuItem>
            </Select>
          </FormControl>
        }
      />

      <AppDialog
        open={!!deciding}
        onClose={() => setDeciding(null)}
        busy={busy}
        maxWidth="xs"
        title={approving ? 'Give them a slot' : 'Turn this down'}
        subtitle={deciding
          ? `${deciding.row.flatLabel || 'This flat'} · asked for a ${VEHICLE_KIND_LABEL[deciding.row.vehicleKind].toLowerCase()} slot ${sinceWhen(deciding.row.queuedAt)}`
          : undefined}
        confirmText={approving ? 'Give the slot' : 'Turn it down'}
        confirmColor={approving ? 'primary' : 'warning'}
        onConfirm={decide}
      >
        {approving ? (
          <>
            <Autocomplete
              size="small" options={free} value={slot}
              getOptionLabel={s => `${s.code} · ${s.zoneName || ''} · ${VEHICLE_KIND_LABEL[s.vehicleKind]}`}
              isOptionEqualToValue={(a, b) => a._id === b._id}
              onChange={(_, v) => setSlot(v)}
              renderInput={p => <TextField {...p} label="Which slot" placeholder="Search a free slot" />}
              noOptionsText="No free slots. Take one back first, or create more."
            />
            <FormControlLabel
              control={<Switch checked={chargeable} onChange={e => setChargeable(e.target.checked)} />}
              label={<span className="text-sm">Charge the flat for it</span>} />
            <TextField fullWidth size="small" label="Anything to tell them (optional)" value={note}
              onChange={e => setNote(e.target.value)} />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              The slot is given and the waiting list is updated in one step, so nobody is ever told
              they have parking that turns out to belong to somebody else.
            </p>
          </>
        ) : (
          <>
            <TextField fullWidth size="small" multiline minRows={2} label="Why" value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="No car slots free until the second basement opens in March" />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              They are told this. “No” on its own is what starts arguments at the AGM.
            </p>
          </>
        )}
      </AppDialog>
    </>
  );
}
