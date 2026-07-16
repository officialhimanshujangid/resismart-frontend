'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, TextField, CircularProgress, FormControl, Select, MenuItem, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from '@mui/material';
import { Info, Wand2, CheckCircle2, Save } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface FyOption { fy: string; label: string; from: string; to: string }
interface BudgetAccount { accountCode: string; accountName: string; type: 'INCOME' | 'EXPENSE'; previousActualPaise: number }
interface BudgetLine { accountCode: string; accountName: string; budgetedPaise: number }
interface BudgetDoc { financialYear: string; lines: BudgetLine[]; status: 'DRAFT' | 'APPROVED'; approvedByName?: string; approvedAt?: string }
interface Workspace { financialYear: string; budget: BudgetDoc | null; previousFinancialYear: string; accounts: BudgetAccount[] }

interface VarianceRow {
  code: string; name: string; budgetedPaise: number; actualPaise: number;
  variancePaise: number; variancePercent: number | null; unbudgeted: boolean; favourable: boolean;
}
interface VarianceSection { rows: VarianceRow[]; budgetedPaise: number; actualPaise: number; variancePaise: number; variancePercent: number | null }

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const toPaise = (v: string) => Math.round(parseFloat(v || '0') * 100) || 0;
const Th = (props: any) => <TableCell sx={{ fontWeight: 700 }} {...props} />;

const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{children}</span>
);

export default function BudgetPage() {
  const { showToast, confirm } = useToastConfirm();
  const [tab, setTab] = useState<'SET' | 'COMPARE'>('SET');

  const [fys, setFys] = useState<FyOption[]>([]);
  const [fy, setFy] = useState('');
  const [ws, setWs] = useState<Workspace | null>(null);
  const [bva, setBva] = useState<any>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/finance/society/reports/financial-years');
        setFys(res.data.financialYears || []);
        setFy(res.data.current || '');
      } catch { /* the server picks the current year when we send none */ }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const q = fy ? `?fy=${fy}` : '';
      const [w, v] = await Promise.all([
        api.get(`/finance/society/budget${q}`),
        api.get(`/finance/society/reports/budget-vs-actual${q}`),
      ]);
      setWs(w.data);
      setBva(v.data);
      // The saved budget is the source of truth for the inputs; a blank box means
      // "not budgeted", which is different from a budgeted zero.
      const saved: Record<string, string> = {};
      for (const l of w.data.budget?.lines || []) saved[l.accountCode] = String(l.budgetedPaise / 100);
      setAmounts(saved);
    } catch (e: any) {
      setError(e.response?.data?.error || 'The budget could not be loaded.');
    } finally { setLoading(false); }
  }, [fy]);
  useEffect(() => { load(); }, [load]);

  const lines = useMemo(() =>
    Object.entries(amounts)
      .filter(([, v]) => v.trim() !== '')
      .map(([accountCode, v]) => ({ accountCode, budgetedPaise: toPaise(v) })),
    [amounts]);

  const totalOf = (type: 'INCOME' | 'EXPENSE') =>
    (ws?.accounts || []).filter(a => a.type === type)
      .reduce((s, a) => s + toPaise(amounts[a.accountCode] || ''), 0);
  const budgetedIncome = totalOf('INCOME');
  const budgetedExpense = totalOf('EXPENSE');

  const approved = ws?.budget?.status === 'APPROVED';

  /** Societies budget by taking last year's actual and adjusting it — not from a blank grid. */
  const seedFromLastYear = () => {
    if (!ws) return;
    const seeded: Record<string, string> = { ...amounts };
    let filled = 0;
    for (const a of ws.accounts) {
      if (a.previousActualPaise > 0 && !seeded[a.accountCode]) {
        seeded[a.accountCode] = String(a.previousActualPaise / 100);
        filled++;
      }
    }
    setAmounts(seeded);
    showToast(filled ? `Filled ${filled} head(s) from FY ${ws.previousFinancialYear} — adjust them before saving` : `Nothing was posted in FY ${ws.previousFinancialYear} to copy`, filled ? 'success' : 'info');
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/finance/society/budget', { fy, lines });
      showToast('Budget saved', 'success');
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Could not save the budget', 'error');
    } finally { setSaving(false); }
  };

  const approve = async () => {
    const yes = await confirm({
      title: `Approve the FY ${fy} budget?`,
      message: 'This records that the general body adopted these figures, with your name and today’s date. Editing the budget afterwards puts it back into draft.',
      confirmText: 'Approve budget',
    });
    if (!yes) return;
    setSaving(true);
    try {
      await api.post(`/finance/society/budget/${fy}/approve`);
      showToast('Budget approved', 'success');
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Could not approve the budget', 'error');
    } finally { setSaving(false); }
  };

  // ---------------- renderers ----------------

  const entryGrid = (type: 'INCOME' | 'EXPENSE', title: string, hint: string) => {
    const rows = (ws?.accounts || []).filter(a => a.type === type);
    return (
      <div className="mb-6">
        <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">{title}</p>
        <p className="text-xs text-slate-500 mb-2">{hint}</p>
        <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
          <Table size="small" sx={{ minWidth: 560 }}>
            <TableHead><TableRow>
              <Th>Head</Th>
              <Th align="right">FY {ws?.previousFinancialYear} actual</Th>
              <Th align="right">Budget for FY {ws?.financialYear}</Th>
            </TableRow></TableHead>
            <TableBody className="bg-white">
              {rows.map(a => (
                <TableRow key={a.accountCode} hover>
                  <TableCell><span className="text-slate-700">{a.accountName}</span></TableCell>
                  <TableCell align="right"><span className="font-mono text-slate-400">{rupees(a.previousActualPaise)}</span></TableCell>
                  <TableCell align="right">
                    <TextField
                      hiddenLabel size="small" type="number" placeholder="—" className="w-36"
                      value={amounts[a.accountCode] ?? ''}
                      onChange={e => setAmounts(m => ({ ...m, [a.accountCode]: e.target.value }))}
                      slotProps={{ htmlInput: { style: { textAlign: 'right' } } }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
    );
  };

  const varianceTable = (title: string, section: VarianceSection) => (
    <div className="mb-6">
      <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">{title}</p>
      <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        <Table size="small" sx={{ minWidth: 680 }}>
          <TableHead><TableRow>
            <Th>Head</Th><Th align="right">Budgeted</Th><Th align="right">Actual</Th>
            <Th align="right">Variance</Th><Th align="right">%</Th>
          </TableRow></TableHead>
          <TableBody className="bg-white">
            {section.rows.map(r => (
              <TableRow key={r.code} hover>
                <TableCell>
                  <span className="text-slate-700">{r.name}</span>
                  {r.unbudgeted && (
                    <Chip label="not budgeted" size="small" className="ml-2 bg-amber-50 text-amber-700 font-bold" sx={{ height: 18, fontSize: 10 }} />
                  )}
                </TableCell>
                <TableCell align="right"><span className="font-mono text-slate-400">{rupees(r.budgetedPaise)}</span></TableCell>
                <TableCell align="right"><span className="font-mono">{rupees(r.actualPaise)}</span></TableCell>
                {/* Over and under mean opposite things by section, so colour by
                    what the server worked out, never by the sign. */}
                <TableCell align="right">
                  <span className={`font-mono font-bold ${r.variancePaise === 0 ? 'text-slate-400' : r.favourable ? 'text-emerald-600' : 'text-red-600'}`}>
                    {rupees(Math.abs(r.variancePaise))} {r.variancePaise === 0 ? '' : r.variancePaise > 0 ? 'over' : 'under'}
                  </span>
                </TableCell>
                <TableCell align="right">
                  <span className={`font-mono text-xs ${r.favourable ? 'text-emerald-600' : 'text-red-600'}`}>
                    {r.variancePercent === null ? '—' : `${r.variancePercent > 0 ? '+' : ''}${r.variancePercent.toFixed(2)}%`}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ '& td': { fontWeight: 800, borderTop: '2px solid #e2e8f0' } }}>
              <TableCell>Total</TableCell>
              <TableCell align="right"><span className="font-mono">{rupees(section.budgetedPaise)}</span></TableCell>
              <TableCell align="right"><span className="font-mono">{rupees(section.actualPaise)}</span></TableCell>
              <TableCell align="right"><span className="font-mono">{rupees(Math.abs(section.variancePaise))}</span></TableCell>
              <TableCell align="right"><span className="font-mono text-xs">{section.variancePercent === null ? '—' : `${section.variancePercent.toFixed(2)}%`}</span></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-300 pb-28">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Budget</h1>
          <p className="text-sm text-slate-500 mt-0.5">What the society plans to earn and spend this year — and how it is actually going</p>
        </div>
        <div className="flex gap-2 items-center">
          <Label>Year</Label>
          <FormControl size="small" className="min-w-[150px]">
            <Select value={fy} onChange={e => setFy(e.target.value)} displayEmpty>
              {fys.length === 0 && <MenuItem value="">Current year</MenuItem>}
              {fys.map(f => <MenuItem key={f.fy} value={f.fy}>FY {f.label}</MenuItem>)}
            </Select>
          </FormControl>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {([['SET', 'Set the budget'], ['COMPARE', 'Budget vs Actual']] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${tab === k ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-16"><CircularProgress size={30} /></div>
        : error ? (
          <div className="text-center py-12 px-6 border-2 border-dashed border-red-200 rounded-2xl bg-red-50/40">
            <p className="font-bold text-red-700 text-sm">The budget couldn’t be loaded.</p>
            <p className="text-xs text-red-600/80 mt-1">{error}</p>
            <Button onClick={load} size="small" variant="outlined" color="error" className="mt-3 font-bold">Try again</Button>
          </div>
        )
        : tab === 'SET' ? (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 flex gap-2">
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <span>
                Put a figure against each head the society expects to earn or spend on this year, then approve it —
                that is the budget the general body sanctions and the committee spends against. Leave a head blank if you
                aren’t budgeting for it; anything spent on a blank head still shows up under <b>Budget vs Actual</b>, flagged.
              </span>
            </div>

            {approved && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-sm text-emerald-800 flex gap-2 items-center">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  Approved by <b>{ws?.budget?.approvedByName}</b> on{' '}
                  {ws?.budget?.approvedAt ? new Date(ws.budget.approvedAt).toLocaleDateString('en-IN') : ''}. Editing it now puts it back into draft.
                </span>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={seedFromLastYear} size="small" variant="outlined" startIcon={<Wand2 className="w-4 h-4" />} className="font-bold">
                Fill from FY {ws?.previousFinancialYear} actuals
              </Button>
            </div>

            {entryGrid('INCOME', 'Income', 'What the society expects to collect — maintenance, parking, interest and the rest.')}
            {entryGrid('EXPENSE', 'Expenditure', 'What it expects to spend — security, housekeeping, repairs and the rest.')}

            <Paper elevation={2} className="rounded-2xl border border-slate-200/60 p-4 sticky bottom-4 bg-white/95 backdrop-blur">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex gap-6 flex-wrap">
                  <div><Label>Budgeted income</Label><p className="text-lg font-black text-slate-800">{rupees(budgetedIncome)}</p></div>
                  <div><Label>Budgeted spend</Label><p className="text-lg font-black text-slate-800">{rupees(budgetedExpense)}</p></div>
                  <div>
                    <Label>{budgetedIncome - budgetedExpense >= 0 ? 'Planned surplus' : 'Planned deficit'}</Label>
                    <p className={`text-lg font-black ${budgetedIncome - budgetedExpense >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {rupees(Math.abs(budgetedIncome - budgetedExpense))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={save} disabled={saving} variant="contained" startIcon={<Save className="w-4 h-4" />} className="font-bold px-5 py-2.5">
                    {saving ? <CircularProgress size={18} color="inherit" /> : 'Save budget'}
                  </Button>
                  <Button
                    onClick={approve}
                    disabled={saving || approved || !ws?.budget?.lines?.length}
                    variant="outlined" color="success" className="font-bold px-5 py-2.5"
                  >
                    {approved ? 'Approved' : 'Approve'}
                  </Button>
                </div>
              </div>
              {!approved && !!ws?.budget?.lines?.length && (
                <p className="text-xs text-slate-500 mt-2">Saved as a draft. Approve it once the general body has adopted it.</p>
              )}
              {!ws?.budget?.lines?.length && (
                <p className="text-xs text-slate-500 mt-2">Save the budget before you can approve it.</p>
              )}
            </Paper>
          </>
        ) : !bva?.hasBudget ? (
          <div className="text-center py-12 px-6 border-2 border-dashed border-slate-200 rounded-2xl">
            <p className="font-bold text-slate-600 text-sm">No budget set for FY {bva?.period?.financialYear}.</p>
            <p className="text-xs text-slate-500 mt-1">Set one under “Set the budget” and this page will show how the year is running against it.</p>
          </div>
        ) : (
          <>
            {!!bva.unbudgetedSpendPaise && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span><b>{rupees(bva.unbudgetedSpendPaise)}</b> was spent on heads that were never budgeted. They are flagged below.</span>
              </div>
            )}
            {varianceTable('Income', bva.income)}
            {varianceTable('Expenditure', bva.expenses)}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Paper elevation={0} className="p-4 rounded-2xl border border-slate-200/60">
                <Label>Planned surplus</Label>
                <p className="text-xl font-black text-slate-800">{rupees(bva.budgetedSurplusPaise)}</p>
              </Paper>
              <Paper elevation={0} className="p-4 rounded-2xl border border-slate-200/60">
                <Label>Actual surplus so far</Label>
                <p className={`text-xl font-black ${bva.actualSurplusPaise >= bva.budgetedSurplusPaise ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {rupees(bva.actualSurplusPaise)}
                </p>
              </Paper>
            </div>
          </>
        )}
    </div>
  );
}
