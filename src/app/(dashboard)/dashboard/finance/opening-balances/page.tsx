'use client';

import React, { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, TextField, CircularProgress, FormControl, Select, MenuItem,
  IconButton, Autocomplete, FormControlLabel, Switch,
} from '@mui/material';
import { Plus, Trash2, Info, Landmark, Users, PiggyBank, Scale, AlertTriangle } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface Account { _id: string; code: string; name: string; type: string }
interface Flat { _id: string; number: string; blockName: string }
interface Fund { _id: string; name: string; ledgerAccountCode?: string }
interface DefaulterRow { _id: string; flatNumber: string; blockName: string; outstandingPaise: number }

const SURPLUS_CODE = '3900';
const DEBTORS_CODE = '1200';

const rupees = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const toPaise = (v: string) => Math.round(parseFloat(v || '0') * 100) || 0;

const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{children}</span>
);

const SectionCard = ({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }) => (
  <Paper elevation={0} className="rounded-2xl border border-slate-200/60 overflow-hidden">
    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-start gap-3">
      <div className="p-2 rounded-xl bg-white border border-slate-200">{icon}</div>
      <div><p className="font-bold text-slate-800 text-sm">{title}</p><p className="text-xs text-slate-500 mt-0.5">{hint}</p></div>
    </div>
    <div className="p-4 space-y-3">{children}</div>
  </Paper>
);

export default function OpeningBalancesPage() {
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [debtorsBalancePaise, setDebtorsBalancePaise] = useState(0);

  const [asOf, setAsOf] = useState('');
  const [cash, setCash] = useState<{ accountCode: string; amount: string }[]>([{ accountCode: '1100', amount: '' }]);
  const [dues, setDues] = useState<{ flatId: string; amount: string }[]>([]);
  const [fundRows, setFundRows] = useState<{ accountCode: string; amount: string }[]>([]);
  const [other, setOther] = useState<{ accountCode: string; side: 'DR' | 'CR'; amount: string }[]>([]);
  const [balanceToSurplus, setBalanceToSurplus] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [a, f, fn, tb] = await Promise.all([
          api.get('/finance/society/ledger/accounts?isActive=true'),
          api.get('/societies/flats'),
          api.get('/finance/society/funds'),
          api.get('/finance/society/reports/trial-balance'),
        ]);
        setAccounts(a.data || []);
        setFlats(f.data.flats || []);
        setFunds(fn.data || []);
        const debtors = (tb.data?.rows || []).find((r: any) => r.code === DEBTORS_CODE);
        setDebtorsBalancePaise((debtors?.debitPaise || 0) - (debtors?.creditPaise || 0));
      } catch (e: any) {
        showToast(e.response?.data?.error || 'Failed to load the chart of accounts', 'error');
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const assetAccounts = accounts.filter(a => a.type === 'ASSET');
  const flatLabel = (f: Flat) => `${f.blockName} ${f.number}`.trim();

  /** Pull per-flat dues from existing unpaid invoices (the backfill case). */
  const loadDuesFromInvoices = async () => {
    try {
      const res = await api.get('/finance/society/reports/defaulters');
      const rows: DefaulterRow[] = res.data?.rows || [];
      if (!rows.length) { showToast('No unpaid invoices found', 'info'); return; }
      setDues(rows.map(r => ({ flatId: r._id, amount: String(r.outstandingPaise / 100) })));
      showToast(`Loaded dues for ${rows.length} flat(s)`, 'success');
    } catch (e: any) { showToast(e.response?.data?.error || 'Could not load dues', 'error'); }
  };

  const lines = useMemo(() => {
    const out: { accountCode: string; debitPaise?: number; creditPaise?: number; flatId?: string; description?: string }[] = [];
    cash.forEach(r => { const p = toPaise(r.amount); if (r.accountCode && p > 0) out.push({ accountCode: r.accountCode, debitPaise: p, description: 'Opening balance' }); });
    dues.forEach(r => { const p = toPaise(r.amount); if (r.flatId && p > 0) out.push({ accountCode: DEBTORS_CODE, debitPaise: p, flatId: r.flatId, description: 'Opening dues' }); });
    fundRows.forEach(r => { const p = toPaise(r.amount); if (r.accountCode && p > 0) out.push({ accountCode: r.accountCode, creditPaise: p, description: 'Opening fund balance' }); });
    other.forEach(r => {
      const p = toPaise(r.amount);
      if (!r.accountCode || p <= 0) return;
      out.push(r.side === 'DR' ? { accountCode: r.accountCode, debitPaise: p, description: 'Opening balance' } : { accountCode: r.accountCode, creditPaise: p, description: 'Opening balance' });
    });
    return out;
  }, [cash, dues, fundRows, other]);

  const totalDr = lines.reduce((s, l) => s + (l.debitPaise || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (l.creditPaise || 0), 0);
  const differencePaise = totalDr - totalCr;
  const balanced = differencePaise === 0;
  const canPost = lines.length > 0 && asOf && (balanced || balanceToSurplus);

  const post = async () => {
    const payload = [...lines];
    // Whatever the society is worth beyond what we listed is its accumulated
    // surplus — that plug is what makes the opening entry balance.
    if (!balanced && balanceToSurplus) {
      payload.push(differencePaise > 0
        ? { accountCode: SURPLUS_CODE, creditPaise: differencePaise, description: 'Opening balance equity' }
        : { accountCode: SURPLUS_CODE, debitPaise: -differencePaise, description: 'Opening balance equity' });
    }
    if (payload.length < 2) { showToast('An opening entry needs at least two lines', 'error'); return; }

    setPosting(true);
    try {
      const res = await api.post('/finance/society/ledger/journal', {
        voucherType: 'OPENING',
        entryDate: new Date(asOf).toISOString(),
        narration: `Opening balances as at ${new Date(asOf).toLocaleDateString('en-IN')}`,
        lines: payload,
      });
      showToast(`Opening balances posted as ${res.data?.voucherNumber || 'an opening voucher'}`, 'success');
      setCash([{ accountCode: '1100', amount: '' }]); setDues([]); setFundRows([]); setOther([]);
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Could not post opening balances', 'error');
    } finally { setPosting(false); }
  };

  if (loading) return <div className="flex justify-center p-12"><CircularProgress size={32} /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl pb-28">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Opening Balances</h1>
        <p className="text-sm text-slate-500 mt-0.5">Tell the books what your society already owned and was owed on day one</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 flex gap-2">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <span>
          If your society existed before ResiSmart, enter what it held on the day you started here — money in the bank,
          dues members still owed, and fund balances. Post this <b>once</b>. Until you do, your Balance Sheet
          will be short by exactly the history that came before. Anything you don’t account for is treated as
          accumulated surplus.
        </span>
      </div>

      <Paper elevation={0} className="rounded-2xl border border-slate-200/60 p-4">
        <div className="space-y-1 max-w-xs">
          <Label>Opening date *</Label>
          <TextField hiddenLabel fullWidth size="small" type="date" value={asOf} onChange={e => setAsOf(e.target.value)} />
          <p className="text-[11px] text-slate-500 mt-1">Usually the first day of the financial year you started on.</p>
        </div>
      </Paper>

      <SectionCard icon={<Landmark className="w-4 h-4 text-blue-600" />} title="Bank & cash" hint="What the society held in each account on the opening date">
        {cash.map((r, i) => (
          <div key={i} className="flex gap-2 items-center">
            <FormControl size="small" className="flex-1">
              <Select value={r.accountCode} onChange={e => setCash(c => c.map((x, j) => j === i ? { ...x, accountCode: e.target.value } : x))}>
                {assetAccounts.map(a => <MenuItem key={a._id} value={a.code}>{a.code} · {a.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField hiddenLabel size="small" type="number" placeholder="₹" className="w-40" value={r.amount}
              onChange={e => setCash(c => c.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
            <IconButton size="small" onClick={() => setCash(c => c.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 text-slate-400" /></IconButton>
          </div>
        ))}
        <Button size="small" startIcon={<Plus className="w-4 h-4" />} onClick={() => setCash(c => [...c, { accountCode: '', amount: '' }])}>Add account</Button>
      </SectionCard>

      <SectionCard icon={<Users className="w-4 h-4 text-amber-600" />} title="Member dues outstanding" hint="What each flat still owed you on the opening date">
        {debtorsBalancePaise !== 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Members’ dues already show <b>{rupees(debtorsBalancePaise)}</b> in the ledger. Only add dues here that
              aren’t already there, or you’ll count them twice.</span>
          </div>
        )}
        {dues.map((r, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Autocomplete
              className="flex-1"
              size="small"
              options={flats}
              getOptionLabel={flatLabel}
              value={flats.find(f => f._id === r.flatId) || null}
              onChange={(_, v) => setDues(d => d.map((x, j) => j === i ? { ...x, flatId: v?._id || '' } : x))}
              renderInput={(params) => <TextField {...params} hiddenLabel placeholder="Flat" />}
            />
            <TextField hiddenLabel size="small" type="number" placeholder="₹" className="w-40" value={r.amount}
              onChange={e => setDues(d => d.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
            <IconButton size="small" onClick={() => setDues(d => d.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 text-slate-400" /></IconButton>
          </div>
        ))}
        <div className="flex gap-2">
          <Button size="small" startIcon={<Plus className="w-4 h-4" />} onClick={() => setDues(d => [...d, { flatId: '', amount: '' }])}>Add flat</Button>
          <Button size="small" variant="outlined" onClick={loadDuesFromInvoices}>Load from unpaid invoices</Button>
        </div>
      </SectionCard>

      <SectionCard icon={<PiggyBank className="w-4 h-4 text-emerald-600" />} title="Fund balances" hint="What each fund had already accumulated">
        {fundRows.map((r, i) => (
          <div key={i} className="flex gap-2 items-center">
            <FormControl size="small" className="flex-1">
              <Select value={r.accountCode} onChange={e => setFundRows(c => c.map((x, j) => j === i ? { ...x, accountCode: e.target.value } : x))} displayEmpty>
                <MenuItem value="" disabled>Select fund</MenuItem>
                {funds.filter(f => f.ledgerAccountCode).map(f => <MenuItem key={f._id} value={f.ledgerAccountCode!}>{f.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField hiddenLabel size="small" type="number" placeholder="₹" className="w-40" value={r.amount}
              onChange={e => setFundRows(c => c.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
            <IconButton size="small" onClick={() => setFundRows(c => c.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 text-slate-400" /></IconButton>
          </div>
        ))}
        {!funds.length && <p className="text-xs text-slate-400">No funds yet — create them in Funds first.</p>}
        <Button size="small" startIcon={<Plus className="w-4 h-4" />} disabled={!funds.length} onClick={() => setFundRows(c => [...c, { accountCode: '', amount: '' }])}>Add fund</Button>
      </SectionCard>

      <SectionCard icon={<Scale className="w-4 h-4 text-indigo-600" />} title="Anything else" hint="Deposits held, advances, loans, assets — pick the account and side">
        {other.map((r, i) => (
          <div key={i} className="flex gap-2 items-center">
            <FormControl size="small" className="flex-1">
              <Select value={r.accountCode} onChange={e => setOther(c => c.map((x, j) => j === i ? { ...x, accountCode: e.target.value } : x))} displayEmpty>
                <MenuItem value="" disabled>Select account</MenuItem>
                {accounts.map(a => <MenuItem key={a._id} value={a.code}>{a.code} · {a.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" className="w-32">
              <Select value={r.side} onChange={e => setOther(c => c.map((x, j) => j === i ? { ...x, side: e.target.value as 'DR' | 'CR' } : x))}>
                <MenuItem value="DR">Owns / owed</MenuItem>
                <MenuItem value="CR">Owes</MenuItem>
              </Select>
            </FormControl>
            <TextField hiddenLabel size="small" type="number" placeholder="₹" className="w-40" value={r.amount}
              onChange={e => setOther(c => c.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
            <IconButton size="small" onClick={() => setOther(c => c.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 text-slate-400" /></IconButton>
          </div>
        ))}
        <Button size="small" startIcon={<Plus className="w-4 h-4" />} onClick={() => setOther(c => [...c, { accountCode: '', side: 'DR', amount: '' }])}>Add line</Button>
      </SectionCard>

      {/* Running totals — an opening entry that doesn't balance can't be posted. */}
      <Paper elevation={2} className="rounded-2xl border border-slate-200/60 p-4 sticky bottom-4 bg-white/95 backdrop-blur">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex gap-6">
            <div><Label>Total owned / owed</Label><p className="text-lg font-black text-slate-800">{rupees(totalDr)}</p></div>
            <div><Label>Total owes / funds</Label><p className="text-lg font-black text-slate-800">{rupees(totalCr)}</p></div>
            <div>
              <Label>Difference</Label>
              <p className={`text-lg font-black ${balanced ? 'text-emerald-600' : 'text-amber-600'}`}>{rupees(Math.abs(differencePaise))}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!balanced && (
              <FormControlLabel
                control={<Switch size="small" checked={balanceToSurplus} onChange={e => setBalanceToSurplus(e.target.checked)} />}
                label={<span className="text-xs font-semibold text-slate-600">Treat the difference as accumulated surplus</span>}
              />
            )}
            <Button onClick={post} disabled={!canPost || posting} variant="contained" className="font-bold px-6 py-2.5">
              {posting ? <CircularProgress size={18} color="inherit" /> : 'Post opening balances'}
            </Button>
          </div>
        </div>
        {!balanced && !balanceToSurplus && (
          <p className="text-xs text-amber-700 mt-2">Off by {rupees(Math.abs(differencePaise))} — either fix the figures or let the difference go to accumulated surplus.</p>
        )}
      </Paper>
    </div>
  );
}
