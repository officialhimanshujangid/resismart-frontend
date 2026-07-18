'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Paper, CircularProgress, FormControl, Select, MenuItem, Chip,
} from '@mui/material';
import { Plus, X, Download, Trash2, FileText, Upload } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface FlatDocument {
  _id: string;
  kind: string;
  label: string;
  uploadedAt: string;
  uploadedByName: string;
  /** Decided by the server per viewer — an owner may undo their own upload only. */
  canRemove?: boolean;
}

/** The papers a flat keeps, in the order a committee member would look for them. */
const KINDS = [
  { v: 'SALE_DEED', l: 'Sale deed' },
  { v: 'PROPERTY_CARD', l: 'Property card / 7-12' },
  { v: 'OC_CERTIFICATE', l: 'Occupancy certificate' },
  { v: 'POSSESSION_LETTER', l: 'Possession letter' },
  { v: 'NOC', l: 'NOC' },
  { v: 'SHARE_CERT_COPY', l: 'Share certificate copy' },
  { v: 'FLOOR_PLAN', l: 'Floor plan' },
  { v: 'OTHER', l: 'Other' },
];
const kindLabel = (v: string) => KINDS.find(k => k.v === v)?.l || v;

const dt = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

/**
 * Documents that belong to the flat itself rather than to whoever lives in it —
 * the sale deed stays when the owner changes, the rent agreement does not.
 *
 * `canManage` is presentation only. The server decides for real: uploads are
 * committee-and-above, deletes are admin, and a resident's own flat is resolved
 * from their session rather than from anything this component sends.
 */
export default function FlatDocuments({ flatId, canManage = false }: { flatId: string; canManage?: boolean }) {
  const { showToast, confirm } = useToastConfirm();
  const [docs, setDocs] = useState<FlatDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ kind: string; label: string; file: File | null }>({ kind: 'SALE_DEED', label: '', file: null });

  const load = useCallback(async () => {
    if (!flatId) return;
    try {
      setLoading(true);
      const res = await api.get(`/societies/flats/${flatId}/documents`);
      setDocs(res.data || []);
    } catch (e: any) { showToast(e.response?.data?.error || 'Could not load documents', 'error'); }
    finally { setLoading(false); }
  }, [flatId, showToast]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form.file) return showToast('Choose a file first', 'error');
    setSaving(true);
    try {
      // Two steps on purpose: the bytes go to the shared private uploader, and
      // only the reference it returns is attached to the flat. A failed attach
      // therefore never leaves a row pointing at a file that was never stored.
      const fd = new FormData();
      fd.append('file', form.file);
      const up = await api.post('/upload/document', fd);

      await api.post(`/societies/flats/${flatId}/documents`, {
        kind: form.kind,
        label: form.label.trim() || form.file.name,
        key: up.data.key,
        url: up.data.url,
      });
      showToast('Document added', 'success');
      setOpen(false);
      setForm({ kind: 'SALE_DEED', label: '', file: null });
      load();
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Could not add the document', 'error');
    } finally { setSaving(false); }
  };

  const download = async (d: FlatDocument) => {
    try {
      const res = await api.get(`/societies/flats/${flatId}/documents/${d._id}/download`);
      if (res.data?.url) window.open(res.data.url, '_blank');
      else showToast('Could not open the document', 'error');
    } catch (e: any) { showToast(e.response?.data?.error || 'Could not open the document', 'error'); }
  };

  const remove = async (d: FlatDocument) => {
    const yes = await confirm({
      title: `Remove ${d.label}?`,
      message: 'It will no longer be listed against this flat. Keep a copy elsewhere if it is the only one.',
      confirmText: 'Remove', cancelText: 'Cancel',
    });
    if (!yes) return;
    try {
      await api.delete(`/societies/flats/${flatId}/documents/${d._id}`);
      showToast('Document removed', 'success');
      load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Could not remove the document', 'error'); }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Flat documents</p>
          <p className="text-[11px] text-slate-400">Papers that stay with the flat — the sale deed, property card, plans. Not shown to tenants.</p>
        </div>
        {canManage && (
          <Button size="small" variant="outlined" startIcon={<Plus className="w-4 h-4" />} onClick={() => setOpen(true)}>
            Add
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><CircularProgress size={24} /></div>
      ) : docs.length === 0 ? (
        <Paper elevation={0} className="p-6 rounded-2xl border border-dashed border-slate-200 text-center">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400 font-semibold">No documents on file for this flat yet.</p>
        </Paper>
      ) : (
        <div className="space-y-2">
          {docs.map(d => (
            <Paper key={d._id} elevation={0} className="p-3 rounded-xl border border-slate-200/60 flex items-center gap-3">
              <FileText className="w-5 h-5 text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate">{d.label}</p>
                <p className="text-[11px] text-slate-400">
                  {dt(d.uploadedAt)}{d.uploadedByName ? ` · ${d.uploadedByName}` : ''}
                </p>
              </div>
              <Chip size="small" label={kindLabel(d.kind)} className="bg-slate-100 text-slate-600 text-[10px] font-bold shrink-0" />
              <IconButton size="small" onClick={() => download(d)} title="Download"><Download className="w-4 h-4 text-slate-400" /></IconButton>
              {/* `canRemove` comes per document from the server, so an owner gets
                  a bin on their own upload and none on a society-filed deed. */}
              {d.canRemove && (
                <IconButton size="small" onClick={() => remove(d)} title="Remove"><Trash2 className="w-4 h-4 text-slate-400" /></IconButton>
              )}
            </Paper>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3">
          <span>Add a document</span>
          <IconButton onClick={() => setOpen(false)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-3">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Type</span>
            <FormControl fullWidth size="small">
              <Select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}>
                {KINDS.map(k => <MenuItem key={k.v} value={k.v}>{k.l}</MenuItem>)}
              </Select>
            </FormControl>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Name</span>
            <TextField
              hiddenLabel fullWidth size="small"
              placeholder={form.file?.name || 'e.g. Sale Deed 2019'}
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
            />
            <p className="text-[10px] text-slate-400">Leave blank to use the file name.</p>
          </div>

          <Button component="label" variant="outlined" fullWidth startIcon={<Upload className="w-4 h-4" />} className="py-2.5">
            {form.file ? form.file.name : 'Choose a PDF or image'}
            <input
              type="file" hidden accept="application/pdf,image/*"
              onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] || null }))}
            />
          </Button>
          <p className="text-[11px] text-slate-500">
            Stored privately — it is never publicly linkable, and each download opens through a short-lived signed link.
          </p>
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.file} variant="contained" fullWidth className="py-2.5 font-bold">
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
