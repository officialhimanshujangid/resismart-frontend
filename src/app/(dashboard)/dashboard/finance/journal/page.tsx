'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, TextField, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, FormControl, Select, MenuItem, Zoom, Table, TableHead, TableBody, TableRow,
  TableCell, TableContainer, TablePagination, Chip,
} from '@mui/material';
import { Plus, X, Trash2, Info, BookOpen } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface Account { _id: string; code: string; name: string; type: string }
interface Line { accountCode: string; accountName: string; debitPaise: number; creditPaise: number; description?: string }
interface Entry {
  _id: string; voucherNumber: string; voucherType: string; entryDate: string;
  narration?: string; lines: Line[]; totalDebitPaise: number; status: string;
}

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const toPaise = (v: string) => Math.round(parseFloat(v || '0') * 100) || 0;
const shortDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

const TYPE_TONE: Record<string, string> = {
  INVOICE: 'bg-blue-50 text-blue-700', RECEIPT: 'bg-emerald-50 text-emerald-700',
  PAYMENT: 'bg-rose-50 text-rose-700', JOURNAL: 'bg-slate-100 text-slate-600',
  CONTRA: 'bg-indigo-50 text-indigo-700', OPENING: 'bg-amber-50 text-amber-700',
  REVERSAL: 'bg-red-50 text-red-700',
};

/** Manual vouchers — adjustments and corrections that no other screen produces. */
export default function JournalPage() {
  const { showToast } = useToastConfirm();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(25);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [form, setForm] = useState({
    voucherType: 'JOURNAL',
    entryDate: new Date().toISOString().slice(0, 10),
    narration: '',
    lines: [{ accountCode: '', side: 'DR' as 'DR' | 'CR', amount: '', description: '' },
            { accountCode: '', side: 'CR' as 'DR' | 'CR', amount: '', description: '' }],
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const p = new URLSearchParams({ page: String(page + 1), pageSize: String(rpp) });
      if (typeFilter) p.append('voucherType', typeFilter);
      const res = await api.get(`/finance/society/ledger/journal?${p.toString()}`);
      setEntries(res.data.entries || []);
      setTotal(res.data.pagination?.total || 0);
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to load vouchers', 'error'); }
    finally { setLoading(false); }
  }, [page, rpp, typeFilter, showToast]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      try { const res = await api.get('/finance/society/ledger/accounts?isActive=true'); setAccounts(res.data || []); }
      catch { /* the dialog just won't offer a picker */ }
    })();
  }, []);

  const totalDr = form.lines.reduce((s, l) => s + (l.side === 'DR' ? toPaise(l.amount) : 0), 0);
  const totalCr = form.lines.reduce((s, l) => s + (l.side === 'CR' ? toPaise(l.amount) : 0), 0);
  const balanced = totalDr === totalCr && totalDr > 0;
  const filled = form.lines.filter(l => l.accountCode && toPaise(l.amount) > 0);

  const post = async () => {
    setPosting(true);
    try {
      await api.post('/finance/society/ledger/journal', {
        voucherType: form.voucherType,
        entryDate: new Date(form.entryDate).toISOString(),
        narration: form.narration || undefined,
        lines: filled.map(l => ({
          accountCode: l.accountCode,
          ...(l.side === 'DR' ? { debitPaise: toPaise(l.amount) } : { creditPaise: toPaise(l.amount) }),
          description: l.description || undefined,
        })),
      });
      showToast('Voucher posted', 'success');
      setOpen(false);
      setForm(f => ({ ...f, narration: '', lines: [{ accountCode: '', side: 'DR', amount: '', description: '' }, { accountCode: '', side: 'CR', amount: '', description: '' }] }));
      load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Could not post this voucher', 'error'); }
    finally { setPosting(false); }
  };

  const setLine = (i: number, patch: any) => setForm(f => ({ ...f, lines: f.lines.map((l, j) => j === i ? { ...l, ...patch } : l) }));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Vouchers &amp; Journal</h1>
          <p className="text-sm text-slate-500 mt-0.5">Every entry ever posted — and where you record an adjustment by hand</p>
        </div>
        <div className="flex gap-2">
          <FormControl size="small" className="min-w-[150px]">
            <Select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0); }} displayEmpty>
              <MenuItem value="">All vouchers</MenuItem>
              {['INVOICE', 'RECEIPT', 'PAYMENT', 'JOURNAL', 'CONTRA', 'OPENING', 'REVERSAL'].map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <Button onClick={() => setOpen(true)} variant="contained" startIcon={<Plus className="w-4 h-4" />}>New Entry</Button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Most entries here are created for you — raising a bill, taking a payment, paying a vendor. Post one by hand
          only for a correction or an adjustment nothing else covers. Entries are never edited or deleted; a mistake is
          fixed by posting the opposite entry. For your society&apos;s starting figures use <b>Opening Balances</b> instead.
        </span>
      </div>

      <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        {loading ? <div className="flex justify-center py-16"><CircularProgress size={30} /></div>
          : entries.length === 0 ? <div className="text-center py-16 text-slate-400 font-semibold text-sm">No vouchers yet.</div>
          : (
            <Table sx={{ minWidth: 720 }}>
              <TableHead><TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Voucher</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Narration</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
              </TableRow></TableHead>
              <TableBody className="bg-white">
                {entries.map(e => (
                  <React.Fragment key={e._id}>
                    <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === e._id ? null : e._id)}>
                      <TableCell className="font-mono text-xs font-bold text-slate-700">{e.voucherNumber}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{shortDate(e.entryDate)}</TableCell>
                      <TableCell><span className={`text-[9px] uppercase px-2 py-0.5 rounded-full font-black ${TYPE_TONE[e.voucherType] || 'bg-slate-100'}`}>{e.voucherType}</span></TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {e.narration || '—'}
                        {e.status === 'REVERSED' && <Chip size="small" label="Reversed" className="ml-2 bg-red-50 text-red-600 font-bold" />}
                      </TableCell>
                      <TableCell align="right" className="font-bold text-slate-800">{rupees(e.totalDebitPaise)}</TableCell>
                    </TableRow>
                    {expanded === e._id && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-slate-50/60">
                          <div className="py-2">
                            {e.lines.map((l, i) => (
                              <div key={i} className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                                <span className="text-slate-600"><b className="font-mono">{l.accountCode}</b> · {l.accountName}{l.description ? ` — ${l.description}` : ''}</span>
                                <span className="font-mono ml-4 shrink-0">
                                  {l.debitPaise ? <span className="text-slate-700">Dr {rupees(l.debitPaise)}</span> : <span className="text-emerald-700">Cr {rupees(l.creditPaise)}</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        {!loading && total > 0 && (
          <TablePagination component="div" count={total} page={page} rowsPerPage={rpp}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={ev => { setRpp(parseInt(ev.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[25, 50, 100]} />
        )}
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} slots={{ transition: Zoom }} maxWidth="md" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3">
          <span className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-slate-500" />Post a voucher by hand</span>
          <IconButton onClick={() => setOpen(false)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Type</span>
              <FormControl fullWidth size="small">
                <Select value={form.voucherType} onChange={e => setForm(f => ({ ...f, voucherType: e.target.value }))}>
                  <MenuItem value="JOURNAL">Journal — a correction or adjustment</MenuItem>
                  <MenuItem value="CONTRA">Contra — moving money between your own accounts</MenuItem>
                  <MenuItem value="OPENING">Opening — starting balances</MenuItem>
                </Select>
              </FormControl>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Date</span>
              <TextField hiddenLabel fullWidth size="small" type="date" value={form.entryDate} onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Narration</span>
            <TextField hiddenLabel fullWidth size="small" placeholder="Why is this entry being made?" value={form.narration} onChange={e => setForm(f => ({ ...f, narration: e.target.value }))} />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Lines</span>
            {form.lines.map((l, i) => (
              <div key={i} className="flex gap-2 items-center">
                <FormControl size="small" className="flex-1">
                  <Select value={l.accountCode} onChange={e => setLine(i, { accountCode: e.target.value })} displayEmpty>
                    <MenuItem value="" disabled>Select account</MenuItem>
                    {accounts.map(a => <MenuItem key={a._id} value={a.code}>{a.code} · {a.name}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl size="small" className="w-28">
                  <Select value={l.side} onChange={e => setLine(i, { side: e.target.value })}>
                    <MenuItem value="DR">Debit</MenuItem><MenuItem value="CR">Credit</MenuItem>
                  </Select>
                </FormControl>
                <TextField hiddenLabel size="small" type="number" placeholder="₹" className="w-36" value={l.amount} onChange={e => setLine(i, { amount: e.target.value })} />
                <IconButton size="small" disabled={form.lines.length <= 2} onClick={() => setForm(f => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}>
                  <Trash2 className="w-4 h-4 text-slate-400" />
                </IconButton>
              </div>
            ))}
            <Button size="small" startIcon={<Plus className="w-4 h-4" />} onClick={() => setForm(f => ({ ...f, lines: [...f.lines, { accountCode: '', side: 'DR', amount: '', description: '' }] }))}>Add line</Button>
          </div>

          {/* Debits must equal credits — the engine rejects anything else, so say so here. */}
          <div className={`p-3 rounded-xl text-sm font-bold flex justify-between ${balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            <span>Debits {rupees(totalDr)} · Credits {rupees(totalCr)}</span>
            <span>{balanced ? '✓ Balanced' : `Off by ${rupees(Math.abs(totalDr - totalCr))}`}</span>
          </div>
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={post} disabled={posting || !balanced || filled.length < 2} variant="contained" fullWidth className="py-2.5 font-bold">
            {posting ? <CircularProgress size={18} color="inherit" /> : 'Post voucher'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
