'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  CircularProgress, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Paper, Zoom, FormControl, Select, MenuItem, FormControlLabel, Switch,
} from '@mui/material';
import { Plus, X, Landmark, Percent, Wallet, PiggyBank, CalendarClock, HandCoins } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface Investment {
  _id: string; bankName: string; accountNumberLast4?: string;
  principalPaise: number; ratePercent: number;
  startDate: string; maturityDate: string;
  interestPayout: 'CUMULATIVE' | 'QUARTERLY' | 'ON_MATURITY';
  linkedFundId?: string; linkedFundName?: string; autoRenew: boolean;
  accruedInterestPaise: number; currentValuePaise: number;
  lastAccrualUpTo?: string;
  status: 'ACTIVE' | 'MATURED' | 'CLOSED';
  closedOn?: string; daysToMaturity?: number;
}
interface Fund { _id: string; name: string; ledgerAccountCode?: string }
interface Totals {
  principalPaise: number; accruedInterestPaise: number; currentValuePaise: number;
  count: number; maturingSoon: number;
}
interface PreviewRow {
  investmentId: string; bankName: string; principalPaise: number; ratePercent: number;
  linkedFundId?: string; creditToLabel?: string;
  days: number; interestPaise: number; closingAccruedInterestPaise: number;
  skipReason?: string;
}
interface Preview {
  upToDate: string; rows: PreviewRow[]; accruable: number; skipped: number;
  totalPaise: number; toFundsPaise: number; toIncomePaise: number;
}

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const shortDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';
const today = () => new Date().toISOString().slice(0, 10);
/** The API takes full ISO timestamps; a date input gives a bare YYYY-MM-DD. */
const toIso = (ymd: string) => new Date(`${ymd}T00:00:00`).toISOString();

const PAYOUT_HELP: Record<string, string> = {
  CUMULATIVE: 'The bank keeps the interest in the deposit until it ends.',
  QUARTERLY: 'The bank pays the interest out every quarter.',
  ON_MATURITY: 'Everything comes back in one lump at maturity.',
};

/** A deposit maturing inside a month is the treasurer's problem this week. */
const MATURITY_WARN_DAYS = 30;

function StatCard({ icon, label, value, hint, tone }: { icon: React.ReactNode; label: string; value: string; hint: string; tone: string }) {
  return (
    <Paper elevation={0} className="p-4 rounded-2xl border border-slate-200/60 bg-white flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${tone}`}>{icon}</div>
      <div>
        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-lg font-black text-slate-800">{value}</p>
        <p className="text-[11px] text-slate-400">{hint}</p>
      </div>
    </Paper>
  );
}

export default function InvestmentsPage() {
  const { showToast } = useToastConfirm();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const emptyForm = {
    bankName: '', accountNumberLast4: '', principal: '', ratePercent: '',
    startDate: today(), maturityDate: '', interestPayout: 'CUMULATIVE',
    linkedFundId: '', autoRenew: false,
  };
  const [form, setForm] = useState(emptyForm);

  const [accrualOpen, setAccrualOpen] = useState(false);
  const [accrualDate, setAccrualDate] = useState(today());
  const [accrualBusy, setAccrualBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  const [closeOf, setCloseOf] = useState<Investment | null>(null);
  const [closure, setClosure] = useState({ closedOn: today(), proceeds: '' });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [i, f] = await Promise.all([
        api.get('/finance/society/investments?includeClosed=true'),
        api.get('/finance/society/funds'),
      ]);
      setInvestments(i.data.investments); setTotals(i.data.totals);
      setFunds(f.data || []);
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to load deposits', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/finance/society/investments', {
        bankName: form.bankName,
        accountNumberLast4: form.accountNumberLast4 || undefined,
        principalPaise: Math.round(parseFloat(form.principal) * 100),
        ratePercent: parseFloat(form.ratePercent),
        startDate: toIso(form.startDate),
        maturityDate: toIso(form.maturityDate),
        interestPayout: form.interestPayout,
        linkedFundId: form.linkedFundId || '',
        autoRenew: form.autoRenew,
      });
      showToast('Deposit added to the register', 'success');
      setCreateOpen(false); setForm(emptyForm); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to add deposit', 'error'); }
    finally { setSaving(false); }
  };

  /** Preview first, post second — the same two-step as depreciation. */
  const runPreview = async () => {
    setAccrualBusy(true);
    try {
      const res = await api.get(`/finance/society/investments/accrual/preview?upToDate=${encodeURIComponent(toIso(accrualDate))}`);
      setPreview(res.data);
    } catch (e: any) { showToast(e.response?.data?.error || 'Preview failed', 'error'); }
    finally { setAccrualBusy(false); }
  };

  const runAccrual = async () => {
    setAccrualBusy(true);
    try {
      const res = await api.post('/finance/society/investments/accrual/run', { upToDate: toIso(accrualDate) });
      if (res.data.posted) showToast(`Accrued ${rupees(res.data.totalPaise)} across ${res.data.investmentsAccrued} deposit(s) — voucher ${res.data.voucherNumber}`, 'success');
      else showToast('Nothing to accrue — this period is already up to date', 'info');
      setAccrualOpen(false); setPreview(null); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Accrual run failed', 'error'); }
    finally { setAccrualBusy(false); }
  };

  const doClose = async () => {
    if (!closeOf) return;
    setSaving(true);
    try {
      await api.post(`/finance/society/investments/${closeOf._id}/close`, {
        closedOn: toIso(closure.closedOn),
        proceedsPaise: closure.proceeds ? Math.round(parseFloat(closure.proceeds) * 100) : 0,
      });
      showToast(`Deposit with ${closeOf.bankName} closed`, 'success');
      setCloseOf(null); setClosure({ closedOn: today(), proceeds: '' }); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Could not close this deposit', 'error'); }
    finally { setSaving(false); }
  };

  /** What the closure will book, shown before it posts. */
  const closureMath = (() => {
    if (!closeOf) return null;
    const proceeds = closure.proceeds ? Math.round(parseFloat(closure.proceeds) * 100) || 0 : 0;
    const carrying = closeOf.currentValuePaise;
    return { proceeds, carrying, gain: proceeds - carrying };
  })();

  const canSubmit = form.bankName && form.principal && form.ratePercent && form.maturityDate;

  const maturityChip = (i: Investment) => {
    if (i.status === 'CLOSED') return <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-black border bg-slate-100 text-slate-500 border-slate-200">Closed</span>;
    const d = i.daysToMaturity ?? 0;
    if (d < 0) return <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-black border bg-red-50 text-red-600 border-red-100">Matured</span>;
    if (d <= MATURITY_WARN_DAYS) return <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-black border bg-amber-50 text-amber-700 border-amber-100">{d}d left</span>;
    return null;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Fixed Deposits</h1>
          <p className="text-sm text-slate-500 mt-0.5">Where the society&apos;s reserves are parked — and what they have earned so far</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setAccrualOpen(true); setPreview(null); }} variant="outlined" startIcon={<Percent className="w-4 h-4" />} sx={{ whiteSpace: 'nowrap' }}>Accrue Interest</Button>
          <Button onClick={() => setCreateOpen(true)} variant="contained" startIcon={<Plus className="w-4 h-4" />} sx={{ whiteSpace: 'nowrap' }}>Add Deposit</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={<Landmark className="w-5 h-5 text-blue-600" />} label="Principal" value={rupees(totals?.principalPaise)} hint={`${totals?.count ?? 0} deposit(s) on the register`} tone="bg-blue-50" />
        <StatCard icon={<Percent className="w-5 h-5 text-emerald-600" />} label="Interest earned" value={rupees(totals?.accruedInterestPaise)} hint="Accrued to date, not yet collected" tone="bg-emerald-50" />
        <StatCard icon={<Wallet className="w-5 h-5 text-violet-600" />} label="Worth today" value={rupees(totals?.currentValuePaise)} hint="Principal plus what it has earned" tone="bg-violet-50" />
      </div>

      {!!totals?.maturingSoon && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex items-center gap-2">
          <CalendarClock className="w-4 h-4 shrink-0" />
          <span><b>{totals.maturingSoon} deposit(s)</b> mature within {MATURITY_WARN_DAYS} days. Decide now whether to renew or bring the money back — a matured FD sitting idle earns a savings rate.</span>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
        Putting money in an FD is not spending it — it just moves from the bank into the deposit, and the society is worth the same.
        Interest builds up day by day, so it is recorded as it is earned rather than when the bank finally pays it.
        Interest on a deposit that holds a fund&apos;s money goes back to <b>that fund</b>, not to general income — otherwise the reserve members are owed quietly shrinks.
      </div>

      <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        {loading ? <div className="flex justify-center py-20 bg-white"><CircularProgress size={32} thickness={4} /></div>
          : investments.length === 0 ? <div className="text-center py-20 text-slate-400 font-semibold text-sm bg-white">No deposits yet. Click &quot;Add Deposit&quot; to start the register.</div>
          : (
            <Table sx={{ minWidth: 980 }}>
              <TableHead><TableRow>
                <TableCell>Bank</TableCell><TableCell align="right">Principal</TableCell>
                <TableCell align="right">Rate</TableCell><TableCell>Matures</TableCell>
                <TableCell align="right">Interest earned</TableCell><TableCell align="right">Worth today</TableCell>
                <TableCell>Interest goes to</TableCell><TableCell>Accrued up to</TableCell>
                <TableCell align="right"></TableCell>
              </TableRow></TableHead>
              <TableBody className="bg-white">
                {investments.map(i => {
                  const dueSoon = i.status !== 'CLOSED' && (i.daysToMaturity ?? 99) <= MATURITY_WARN_DAYS;
                  return (
                    <TableRow key={i._id} hover className={i.status === 'CLOSED' ? 'opacity-60' : dueSoon ? 'bg-amber-50/40' : undefined}>
                      <TableCell>
                        <p className="font-bold text-slate-800">{i.bankName}</p>
                        {i.accountNumberLast4 && <p className="text-xs text-slate-400 font-mono">••{i.accountNumberLast4}</p>}
                        {i.closedOn && <p className="text-[11px] font-bold text-slate-500 mt-0.5">Closed {shortDate(i.closedOn)}</p>}
                      </TableCell>
                      <TableCell align="right" className="font-semibold text-slate-700">{rupees(i.principalPaise)}</TableCell>
                      <TableCell align="right" className="text-slate-600 font-semibold">{i.ratePercent}%</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono text-xs ${dueSoon ? 'font-black text-amber-700' : 'text-slate-500'}`}>{shortDate(i.maturityDate)}</span>
                          {maturityChip(i)}
                        </div>
                        {i.autoRenew && <span className="text-[10px] text-slate-400">auto-renews</span>}
                      </TableCell>
                      <TableCell align="right" className="text-emerald-600 font-semibold">{i.accruedInterestPaise ? rupees(i.accruedInterestPaise) : '—'}</TableCell>
                      <TableCell align="right" className="font-black text-slate-800">{rupees(i.currentValuePaise)}</TableCell>
                      <TableCell>
                        {i.linkedFundName
                          ? <span className="text-[10px] uppercase px-2 py-0.5 rounded-full font-black border bg-violet-50 text-violet-700 border-violet-100">{i.linkedFundName}</span>
                          : <span className="text-xs text-slate-400">Income</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{shortDate(i.lastAccrualUpTo)}</TableCell>
                      <TableCell align="right">
                        {i.status !== 'CLOSED' && (
                          <Button size="small" startIcon={<HandCoins className="w-3.5 h-3.5" />} onClick={() => { setCloseOf(i); setClosure({ closedOn: today(), proceeds: String(i.currentValuePaise / 100) }); }} className="font-bold whitespace-nowrap">Close</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
      </TableContainer>

      {/* Add deposit */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} slots={{ transition: Zoom }} maxWidth="sm" fullWidth scroll="paper">
        <DialogTitle className="flex justify-between items-center pr-3">
          <span className="flex items-center gap-2"><PiggyBank className="w-5 h-5 text-blue-600" />Add Fixed Deposit</span>
          <IconButton onClick={() => setCreateOpen(false)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1 col-span-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Which bank? *</span>
              <TextField hiddenLabel fullWidth size="small" placeholder="e.g. HDFC Bank" value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Last 4 digits</span>
              <TextField hiddenLabel fullWidth size="small" placeholder="4321" value={form.accountNumberLast4} onChange={e => setForm(f => ({ ...f, accountNumberLast4: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Amount deposited (₹) *</span>
              <TextField hiddenLabel fullWidth size="small" type="number" placeholder="0.00" value={form.principal} onChange={e => setForm(f => ({ ...f, principal: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Rate % a year *</span>
              <TextField hiddenLabel fullWidth size="small" type="number" placeholder="7.1" value={form.ratePercent} onChange={e => setForm(f => ({ ...f, ratePercent: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Placed on *</span>
              <TextField hiddenLabel fullWidth size="small" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Matures on *</span>
              <TextField hiddenLabel fullWidth size="small" type="date" value={form.maturityDate} onChange={e => setForm(f => ({ ...f, maturityDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">How is the interest paid?</span>
            <FormControl fullWidth size="small">
              <Select value={form.interestPayout} onChange={e => setForm(f => ({ ...f, interestPayout: e.target.value }))}>
                <MenuItem value="CUMULATIVE">Cumulative</MenuItem>
                <MenuItem value="QUARTERLY">Quarterly payout</MenuItem>
                <MenuItem value="ON_MATURITY">All at maturity</MenuItem>
              </Select>
            </FormControl>
            <p className="text-[11px] text-slate-400">{PAYOUT_HELP[form.interestPayout]}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Whose money is this?</span>
            <FormControl fullWidth size="small">
              <Select value={form.linkedFundId} onChange={e => setForm(f => ({ ...f, linkedFundId: e.target.value }))} displayEmpty>
                <MenuItem value="">General funds — interest is ordinary income</MenuItem>
                {funds.map(f => <MenuItem key={f._id} value={f._id}>{f.name}{f.ledgerAccountCode ? ` · ${f.ledgerAccountCode}` : ''}</MenuItem>)}
              </Select>
            </FormControl>
            <p className="text-[11px] text-slate-400">
              {form.linkedFundId
                ? 'The interest will be credited back to this fund — it is the fund’s money that is earning it.'
                : 'Pick a fund if this deposit holds a fund’s money. Its interest then belongs to that fund, not to general income.'}
            </p>
          </div>
          <FormControlLabel
            control={<Switch checked={form.autoRenew} onChange={e => setForm(f => ({ ...f, autoRenew: e.target.checked }))} />}
            label={<span className="text-sm font-semibold">Auto-renews at maturity</span>} />
          <p className="text-[11px] text-slate-400 -mt-2">
            A deposit that does not auto-renew stops earning on its maturity date. One that does keeps accruing past it.
          </p>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
            This books one voucher moving {form.principal ? rupees(Math.round(parseFloat(form.principal) * 100) || 0) : 'the money'} out of the bank and into the deposit. It is not an expense — the society is worth exactly the same afterwards.
          </div>
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setCreateOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={submit} disabled={saving || !canSubmit} variant="contained" fullWidth className="py-2.5 font-bold">{saving ? <CircularProgress size={18} color="inherit" /> : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      {/* Accrue interest — preview, then post */}
      <Dialog open={accrualOpen} onClose={() => setAccrualOpen(false)} slots={{ transition: Zoom }} maxWidth="sm" fullWidth scroll="paper">
        <DialogTitle className="flex justify-between items-center pr-3">
          <span className="flex items-center gap-2"><Percent className="w-5 h-5 text-blue-600" />Accrue Interest</span>
          <IconButton onClick={() => setAccrualOpen(false)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Count interest earned up to</span>
            <TextField hiddenLabel fullWidth size="small" type="date" value={accrualDate} onChange={e => { setAccrualDate(e.target.value); setPreview(null); }} />
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
            This books one voucher: the interest earned is added to the deposits, and credited to whoever it belongs to — each linked fund, or income for the rest.
            Only the stretch since each deposit was last accrued is counted, so running it again for the same date changes nothing.
          </div>

          {preview && (
            <div className="space-y-2">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Deposits to accrue</span><span className="font-bold text-slate-800">{preview.accruable}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Nothing to accrue</span><span className="font-bold text-slate-800">{preview.skipped}</span></div>
                {preview.toFundsPaise > 0 && (
                  <div className="flex justify-between"><span className="text-slate-500">Going back to funds</span><span className="font-bold text-violet-700">{rupees(preview.toFundsPaise)}</span></div>
                )}
                {preview.toIncomePaise > 0 && (
                  <div className="flex justify-between"><span className="text-slate-500">Going to income</span><span className="font-bold text-slate-800">{rupees(preview.toIncomePaise)}</span></div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 mt-1"><span className="font-black text-slate-800">Total interest earned</span><span className="font-black text-blue-700">{rupees(preview.totalPaise)}</span></div>
              </div>
              {preview.rows.length > 0 && (
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>Deposit</TableCell><TableCell align="right">Days</TableCell>
                    <TableCell align="right">Interest</TableCell><TableCell>Goes to</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {preview.rows.map(r => (
                      <TableRow key={r.investmentId}>
                        <TableCell>
                          <span className={r.interestPaise > 0 ? 'font-semibold text-slate-700' : 'text-slate-400'}>{r.bankName}</span>
                          <span className="block text-[10px] text-slate-400">{rupees(r.principalPaise)} @ {r.ratePercent}%</span>
                          {r.skipReason && <span className="block text-[10px] text-slate-400 italic">{r.skipReason}</span>}
                        </TableCell>
                        <TableCell align="right" className="text-slate-500">{r.days || '—'}</TableCell>
                        <TableCell align="right" className={r.interestPaise > 0 ? 'font-bold text-emerald-600' : 'text-slate-400'}>{r.interestPaise ? rupees(r.interestPaise) : '—'}</TableCell>
                        <TableCell className={r.linkedFundId ? 'text-violet-700 text-xs font-semibold' : 'text-slate-400 text-xs'}>{r.creditToLabel}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {preview.totalPaise === 0 && (
                <p className="text-xs text-slate-500 text-center py-1">Nothing to accrue for this date — everything is already up to date.</p>
              )}
            </div>
          )}
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={runPreview} disabled={accrualBusy} variant="outlined" fullWidth className="py-2.5 font-bold">{accrualBusy && !preview ? <CircularProgress size={18} /> : 'Preview'}</Button>
          <Button onClick={runAccrual} disabled={accrualBusy || !preview || preview.totalPaise === 0} variant="contained" fullWidth className="py-2.5 font-bold">{accrualBusy ? <CircularProgress size={18} color="inherit" /> : 'Post'}</Button>
        </DialogActions>
      </Dialog>

      {/* Close — show what the books say before it posts, not after. */}
      <Dialog open={!!closeOf} onClose={() => setCloseOf(null)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3">
          <span>Close deposit — {closeOf?.bankName}</span>
          <IconButton onClick={() => setCloseOf(null)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Matured or broken early? This brings the money back to the bank and takes the deposit off the books —
            principal and every paisa of interest recorded against it.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Date</span>
              <TextField hiddenLabel fullWidth size="small" type="date" value={closure.closedOn} onChange={e => setClosure(c => ({ ...c, closedOn: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Bank paid (₹)</span>
              <TextField hiddenLabel fullWidth size="small" type="number" value={closure.proceeds} onChange={e => setClosure(c => ({ ...c, proceeds: e.target.value }))} />
            </div>
          </div>
          {closureMath && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Worth on the books</span><b className="text-slate-800">{rupees(closureMath.carrying)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Bank is paying</span><b className="text-slate-800">{rupees(closureMath.proceeds)}</b></div>
              {closureMath.gain !== 0 && (
                <div className="flex justify-between pt-1 border-t border-slate-200">
                  <span className="text-slate-500">{closureMath.gain > 0 ? 'Extra interest' : 'Shortfall'}</span>
                  <b className={closureMath.gain > 0 ? 'text-emerald-700' : 'text-red-600'}>{rupees(Math.abs(closureMath.gain))}</b>
                </div>
              )}
              <p className="text-[11px] text-slate-500 pt-1">
                {closureMath.gain === 0
                  ? 'The bank is paying exactly what the books say — nothing left over to book.'
                  : closureMath.gain > 0
                    ? 'The bank paid more than was accrued — the difference is booked as extra interest income.'
                    : 'The bank paid less than was accrued — usually a premature-withdrawal penalty. The difference comes back out of interest income.'}
              </p>
            </div>
          )}
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setCloseOf(null)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={doClose} disabled={saving} variant="contained" fullWidth className="py-2.5 font-bold">
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Close Deposit'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}