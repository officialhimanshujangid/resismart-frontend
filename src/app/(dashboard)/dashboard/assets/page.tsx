'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, TextField, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel, Chip,
} from '@mui/material';
import { Plus, QrCode, Wrench, AlertTriangle, Printer, History } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import PageHeader from '@/components/common/PageHeader';
import PageSkeleton from '@/components/common/PageSkeleton';
import QRCode from 'qrcode';

/**
 * The society's equipment, and the stickers that sit on it.
 *
 * The sticker is the point. "The lift isn't working" is a useless complaint —
 * which lift, in which wing? A QR code on the machine turns that into a report
 * that arrives already knowing what it is about, who maintains it, and whether
 * the AMC is still live.
 */

interface Asset {
  _id: string; assetCode: string; name: string; category: string;
  blockId?: string; blockName?: string; location?: string;
  vendorId?: string; vendorName?: string;
  amcExpiresOn?: string; qrToken: string; isActive: boolean;
}

const CATEGORY_LABEL: Record<string, string> = {
  LIFT: 'Lift', PUMP: 'Pump', DG: 'Generator', TANK: 'Water tank',
  GATE: 'Gate', STP: 'STP', CCTV: 'CCTV', OTHER: 'Other',
};

export default function AssetsPage() {
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [expiring, setExpiring] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ name: '', category: 'LIFT' });

  const [qrOf, setQrOf] = useState<Asset | null>(null);
  const [qrData, setQrData] = useState('');
  const [history, setHistory] = useState<any[] | null>(null);

  const load = async () => {
    try {
      const res = await api.get('/complaints/assets');
      const d = res.data?.data || {};
      setAssets(d.assets || []); setBlocks(d.blocks || []);
      setVendors(d.vendors || []); setExpiring(d.expiring || []);
      setCategories(d.categories || []);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not load equipment', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const add = async () => {
    setSaving(true);
    try {
      // One dialog for both. A form carrying an _id is an edit — which reaches
      // the PUT route that shipped months ago with no caller, so equipment was
      // create-only and a wrongly-filed lift could never be corrected.
      if (form._id) await api.put(`/complaints/assets/${form._id}`, form);
      else await api.post('/complaints/assets', form);
      showToast(form._id ? 'Saved' : 'Added', 'success');
      setAddOpen(false); setForm({ name: '', category: 'LIFT' });
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not save that', 'error');
    } finally { setSaving(false); }
  };

  const showQr = async (a: Asset) => {
    setQrOf(a); setHistory(null);
    // Rendered client-side, exactly as the UPI panel already does — no server
    // round trip and no image to store anywhere.
    const url = `${window.location.origin}/scan/${a.qrToken}`;
    setQrData(await QRCode.toDataURL(url, { width: 360, margin: 1, errorCorrectionLevel: 'M' }));
    try {
      const res = await api.get(`/complaints/assets/${a._id}/history`);
      setHistory(res.data?.data || []);
    } catch { setHistory([]); }
  };

  const assetColumns: ColumnDef<Asset>[] = [
    {
      id: 'name', label: 'Equipment', alwaysVisible: true,
      sortValue: a => a.name,
      exportValue: a => a.name,
      render: a => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <Wrench className="w-4 h-4 text-slate-500" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-slate-800 truncate">{a.name}</p>
            <p className="text-[11px] text-slate-400 font-mono">{a.assetCode}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'category', label: 'Kind',
      sortValue: a => CATEGORY_LABEL[a.category] || a.category,
      exportValue: a => CATEGORY_LABEL[a.category] || a.category,
      render: a => <span className="text-sm text-slate-600">{CATEGORY_LABEL[a.category] || a.category}</span>,
    },
    {
      id: 'where', label: 'Where',
      sortValue: a => `${a.blockName || ''} ${a.location || ''}`.trim(),
      exportValue: a => [a.blockName, a.location].filter(Boolean).join(' · '),
      render: a => (
        <span className="text-sm text-slate-500">
          {[a.blockName, a.location].filter(Boolean).join(' · ') || 'Common area'}
        </span>
      ),
    },
    {
      id: 'vendor', label: 'Maintained by',
      sortValue: a => a.vendorName || '',
      exportValue: a => a.vendorName || '',
      render: a => a.vendorName
        ? <span className="text-sm text-slate-600">{a.vendorName}</span>
        : <span className="text-[11px] text-slate-300">nobody</span>,
    },
    {
      id: 'amc', label: 'AMC until',
      // Sortable, because "which contracts lapse next" is the question this
      // screen exists to answer and a card list could never be read that way.
      sortValue: a => a.amcExpiresOn || '',
      exportValue: a => a.amcExpiresOn ? new Date(a.amcExpiresOn).toLocaleDateString('en-IN') : '',
      render: a => {
        if (!a.amcExpiresOn) return <span className="text-[11px] text-slate-300">none</span>;
        const lapsed = new Date(a.amcExpiresOn) < new Date();
        return (
          <span className={`text-[11px] font-semibold ${lapsed ? 'text-rose-600' : 'text-slate-500'}`}>
            {lapsed && <AlertTriangle className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
            {new Date(a.amcExpiresOn).toLocaleDateString('en-IN')}
          </span>
        );
      },
    },
    {
      id: 'act', label: '', align: 'right', alwaysVisible: true,
      render: a => (
        <div className="flex items-center justify-end gap-1">
          <Button size="small"
            onClick={() => {
              setForm({
                _id: a._id, name: a.name, category: a.category,
                blockId: a.blockId || '', location: a.location || '',
                vendorId: a.vendorId || '',
                amcExpiresOn: a.amcExpiresOn ? a.amcExpiresOn.slice(0, 10) : '',
              });
              setAddOpen(true);
            }}
            className="!rounded-xl !normal-case !font-bold !text-xs !text-slate-500">
            Edit
          </Button>
          <Button size="small" variant="outlined" startIcon={<QrCode className="w-3.5 h-3.5" />}
            onClick={() => showQr(a)} className="!rounded-xl !normal-case !font-bold !text-xs">
            Sticker
          </Button>
        </div>
      ),
    },
  ];

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        breadcrumb="Operations"
        title="Equipment"
        icon={<Wrench className="w-4.5 h-4.5" />}
        subtitle="Lifts, pumps and tanks — each with a sticker that reports its own faults. Not the same as Finance → Fixed Assets, which is the same lift as an accounting entry to be depreciated."
        actions={
          <Button variant="contained" startIcon={<Plus className="w-4 h-4" />}
            onClick={() => { setForm({ name: '', category: 'LIFT' }); setAddOpen(true); }}
            className="!rounded-xl !normal-case !font-bold">
            Add equipment
          </Button>
        }
      />

      {expiring.length > 0 && (
        <Paper elevation={0} className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800 text-sm">Maintenance contracts running out</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {expiring.map((a: any) => (
                  <Chip key={a._id} size="small"
                    label={`${a.name} · ${a.vendorName || 'no vendor'} · ${new Date(a.amcExpiresOn).toLocaleDateString('en-IN')}`}
                    className="!bg-white !border !border-amber-300 !text-amber-900 !font-semibold !text-[11px]" />
                ))}
              </div>
              <p className="text-[11px] text-amber-800 mt-2">
                Once an AMC lapses, a breakdown becomes the society&apos;s bill rather than the vendor&apos;s.
              </p>
            </div>
          </div>
        </Paper>
      )}

      <DataTable
        columns={assetColumns}
        data={assets}
        keyExtractor={a => a._id}
        exportFileName="equipment"
        columnToggle
        emptyTitle="Nothing listed yet"
        emptyText="Add your lifts and pumps, print their stickers, and complaints start arriving with the location already filled in."
        emptyIcon={<Wrench className="w-6 h-6" />}
      />

      {/* -------------------------------------------------------------- add */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs"
        slotProps={{ paper: { className: '!rounded-2xl' } }}>
        <DialogTitle className="!font-black !text-slate-900">{form._id ? 'Edit equipment' : 'Add equipment'}</DialogTitle>
        <DialogContent dividers className="flex flex-col gap-4 pt-2">
          <TextField autoFocus fullWidth size="small" label="What is it called?" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            helperText="Something the person standing in front of it would recognise — 'Lift 2', not 'Elevator Unit B'" />
          <FormControl fullWidth size="small">
            <InputLabel>Kind</InputLabel>
            <Select label="Kind" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              {categories.map(c => <MenuItem key={c} value={c}>{CATEGORY_LABEL[c] || c}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Wing</InputLabel>
            <Select label="Wing" value={form.blockId || ''} onChange={e => setForm({ ...form, blockId: e.target.value })}>
              <MenuItem value=""><em className="text-slate-400">Whole society</em></MenuItem>
              {blocks.map(b => <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth size="small" label="Where exactly (optional)" value={form.location || ''}
            onChange={e => setForm({ ...form, location: e.target.value })} placeholder="B wing lobby" />
          <FormControl fullWidth size="small">
            <InputLabel>Maintained by</InputLabel>
            <Select label="Maintained by" value={form.vendorId || ''} onChange={e => setForm({ ...form, vendorId: e.target.value })}>
              <MenuItem value=""><em className="text-slate-400">Nobody</em></MenuItem>
              {vendors.map(v => <MenuItem key={v._id} value={v._id}>{v.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth size="small" type="date" label="AMC runs to"
            value={form.amcExpiresOn || ''} onChange={e => setForm({ ...form, amcExpiresOn: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="While this is live, a breakdown goes to them at their cost." />
        </DialogContent>
        <DialogActions className="!px-6 !py-3">
          <Button onClick={() => setAddOpen(false)} className="!normal-case !font-bold">Cancel</Button>
          <Button variant="contained" onClick={add} disabled={saving || !form.name}
            className="!rounded-xl !normal-case !font-bold">{saving ? 'Adding…' : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      {/* --------------------------------------------------------- the sticker */}
      <Dialog open={!!qrOf} onClose={() => setQrOf(null)} fullWidth maxWidth="xs"
        slotProps={{ paper: { className: '!rounded-2xl' } }}>
        <DialogTitle className="!font-black !text-slate-900">{qrOf?.name}</DialogTitle>
        <DialogContent dividers className="flex flex-col gap-4 pt-2">
          <div className="text-center">
            {qrData && <img src={qrData} alt="QR code" className="mx-auto rounded-xl border border-slate-200" />}
            <p className="font-black text-slate-800 mt-3">{qrOf?.name}</p>
            <p className="text-xs text-slate-500">{qrOf?.blockName} {qrOf?.location}</p>
            <p className="text-[11px] text-slate-400 mt-2">Scan to report a problem</p>
          </div>

          <Button fullWidth variant="outlined" startIcon={<Printer className="w-4 h-4" />}
            onClick={() => window.print()} className="!rounded-xl !normal-case !font-bold">
            Print it
          </Button>

          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Its history</span>
            </div>
            {history === null ? <CircularProgress size={20} />
              : history.length === 0 ? <p className="text-xs text-slate-500 italic">No faults reported yet.</p>
              : (
                <>
                  <div className="space-y-1.5">
                    {history.slice(0, 8).map((h: any) => (
                      <div key={h._id} className="text-xs text-slate-600 flex justify-between gap-2">
                        <span className="truncate">{h.title}</span>
                        <span className="text-slate-400 shrink-0">
                          {new Date(h.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                  {history.length >= 3 && (
                    <p className="text-[11px] text-amber-700 mt-2">
                      {history.length} faults on this one machine — worth raising at the next AMC renewal.
                    </p>
                  )}
                </>
              )}
          </div>
        </DialogContent>
        <DialogActions className="!px-6 !py-3">
          <Button onClick={() => setQrOf(null)} className="!normal-case !font-bold">Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
