'use client';

import React, { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Chip,
} from '@mui/material';
import { Plus, Ticket, Share2, Ban, TriangleAlert, Copy, Download } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import PageHeader from '@/components/common/PageHeader';
import QRCode from 'qrcode';

/**
 * Invitations a resident makes before their guest arrives.
 *
 * The share text carries the six-digit code as well as the link, on purpose:
 * the guest may be at the gate with no signal, and a code they can read aloud
 * works when nothing else does.
 */

interface Pass {
  _id: string; visitorName: string; visitorPhone?: string; category: string;
  code: string; qrPayload: string; flatLabel?: string;
  validFrom: string; validTo: string;
  maxUses: number; usedCount: number; status: string;
  overUsedAt?: string; overUseNote?: string;
}

const CATEGORIES = [
  { v: 'GUEST', l: 'Guest' }, { v: 'DELIVERY', l: 'Delivery' }, { v: 'CAB', l: 'Cab' },
  { v: 'HOUSEHOLD_STAFF', l: 'Household staff' }, { v: 'CONTRACTOR', l: 'Contractor' },
  { v: 'OTHER', l: 'Someone else' },
];

const localInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function GatePassesPage() {
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Pass[]>([]);
  const [flatIds, setFlatIds] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ category: 'GUEST', maxUses: 1 });
  const [share, setShare] = useState<Pass | null>(null);
  const [qr, setQr] = useState('');

  const load = useCallback(async () => {
    try {
      const [passRes, prefRes] = await Promise.all([
        api.get(`/gate/passes?all=${showAll}`),
        api.get('/gate/preferences'),
      ]);
      setRows(passRes.data?.data || []);
      setFlatIds(prefRes.data?.data?.flatIds || []);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not load passes', 'error');
    } finally { setLoading(false); }
  }, [showAll, showToast]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setSaving(true);
    try {
      const res = await api.post('/gate/passes', {
        ...form,
        flatId: form.flatId || flatIds[0],
        maxUses: Number(form.maxUses) || 1,
        validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : undefined,
        validTo: form.validTo ? new Date(form.validTo).toISOString() : undefined,
      });
      showToast(res.data?.message || 'Pass ready', 'success');
      setOpen(false);
      setForm({ category: 'GUEST', maxUses: 1 });
      await load();
      openShare(res.data.data);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not create that pass', 'error');
    } finally { setSaving(false); }
  };

  const openShare = async (p: Pass) => {
    setShare(p);
    setQr(await QRCode.toDataURL(p.qrPayload, { width: 320, margin: 1, errorCorrectionLevel: 'M' }));
  };

  const shareText = (p: Pass) =>
    `You are invited to ${p.flatLabel || 'our flat'}.\n\n`
    + `Gate code: ${p.code}\n`
    + `Valid until ${new Date(p.validTo).toLocaleString('en-IN')}\n\n`
    + `Show the QR or read out the code at the gate.`;

  /** The QR as a real PNG file, so it can be sent rather than only looked at. */
  const qrFile = async (p: Pass): Promise<File | null> => {
    try {
      const dataUrl = qr || await QRCode.toDataURL(p.qrPayload, { width: 640, margin: 2, errorCorrectionLevel: 'M' });
      const blob = await (await fetch(dataUrl)).blob();
      return new File([blob], `gate-pass-${p.code}.png`, { type: 'image/png' });
    } catch { return null; }
  };

  /**
   * Send the invitation — with the QR image, not only the code.
   *
   * Sharing used to send text alone, which meant the guest received a six-digit
   * number and the QR they were told to show existed only on the resident's own
   * screen. At the gate they then had to read the code aloud every time, and
   * the scanner — the whole reason the pass has crypto on it — was never used.
   *
   * Web Share Level 2 carries files, but not everywhere: `canShare` is the only
   * honest test, and where it says no the image is downloaded so it can still
   * be attached to WhatsApp by hand.
   */
  const doShare = async (p: Pass) => {
    const text = shareText(p);
    const file = await qrFile(p);

    // The Web Share sheet is the right thing on a phone and simply does not
    // exist on most desktops — the clipboard is not a lesser fallback, it is
    // what a desktop user wanted anyway.
    if (file && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ title: 'Gate pass', text, files: [file] }); return; }
      catch { /* cancelled, or the sheet refused the file — fall through */ }
    }
    if (navigator.share) {
      try { await navigator.share({ title: 'Gate pass', text }); }
      catch { /* cancelled */ }
      // Even when only the text went, hand over the image so it can be attached.
      if (file) saveQr(file);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      if (file) saveQr(file);
      showToast('Copied, and the QR saved — paste the text and attach the image', 'success');
    } catch {
      showToast('Could not copy. Long-press the code to select it.', 'error');
    }
  };

  const saveQr = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name; a.click();
    URL.revokeObjectURL(url);
  };

  const cancel = async (p: Pass) => {
    try {
      const res = await api.post(`/gate/passes/${p._id}/revoke`, {});
      showToast(res.data?.message || 'Cancelled', 'success');
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not cancel that', 'error');
    }
  };

  const passColumns: ColumnDef<Pass>[] = [
    {
      id: 'visitor', label: 'Who is coming', alwaysVisible: true,
      sortValue: p => p.visitorName,
      exportValue: p => p.visitorName,
      render: p => (
        <div className="min-w-0">
          <p className="font-bold text-slate-800 truncate">{p.visitorName}</p>
          <p className="text-[11px] text-slate-400">
            {CATEGORIES.find(c => c.v === p.category)?.l || p.category}
            {p.flatLabel && ` · ${p.flatLabel}`}
          </p>
        </div>
      ),
    },
    {
      id: 'code', label: 'Code', alwaysVisible: true,
      sortValue: p => p.code,
      exportValue: p => p.code,
      render: p => <span className="font-mono font-black text-slate-800 tracking-widest text-sm">{p.code}</span>,
    },
    {
      id: 'validTo', label: 'Good until',
      sortValue: p => p.validTo,
      exportValue: p => new Date(p.validTo).toLocaleString('en-IN'),
      render: p => {
        const gone = new Date(p.validTo) < new Date();
        return (
          <span className={`text-[11px] font-semibold ${gone ? 'text-slate-400' : 'text-slate-600'}`}>
            {new Date(p.validTo).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        );
      },
    },
    {
      id: 'uses', label: 'Used', align: 'center',
      sortValue: p => p.usedCount,
      exportValue: p => `${p.usedCount}/${p.maxUses}`,
      render: p => (
        <span className="text-sm text-slate-600 tabular-nums">
          {p.usedCount}{p.maxUses > 1 && <span className="text-slate-400">/{p.maxUses}</span>}
        </span>
      ),
    },
    {
      id: 'status', label: 'Status',
      sortValue: p => p.status,
      exportValue: p => p.status.toLowerCase(),
      render: p => (
        <div className="min-w-0">
          <Chip size="small" label={p.status.toLowerCase()}
            className={`!font-bold !text-[10px] ${
              p.status === 'ACTIVE' ? '!bg-emerald-50 !text-emerald-700' : '!bg-slate-100 !text-slate-600'}`} />
          {p.overUsedAt && (
            <p className="text-[11px] text-amber-700 mt-0.5 flex items-start gap-1">
              <TriangleAlert className="w-3 h-3 shrink-0 mt-px" />{p.overUseNote}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'act', label: '', align: 'right', alwaysVisible: true,
      render: p => p.status === 'ACTIVE' ? (
        <div className="flex items-center justify-end gap-1">
          <Button size="small" variant="outlined" startIcon={<Share2 className="w-3.5 h-3.5" />}
            onClick={() => openShare(p)} className="!rounded-xl !normal-case !font-bold !text-xs">
            Share
          </Button>
          <Button size="small" color="error" startIcon={<Ban className="w-3.5 h-3.5" />}
            onClick={() => cancel(p)} className="!rounded-xl !normal-case !font-bold !text-xs">
            Cancel
          </Button>
        </div>
      ) : null,
    },
  ];

  if (loading) return <div className="flex justify-center py-24"><CircularProgress /></div>;

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        breadcrumb="Operations · Gate"
        title="Gate passes"
        icon={<Ticket className="w-4.5 h-4.5" />}
        subtitle="Invite someone before they arrive. The guard scans or types the code — nobody has to call you."
        actions={
          <Button variant="contained" startIcon={<Plus className="w-4 h-4" />} onClick={() => setOpen(true)}
            disabled={!flatIds.length} className="!rounded-xl !normal-case !font-bold">
            Invite someone
          </Button>
        }
      />

      <DataTable
        columns={passColumns}
        data={rows}
        keyExtractor={p => p._id}
        exportFileName="gate-passes"
        columnToggle
        emptyTitle="No passes yet"
        emptyText={flatIds.length
          ? 'Invite a guest and they will be let in without a phone call to you.'
          : 'Gate passes belong to a home. Ask the society office to link your flat.'}
        emptyIcon={<Ticket className="w-6 h-6" />}
        toolbar={
          <Button size="small" variant={showAll ? 'contained' : 'outlined'}
            onClick={() => setShowAll(v => !v)}
            className="!rounded-xl !normal-case !font-bold !text-xs">
            {showAll ? 'Showing used and cancelled too' : 'Show used and cancelled too'}
          </Button>
        }
      />

      {/* ------------------------------------------------------------ create */}
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs"
        slotProps={{ paper: { className: '!rounded-2xl' } }}>
        <DialogTitle className="!font-black !text-slate-900">Invite someone</DialogTitle>
        <DialogContent dividers className="space-y-3">
          <TextField autoFocus fullWidth size="small" label="Who is coming?" value={form.visitorName || ''}
            onChange={e => setForm({ ...form, visitorName: e.target.value })} />
          <TextField fullWidth size="small" label="Their phone (optional)" value={form.visitorPhone || ''}
            onChange={e => setForm({ ...form, visitorPhone: e.target.value })} />
          <FormControl fullWidth size="small">
            <InputLabel>Kind of visitor</InputLabel>
            <Select label="Kind of visitor" value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(c => <MenuItem key={c.v} value={c.v}>{c.l}</MenuItem>)}
            </Select>
          </FormControl>
          {flatIds.length > 1 && (
            <FormControl fullWidth size="small">
              <InputLabel>Which home</InputLabel>
              <Select label="Which home" value={form.flatId || flatIds[0]}
                onChange={e => setForm({ ...form, flatId: e.target.value })}>
                {flatIds.map(id => <MenuItem key={id} value={id}>{id.slice(-6)}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          <TextField fullWidth size="small" type="datetime-local" label="Valid from"
            value={form.validFrom || localInput(new Date())}
            onChange={e => setForm({ ...form, validFrom: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }} />
          <TextField fullWidth size="small" type="datetime-local" label="Valid until"
            value={form.validTo || localInput(new Date(Date.now() + 86_400_000))}
            onChange={e => setForm({ ...form, validTo: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }} />
          <TextField fullWidth size="small" type="number" label="How many people"
            value={form.maxUses} onChange={e => setForm({ ...form, maxUses: e.target.value })}
            helperText="A family arriving together is one invitation, not four separate ones" />
        </DialogContent>
        <DialogActions className="!px-6 !py-3">
          <Button onClick={() => setOpen(false)} className="!normal-case !font-bold">Cancel</Button>
          <Button variant="contained" onClick={create} disabled={saving || !form.visitorName}
            className="!rounded-xl !normal-case !font-bold">{saving ? 'Creating…' : 'Create pass'}</Button>
        </DialogActions>
      </Dialog>

      {/* ------------------------------------------------------------- share */}
      <Dialog open={!!share} onClose={() => setShare(null)} fullWidth maxWidth="xs"
        slotProps={{ paper: { className: '!rounded-2xl' } }}>
        <DialogTitle className="!font-black !text-slate-900">{share?.visitorName}</DialogTitle>
        <DialogContent dividers className="text-center space-y-3">
          {qr && <img src={qr} alt="Pass QR" className="mx-auto rounded-xl border border-slate-200" />}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Gate code</p>
            <p className="font-mono font-black text-3xl tracking-[0.3em] text-slate-900">{share?.code}</p>
          </div>
          <p className="text-xs text-slate-500">
            Valid until {share && new Date(share.validTo).toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-slate-400">
            Sharing sends the QR image along with the code. The code works even where
            there is no signal at the gate.
          </p>
        </DialogContent>
        <DialogActions className="!px-6 !py-3">
          <Button onClick={() => setShare(null)} className="!normal-case !font-bold">Close</Button>
          <Button startIcon={<Download className="w-4 h-4" />}
            onClick={async () => { if (!share) return; const f = await qrFile(share); if (f) saveQr(f); }}
            className="!rounded-xl !normal-case !font-bold !text-slate-500">Save QR</Button>
          <Button variant="contained" startIcon={<Copy className="w-4 h-4" />}
            onClick={() => share && doShare(share)}
            className="!rounded-xl !normal-case !font-bold">Share</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
