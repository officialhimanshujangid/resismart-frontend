'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, TextField, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, FormControl, Select, MenuItem, Zoom, Chip, Table, TableHead, TableBody, TableRow,
  TableCell, TableContainer, TablePagination, Tooltip, Switch, FormControlLabel,
} from '@mui/material';
import { Plus, Pencil, Trash2, X, Lock, Info } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface Account {
  _id: string; code: string; name: string; type: string; normalBalance: string;
  isSystem: boolean; isActive: boolean; isControlAccount: boolean; currentBalancePaise: number;
}

const TYPES = [
  { v: 'ASSET', l: 'Asset — what the society owns or is owed' },
  { v: 'LIABILITY', l: 'Liability — what the society owes' },
  { v: 'FUND', l: 'Fund — a reserve held for a purpose' },
  { v: 'EQUITY', l: 'Equity — accumulated surplus / capital' },
  { v: 'INCOME', l: 'Income — money earned' },
  { v: 'EXPENSE', l: 'Expense — money spent' },
];
const TYPE_TONE: Record<string, string> = {
  ASSET: 'bg-blue-50 text-blue-700 border-blue-100',
  LIABILITY: 'bg-amber-50 text-amber-700 border-amber-100',
  FUND: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  EQUITY: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  INCOME: 'bg-teal-50 text-teal-700 border-teal-100',
  EXPENSE: 'bg-rose-50 text-rose-700 border-rose-100',
};
/** The number ranges the seeded chart follows — worth telling the admin. */
const RANGE_HINT: Record<string, string> = {
  ASSET: '1xxx', LIABILITY: '2xxx', FUND: '3100–3899', EQUITY: '39xx', INCOME: '4xxx', EXPENSE: '5xxx',
};

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function ChartOfAccountsPage() {
  const { showToast, confirm } = useToastConfirm();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', name: '', type: 'EXPENSE', isActive: true });
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(25);

  const load = async () => {
    try { setLoading(true); const res = await api.get('/finance/society/ledger/accounts'); setAccounts(res.data || []); }
    catch (e: any) { showToast(e.response?.data?.error || 'Failed to load the chart of accounts', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const openCreate = () => { setEditId(null); setForm({ code: '', name: '', type: 'EXPENSE', isActive: true }); setOpen(true); };
  const openEdit = (a: Account) => { setEditId(a._id); setForm({ code: a.code, name: a.name, type: a.type, isActive: a.isActive }); setOpen(true); };

  const save = async () => {
    setSaving(true);
    try {
      if (editId) {
        // Code and type are fixed once created — postings reference the code, and
        // changing the type would move history between the Balance Sheet and I&E.
        await api.put(`/finance/society/ledger/accounts/${editId}`, { name: form.name.trim(), isActive: form.isActive });
        showToast('Account updated', 'success');
      } else {
        await api.post('/finance/society/ledger/accounts', { code: form.code.trim(), name: form.name.trim(), type: form.type });
        showToast('Account added', 'success');
      }
      setOpen(false); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to save the account', 'error'); }
    finally { setSaving(false); }
  };

  const remove = async (a: Account) => {
    const ok = await confirm({
      title: 'Delete account',
      message: `Delete "${a.code} · ${a.name}"? This only works if nothing has ever been posted to it.`,
      confirmText: 'Delete', severity: 'error',
    });
    if (!ok) return;
    try { await api.delete(`/finance/society/ledger/accounts/${a._id}`); showToast('Account deleted', 'success'); load(); }
    catch (e: any) { showToast(e.response?.data?.error || 'Failed to delete the account', 'error'); }
  };

  const rows = accounts.slice(page * rpp, page * rpp + rpp);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Chart of Accounts</h1>
          <p className="text-sm text-slate-500 mt-0.5">Every bucket the society&apos;s money can sit in</p>
        </div>
        <Button onClick={openCreate} variant="contained" startIcon={<Plus className="w-4 h-4" />}>Add Account</Button>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Your society starts with a standard Indian co-operative chart. Add your own accounts — a second bank
          account, a new expense head — and they become available everywhere. Accounts marked
          <Lock className="w-3 h-3 inline mx-1" /> are used by the posting engine and can&apos;t be removed.
        </span>
      </div>

      <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        {loading ? <div className="flex justify-center py-16"><CircularProgress size={30} /></div>
          : accounts.length === 0 ? <div className="text-center py-16 text-slate-400 font-semibold text-sm">No accounts yet.</div>
          : (
            <Table sx={{ minWidth: 760 }}>
              <TableHead><TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Balance</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right"></TableCell>
              </TableRow></TableHead>
              <TableBody className="bg-white">
                {rows.map(a => (
                  <TableRow key={a._id}>
                    <TableCell className="font-mono text-xs font-bold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        {a.code}
                        {a.isSystem && <Tooltip title="Used by the posting engine — cannot be deleted"><Lock className="w-3 h-3 text-slate-400" /></Tooltip>}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-slate-700">{a.name}</TableCell>
                    <TableCell><span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-black border ${TYPE_TONE[a.type]}`}>{a.type}</span></TableCell>
                    <TableCell align="right" className="font-mono text-slate-700">{rupees(a.currentBalancePaise)}</TableCell>
                    <TableCell>
                      {a.isActive
                        ? <Chip size="small" label="Active" className="bg-emerald-50 text-emerald-700 font-bold" />
                        : <Chip size="small" label="Inactive" className="bg-slate-100 text-slate-500 font-bold" />}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton onClick={() => openEdit(a)} size="small" className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-xl p-2 mr-1"><Pencil className="w-4 h-4" /></IconButton>
                      <Tooltip title={a.isSystem ? 'System accounts cannot be deleted' : 'Delete'}>
                        <span>
                          <IconButton onClick={() => remove(a)} size="small" disabled={a.isSystem} className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-xl p-2"><Trash2 className="w-4 h-4" /></IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        {!loading && accounts.length > 0 && (
          <TablePagination component="div" count={accounts.length} page={page} rowsPerPage={rpp}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={e => { setRpp(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[25, 50, 100]} />
        )}
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3">
          <span>{editId ? 'Edit account' : 'Add account'}</span>
          <IconButton onClick={() => setOpen(false)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-4">
          {!editId && (<>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Type *</span>
              <FormControl fullWidth size="small">
                <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {TYPES.map(t => <MenuItem key={t.v} value={t.v}>{t.l}</MenuItem>)}
                </Select>
              </FormControl>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Code *</span>
              <TextField hiddenLabel fullWidth size="small" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. 5200" />
              <p className="text-[11px] text-slate-500 mt-1">Numbers only. {form.type} accounts conventionally use <b>{RANGE_HINT[form.type]}</b>.</p>
            </div>
          </>)}
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Name *</span>
            <TextField hiddenLabel fullWidth size="small" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Garden Maintenance" />
          </div>
          {editId && (
            <FormControlLabel control={<Switch checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />}
              label={<span className="text-sm font-semibold">Active</span>} />
          )}
          {editId && <p className="text-[11px] text-slate-500">The code and type are fixed once an account exists — entries already reference them.</p>}
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name.trim() || (!editId && !form.code.trim())} variant="contained" fullWidth className="py-2.5 font-bold">
            {saving ? <CircularProgress size={18} color="inherit" /> : editId ? 'Save' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
