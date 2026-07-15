'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  CircularProgress, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, Paper, Zoom, FormControl, Select, MenuItem,
} from '@mui/material';
import { Plus, X, Users, CheckCircle2, Banknote, XCircle, Trash2 } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface Vendor { _id: string; name: string; tdsApplicable?: boolean; tdsRatePercent?: number; }
interface Account { _id: string; code: string; name: string; }
interface Expense {
  _id: string; voucherNumber: string; vendorName?: string; description?: string;
  grossPaise: number; tdsPaise: number; netPayablePaise: number; status: string; expenseDate: string; paymentMode?: string;
}

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const STATUS: Record<string, string> = {
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  APPROVED: 'bg-blue-50 text-blue-700 border-blue-100',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-100',
  REJECTED: 'bg-red-50 text-red-700 border-red-100',
  DRAFT: 'bg-slate-100 text-slate-500 border-slate-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function ExpensesPage() {
  const { showToast, confirm } = useToastConfirm();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ vendorId: '', description: '', paymentMode: 'BANK', lines: [{ expenseAccountCode: '', amount: '' }] });

  const [vendorOpen, setVendorOpen] = useState(false);
  const [newVendor, setNewVendor] = useState({ name: '', tdsApplicable: false, tdsRatePercent: '' });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page + 1), pageSize: String(pageSize) });
      if (status) params.append('status', status);
      const [ex, ve, ac] = await Promise.all([
        api.get(`/finance/society/expenses?${params.toString()}`),
        api.get('/finance/society/vendors'),
        api.get('/finance/society/ledger/accounts?type=EXPENSE'),
      ]);
      setExpenses(ex.data.expenses); setTotal(ex.data.pagination?.total ?? 0);
      setVendors(ve.data); setAccounts(ac.data);
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to load expenses', 'error'); }
    finally { setLoading(false); }
  }, [page, pageSize, status, showToast]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/finance/society/expenses', {
        vendorId: form.vendorId || undefined,
        description: form.description || undefined,
        paymentMode: form.paymentMode,
        lineItems: form.lines.filter(l => l.expenseAccountCode && l.amount).map(l => ({ expenseAccountCode: l.expenseAccountCode, amountPaise: Math.round(parseFloat(l.amount) * 100) })),
      });
      showToast('Expense created', 'success'); setCreateOpen(false);
      setForm({ vendorId: '', description: '', paymentMode: 'BANK', lines: [{ expenseAccountCode: '', amount: '' }] });
      load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to create expense', 'error'); }
    finally { setSaving(false); }
  };

  const act = async (e: Expense, action: 'approve' | 'pay' | 'reject') => {
    let body: any = {};
    if (action === 'reject') { const r = window.prompt('Reason?'); if (!r) return; body = { rejectionReason: r }; }
    if (action === 'pay') { const ok = await confirm({ title: 'Record payment', message: `Mark ${e.voucherNumber} as paid (${rupees(e.netPayablePaise)})?`, confirmText: 'Pay' }); if (!ok) return; }
    try { await api.post(`/finance/society/expenses/${e._id}/${action}`, body); showToast(`Expense ${action}d`, 'success'); load(); }
    catch (err: any) { showToast(err.response?.data?.error || `Failed to ${action}`, 'error'); }
  };

  const addVendor = async () => {
    try {
      await api.post('/finance/society/vendors', { name: newVendor.name, tdsApplicable: newVendor.tdsApplicable, tdsRatePercent: newVendor.tdsApplicable && newVendor.tdsRatePercent ? Number(newVendor.tdsRatePercent) : undefined });
      showToast('Vendor added', 'success'); setNewVendor({ name: '', tdsApplicable: false, tdsRatePercent: '' });
      const ve = await api.get('/finance/society/vendors'); setVendors(ve.data);
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to add vendor', 'error'); }
  };

  const setLine = (i: number, patch: any) => setForm(f => ({ ...f, lines: f.lines.map((l, idx) => idx === i ? { ...l, ...patch } : l) }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Expenses</h1>
          <p className="text-sm text-slate-500 mt-0.5">Record vendor bills and society expenses with approvals</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setVendorOpen(true)} variant="outlined" startIcon={<Users className="w-4 h-4" />}>Vendors</Button>
          <Button onClick={() => setCreateOpen(true)} variant="contained" startIcon={<Plus className="w-4 h-4" />}>Add Expense</Button>
        </div>
      </div>

      <FormControl size="small" sx={{ minWidth: 180 }}>
        <Select displayEmpty value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}>
          <MenuItem value="">All statuses</MenuItem>
          {['PENDING_APPROVAL', 'APPROVED', 'PAID', 'REJECTED'].map(s => <MenuItem key={s} value={s}>{s.replace(/_/g, ' ')}</MenuItem>)}
        </Select>
      </FormControl>

      <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        {loading ? <div className="flex justify-center py-20 bg-white"><CircularProgress size={32} /></div>
          : expenses.length === 0 ? <div className="text-center py-20 text-slate-400 font-semibold text-sm bg-white">No expenses yet.</div>
          : (
            <Table sx={{ minWidth: 900 }}>
              <TableHead><TableRow>
                <TableCell>Voucher</TableCell><TableCell>Payee</TableCell><TableCell>Description</TableCell>
                <TableCell align="right">Gross</TableCell><TableCell align="right">TDS</TableCell><TableCell align="right">Net</TableCell>
                <TableCell>Status</TableCell><TableCell align="right">Actions</TableCell>
              </TableRow></TableHead>
              <TableBody className="bg-white">
                {expenses.map(e => (
                  <TableRow key={e._id}>
                    <TableCell className="font-mono text-xs font-bold text-slate-700">{e.voucherNumber}</TableCell>
                    <TableCell className="font-bold text-slate-800">{e.vendorName || 'Direct'}</TableCell>
                    <TableCell className="text-slate-600 max-w-xs truncate">{e.description || '—'}</TableCell>
                    <TableCell align="right" className="font-semibold text-slate-700">{rupees(e.grossPaise)}</TableCell>
                    <TableCell align="right" className="text-slate-500">{e.tdsPaise ? rupees(e.tdsPaise) : '—'}</TableCell>
                    <TableCell align="right" className="font-bold text-slate-800">{rupees(e.netPayablePaise)}</TableCell>
                    <TableCell><span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-black border ${STATUS[e.status]}`}>{e.status.replace(/_/g, ' ')}</span></TableCell>
                    <TableCell align="right">
                      <div className="flex items-center justify-end gap-1">
                        {e.status === 'PENDING_APPROVAL' && <>
                          <IconButton title="Approve" onClick={() => act(e, 'approve')} size="small" className="bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 text-slate-500 rounded-xl p-2"><CheckCircle2 className="w-4 h-4" /></IconButton>
                          <IconButton title="Reject" onClick={() => act(e, 'reject')} size="small" className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-xl p-2"><XCircle className="w-4 h-4" /></IconButton>
                        </>}
                        {e.status === 'APPROVED' && <IconButton title="Mark paid" onClick={() => act(e, 'pay')} size="small" className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-xl p-2"><Banknote className="w-4 h-4" /></IconButton>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => setPage(p)} rowsPerPage={pageSize} onRowsPerPageChange={e => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }} rowsPerPageOptions={[10, 20, 50]} />
      </TableContainer>

      {/* Create expense */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} slots={{ transition: Zoom }} maxWidth="sm" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3"><span>New Expense</span><IconButton onClick={() => setCreateOpen(false)} size="small"><X className="w-5 h-5" /></IconButton></DialogTitle>
        <DialogContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Vendor (optional)</span>
              <FormControl fullWidth size="small"><Select displayEmpty value={form.vendorId} onChange={e => setForm(f => ({ ...f, vendorId: e.target.value }))}><MenuItem value="">Direct (no vendor)</MenuItem>{vendors.map(v => <MenuItem key={v._id} value={v._id}>{v.name}{v.tdsApplicable ? ` (TDS ${v.tdsRatePercent}%)` : ''}</MenuItem>)}</Select></FormControl>
            </div>
            <div className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pay from</span>
              <FormControl fullWidth size="small"><Select value={form.paymentMode} onChange={e => setForm(f => ({ ...f, paymentMode: e.target.value }))}>{['BANK', 'CASH', 'CHEQUE', 'UPI'].map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}</Select></FormControl>
            </div>
          </div>
          <TextField hiddenLabel fullWidth size="small" placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="space-y-2">
            <div className="flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Expense lines</span>
              <Button size="small" onClick={() => setForm(f => ({ ...f, lines: [...f.lines, { expenseAccountCode: '', amount: '' }] }))} startIcon={<Plus className="w-3 h-3" />}>Add line</Button>
            </div>
            {form.lines.map((l, i) => (
              <div key={i} className="flex gap-2 items-center">
                <FormControl size="small" className="flex-1"><Select displayEmpty value={l.expenseAccountCode} onChange={e => setLine(i, { expenseAccountCode: e.target.value })}><MenuItem value="" disabled>Account</MenuItem>{accounts.map(a => <MenuItem key={a._id} value={a.code}>{a.code} · {a.name}</MenuItem>)}</Select></FormControl>
                <TextField hiddenLabel size="small" type="number" placeholder="₹" value={l.amount} onChange={e => setLine(i, { amount: e.target.value })} className="w-32" />
                {form.lines.length > 1 && <IconButton size="small" onClick={() => setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }))}><Trash2 className="w-4 h-4 text-slate-400" /></IconButton>}
              </div>
            ))}
          </div>
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setCreateOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={submit} disabled={saving} variant="contained" fullWidth className="py-2.5 font-bold">{saving ? <CircularProgress size={18} color="inherit" /> : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      {/* Vendors */}
      <Dialog open={vendorOpen} onClose={() => setVendorOpen(false)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3"><span>Vendors</span><IconButton onClick={() => setVendorOpen(false)} size="small"><X className="w-5 h-5" /></IconButton></DialogTitle>
        <DialogContent className="space-y-3">
          <div className="flex gap-2 items-end">
            <TextField hiddenLabel size="small" placeholder="Vendor name" value={newVendor.name} onChange={e => setNewVendor(v => ({ ...v, name: e.target.value }))} className="flex-1" />
            <TextField hiddenLabel size="small" type="number" placeholder="TDS %" value={newVendor.tdsRatePercent} onChange={e => setNewVendor(v => ({ ...v, tdsRatePercent: e.target.value, tdsApplicable: !!e.target.value }))} className="w-20" />
            <Button variant="contained" onClick={addVendor} disabled={!newVendor.name}>Add</Button>
          </div>
          <div className="divide-y border rounded-xl">
            {vendors.length === 0 ? <p className="text-center text-slate-400 text-sm py-6">No vendors yet.</p> : vendors.map(v => (
              <div key={v._id} className="flex justify-between px-3 py-2 text-sm"><span className="font-semibold text-slate-700">{v.name}</span>{v.tdsApplicable && <span className="text-xs text-slate-500">TDS {v.tdsRatePercent}%</span>}</div>
            ))}
          </div>
        </DialogContent>
        <DialogActions className="p-5 pt-0"><Button onClick={() => setVendorOpen(false)} variant="contained" fullWidth className="py-2.5 font-bold">Done</Button></DialogActions>
      </Dialog>
    </div>
  );
}
