'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import {
  Paper, CircularProgress, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  TextField, Button, FormControl, Select, MenuItem, TablePagination, Tooltip,
} from '@mui/material';
import { FileText, Sheet, Info, ChevronRight, FileArchive } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { REPORTS, GROUPS, reportByKey } from './reportCatalog';
import AccountLedgerDialog from './AccountLedgerDialog';

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const shortDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');
const money = (p?: number) => <span className="font-mono">{rupees(p)}</span>;
const Th = (props: any) => <TableCell sx={{ fontWeight: 700 }} {...props} />;

interface FyOption { fy: string; label: string; from: string; to: string }
type Preset = 'FY' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';

const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function ReportsPage() {
  const { showToast } = useToastConfirm();
  const [key, setKey] = useState('income-expenditure');
  const report = reportByKey(key)!;

  const [fys, setFys] = useState<FyOption[]>([]);
  const [fy, setFy] = useState('');
  const [asOf, setAsOf] = useState(isoDate(new Date()));
  const [preset, setPreset] = useState<Preset>('FY');
  const [custom, setCustom] = useState({ from: '', to: '' });

  const [data, setData] = useState<any>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const [drill, setDrill] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(25);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/finance/society/reports/financial-years');
        setFys(res.data.financialYears || []);
        setFy(res.data.current || '');
      } catch { /* the picker falls back to the server default */ }
    })();
  }, []);

  /** The from/to a RANGE report should use, derived from the visible period control. */
  const range = useMemo(() => {
    const now = new Date();
    if (preset === 'THIS_MONTH') {
      return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    }
    if (preset === 'LAST_MONTH') {
      return { from: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: isoDate(new Date(now.getFullYear(), now.getMonth(), 0)) };
    }
    if (preset === 'CUSTOM') return custom;
    const opt = fys.find(f => f.fy === fy);
    return opt ? { from: isoDate(new Date(opt.from)), to: isoDate(new Date(opt.to)) } : { from: '', to: '' };
  }, [preset, custom, fys, fy]);

  /** Query string for the current report + period. Shared by the view and the exports. */
  const query = useCallback(() => {
    const p = new URLSearchParams();
    if (report.period === 'FY' && fy) p.append('fy', fy);
    if (report.period === 'ASOF' && asOf) p.append('asOf', asOf);
    if (report.period === 'RANGE') {
      if (range.from) p.append('from', range.from);
      if (range.to) p.append('to', range.to);
    }
    return p.toString();
  }, [report.period, fy, asOf, range]);

  const load = useCallback(async () => {
    try {
      setLoading(true); setData(null); setLoadedKey(''); setError(''); setPage(0);
      const res = await api.get(`/finance/society/reports/${key}?${query()}`);
      setData(res.data); setLoadedKey(key);
    } catch (e: any) {
      // A failed report and a society with no transactions are different things.
      setError(e.response?.data?.error || e.message || 'This report could not be loaded.');
    } finally { setLoading(false); }
  }, [key, query]);
  useEffect(() => { load(); }, [load]);

  /** Exports go through axios so the bearer token (held in memory) is attached. */
  const stream = async (path: string, fallbackName: string, what: string) => {
    try {
      const res = await api.get(path, { responseType: 'blob' });
      const cd = res.headers['content-disposition'] || '';
      const name = /filename="?([^"]+)"?/.exec(cd)?.[1] || fallbackName;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showToast(`Could not export ${what}`, 'error');
    }
  };

  const download = async (format: 'pdf' | 'xlsx') => {
    setExporting(format);
    await stream(`/finance/society/reports/${key}/export?format=${format}&${query()}`, `${key}.${format}`, 'this report');
    setExporting('');
  };

  /**
   * The whole AGM pack in one file. Always the FY picker's year, never the
   * visible report's period — a pack is a year's accounts, and building one for
   * "last month" because a range report happened to be open would be nonsense.
   */
  const downloadPack = async () => {
    setExporting('pack');
    await stream(`/finance/society/reports/agm-pack/export?format=pdf${fy ? `&fy=${fy}` : ''}`, 'agm-pack.pdf', 'the AGM pack');
    setExporting('');
  };

  const periodLabel = report.period === 'FY'
    ? `FY ${fys.find(f => f.fy === fy)?.label || fy}`
    : report.period === 'ASOF'
      ? `As at ${shortDate(asOf)}`
      : `${shortDate(range.from)} — ${shortDate(range.to)}`;

  // ---------------- renderers ----------------
  const table = (cols: string[], rows: React.ReactNode[][], foot?: React.ReactNode[], onRow?: (i: number) => void) => (
    <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
      <Table size="small" sx={{ minWidth: 640 }}>
        <TableHead><TableRow>{cols.map((c, i) => <Th key={i} align={i === 0 ? 'left' : 'right'}>{c}</Th>)}</TableRow></TableHead>
        <TableBody className="bg-white">
          {rows.map((r, i) => (
            <TableRow key={i} hover={!!onRow} onClick={() => onRow?.(i)} sx={onRow ? { cursor: 'pointer' } : undefined}>
              {r.map((c, j) => <TableCell key={j} align={j === 0 ? 'left' : 'right'}>{c}</TableCell>)}
            </TableRow>
          ))}
          {foot && <TableRow sx={{ '& td': { fontWeight: 800, borderTop: '2px solid #e2e8f0' } }}>{foot.map((c, j) => <TableCell key={j} align={j === 0 ? 'left' : 'right'}>{c}</TableCell>)}</TableRow>}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6"><p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">{title}</p>{children}</div>
  );

  /** Registers can run to thousands of rows; never render them all at once. */
  const paged = (rows: any[]): any[] => rows.slice(page * rpp, page * rpp + rpp);
  const pager = (total: number) => (
    <TablePagination
      component="div" count={total} page={page} rowsPerPage={rpp}
      onPageChange={(_, p) => setPage(p)}
      onRowsPerPageChange={e => { setRpp(parseInt(e.target.value, 10)); setPage(0); }}
      rowsPerPageOptions={[25, 50, 100]}
    />
  );

  const comparativeCols = (prevLabel?: string) => ['Particulars', 'Amount', prevLabel || 'Previous year'];
  const comparativeRows = (rows: any[]) => rows.map((r: any) => [
    <span key="n" className="flex items-center gap-1 text-slate-700">{r.name}<ChevronRight className="w-3 h-3 text-slate-300" /></span>,
    money(r.amountPaise), <span key="p" className="text-slate-400">{rupees(r.previousAmountPaise)}</span>,
  ]);

  /**
   * Balance-sheet rows, flattened so a heading (Fixed Assets) shows its net and
   * the accounts beneath it are indented. Accumulated depreciation arrives as a
   * negative, so it reads as the deduction it is.
   */
  const scheduleRows = (rows: any[]): { cells: React.ReactNode[]; code: string }[] =>
    rows.flatMap((r: any) => [
      {
        code: r.code,
        cells: [
          <span key="n" className={r.children?.length ? 'font-bold text-slate-800' : 'flex items-center gap-1 text-slate-700'}>
            {r.name}{!r.children?.length && <ChevronRight className="w-3 h-3 text-slate-300" />}
          </span>,
          money(r.amountPaise),
          <span key="p" className="text-slate-400">{rupees(r.previousAmountPaise)}</span>,
        ],
      },
      ...(r.children || []).map((c: any) => ({
        code: c.code,
        cells: [
          <span key="n" className="flex items-center gap-1 pl-5 text-slate-500 text-sm">
            {c.name}<ChevronRight className="w-3 h-3 text-slate-300" />
          </span>,
          <span key="a" className={`font-mono ${c.amountPaise < 0 ? 'text-slate-400' : 'text-slate-600'}`}>{rupees(c.amountPaise)}</span>,
          <span key="p" className="text-slate-300">{rupees(c.previousAmountPaise)}</span>,
        ],
      })),
    ]);

  const render = () => {
    if (!data) return <div className="text-center py-16 text-slate-400 text-sm font-semibold">Nothing recorded for this period yet.</div>;
    switch (key) {
      case 'income-expenditure': {
        const prev = data.period?.previousFinancialYear;
        return (<>
          <Section title="Income">
            {table(comparativeCols(prev), comparativeRows(data.income),
              ['Total Income', money(data.totalIncomePaise), <span key="p" className="text-slate-400">{rupees(data.previousTotalIncomePaise)}</span>],
              i => setDrill(data.income[i].code))}
          </Section>
          <Section title="Expenditure">
            {table(comparativeCols(prev), comparativeRows(data.expenses),
              ['Total Expenditure', money(data.totalExpensePaise), <span key="p" className="text-slate-400">{rupees(data.previousTotalExpensePaise)}</span>],
              i => setDrill(data.expenses[i].code))}
          </Section>
          <div className={`p-4 rounded-2xl font-black ${data.surplusPaise >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {data.surplusPaise >= 0 ? 'Surplus' : 'Deficit'} for {data.period?.financialYear}: {rupees(Math.abs(data.surplusPaise))}
          </div>
        </>);
      }
      case 'wing-wise': {
        const cols = [...(data.wings || []), data.common].filter(Boolean);
        if (!data.wings?.length) return (
          <div className="text-center py-16 text-slate-500 text-sm font-semibold">
            This society has no wings set up, so there is nothing to compare.
          </div>
        );
        return (<>
          <Section title="Summary">
            {table(['Wing', 'Income', 'Expenditure', 'Surplus / (Deficit)'],
              cols.map((c: any) => [
                <span key="n" className={c.blockId ? 'text-slate-700 font-semibold' : 'text-slate-500 italic'}>{c.label}</span>,
                money(c.totalIncomePaise), money(c.totalExpensePaise),
                <span key="s" className={`font-mono font-bold ${c.surplusPaise >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{rupees(c.surplusPaise)}</span>,
              ]),
              ['Total', money(data.totals?.totalIncomePaise), money(data.totals?.totalExpensePaise), money(data.totals?.surplusPaise)])}
          </Section>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            Costs shared by the whole society — security, common electricity, the auditor&apos;s fee — sit in
            <b> Common</b> and are not split across wings. Dividing them needs a rule your society has to agree
            (per flat, per square foot, per share), so this report leaves them visible rather than guessing.
            Tag an expense to a wing when you record it to see it here. These totals tie back to the
            Income &amp; Expenditure statement.
          </p>
          {cols.filter((c: any) => c.income.length || c.expenses.length).map((c: any) => (
            <Section key={c.blockId || 'common'} title={c.label}>
              {table(['Particulars', 'Amount'], [
                ...c.income.map((l: any) => [<span key="n" className="text-slate-700">{l.name}</span>, money(l.amountPaise)]),
                ...c.expenses.map((l: any) => [<span key="n" className="text-slate-500 pl-3">{l.name}</span>, <span key="a" className="font-mono text-slate-600">({rupees(l.amountPaise)})</span>]),
              ], ['Surplus / (Deficit)', money(c.surplusPaise)])}
            </Section>
          ))}
        </>);
      }
      case 'balance-sheet': {
        const prev = data.previous?.financialYear;
        const funding = [...data.liabilities, ...data.funds, ...data.equity];
        const assetRows = scheduleRows(data.assets);
        const fundingRows = scheduleRows(funding);
        return (<>
          <Section title="Assets">
            {table(comparativeCols(prev), assetRows.map(r => r.cells),
              ['Total Assets', money(data.assetsTotalPaise), <span key="p" className="text-slate-400">{rupees(data.previous?.assetsTotalPaise)}</span>],
              i => setDrill(assetRows[i].code))}
          </Section>
          <Section title="Liabilities, Funds & Surplus">
            {table(comparativeCols(prev), [
              ...fundingRows.map(r => r.cells),
              ['Accumulated Surplus (brought forward)', money(data.accumulatedSurplusPaise), <span key="p" className="text-slate-400">—</span>],
              [`Surplus for ${data.financialYear}`, money(data.currentSurplusPaise), <span key="p" className="text-slate-400">—</span>],
            ], ['Total', money(data.liabilitiesPlusFundsPlusEquityPaise), <span key="p" className="text-slate-400">{rupees(data.previous?.liabilitiesPlusFundsPlusEquityPaise)}</span>])}
          </Section>
          <div className={`p-3 rounded-xl text-sm font-bold ${data.balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {data.balanced
              ? '✓ Assets equal liabilities, funds and surplus — the sheet balances.'
              : `⚠ Off by ${rupees(Math.abs(data.differencePaise))}. Post the society’s opening balances (Finance → Opening Balances).`}
          </div>
        </>);
      }
      case 'receipts-payments':
        return (<>
          <div className="text-sm text-slate-600 mb-3">Opening cash &amp; bank <b>{rupees(data.openingPaise)}</b> · Closing <b>{rupees(data.closingPaise)}</b></div>
          <Section title="Receipts">{table(['Head', 'Amount'], data.receipts.map((r: any) => [r.name, money(r.amountPaise)]), ['Total Receipts', money(data.totalReceiptsPaise)], i => setDrill(data.receipts[i].code))}</Section>
          <Section title="Payments">{table(['Head', 'Amount'], data.payments.map((r: any) => [r.name, money(r.amountPaise)]), ['Total Payments', money(data.totalPaymentsPaise)], i => setDrill(data.payments[i].code))}</Section>
        </>);
      case 'trial-balance':
        return (<>
          {table(['Account', 'Debit', 'Credit'],
            paged(data.rows).map((r: any) => [`${r.code} · ${r.name}`, money(r.debitPaise), money(r.creditPaise)]),
            ['Total', money(data.totalDebitPaise), money(data.totalCreditPaise)],
            i => setDrill(paged(data.rows)[i].code))}
          {pager(data.rows.length)}
          {/* Dr/Cr always tie — every voucher is balanced when posted, so that
              equality proves nothing. Drift is the real integrity signal. */}
          <div className={`mt-4 p-3 rounded-xl text-sm font-bold ${data.drift?.length ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {data.drift?.length
              ? `⚠ ${data.drift.length} account(s) drifted from the ledger by ${rupees(data.driftTotalPaise)} — the shown balance no longer matches the posted entries.`
              : '✓ Every account’s balance matches its posted entries.'}
          </div>
          {!!data.drift?.length && <div className="mt-3">{table(['Account', 'Shown', 'Per ledger', 'Drift'], data.drift.map((d: any) => [`${d.code} · ${d.name}`, money(d.cachedBalancePaise), money(d.ledgerBalancePaise), money(d.driftPaise)]))}</div>}
        </>);
      case 'defaulters':
        return (<>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {([['Not due / ≤30 days', data.buckets.current, 'text-slate-700'], ['31–60 days', data.buckets.d31_60, 'text-amber-600'],
              ['61–90 days', data.buckets.d61_90, 'text-orange-600'], ['Over 90 days', data.buckets.d90plus, 'text-red-600']] as const).map(([l, v, c]) => (
              <Paper key={l} elevation={0} className="p-3 rounded-2xl border border-slate-200/60">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{l}</p>
                <p className={`text-lg font-black ${c}`}>{rupees(v as number)}</p>
              </Paper>
            ))}
          </div>
          {table(['Flat', 'Owner', 'Oldest due', '≤30d', '31–60d', '61–90d', '90d+', 'Total'],
            paged(data.rows).map((r: any) => [
              `${r.blockName} ${r.flatNumber}`, r.ownerName || '—', shortDate(r.oldestDue),
              money(r.buckets.current), money(r.buckets.d31_60), money(r.buckets.d61_90),
              <span key="x" className={r.buckets.d90plus > 0 ? 'font-bold text-red-600 font-mono' : 'font-mono'}>{rupees(r.buckets.d90plus)}</span>,
              money(r.outstandingPaise),
            ]),
            ['Total', '', '', money(data.buckets.current), money(data.buckets.d31_60), money(data.buckets.d61_90), money(data.buckets.d90plus), money(data.totalPaise)])}
          {pager(data.rows.length)}
        </>);
      case 'collection-register':
        return (<>
          {table(['Receipt', 'Date', 'Flat', 'Mode', 'Amount'],
            paged(data.rows).map((r: any) => [r.receiptNumber, shortDate(r.receiptDate), `${r.blockName || ''} ${r.flatNumber || ''}`.trim(), r.mode, money(r.amountPaise)]),
            ['Total', '', '', '', money(data.totalPaise)])}
          {pager(data.rows.length)}
        </>);
      case 'fund-statement':
        return table(['Fund', 'Balance'], data.rows.map((r: any) => [`${r.code} · ${r.name}`, money(r.balancePaise)]),
          ['Total Funds', money(data.totalPaise)], i => setDrill(data.rows[i].code));
      case 'gst-register':
        return (<>
          <Section title="Month by month">
            {table(['Month', 'Invoices', 'Taxable value', 'CGST', 'SGST', 'Total GST'],
              data.months.map((m: any) => [m.month, m.invoices, money(m.taxableValuePaise), money(m.cgstPaise), money(m.sgstPaise), money(m.gstPaise)]),
              ['Total', data.rows.length, money(data.totalTaxableValuePaise), '', '', money(data.totalGstPaise)])}
          </Section>
          <Section title="Invoice by invoice">
            {table(['Invoice', 'Date', 'Flat', 'SAC', 'Rate %', 'Taxable value', 'CGST', 'SGST'],
              paged(data.rows).map((r: any) => [r.invoiceNumber, shortDate(r.invoiceDate), r.flat, r.sacCode || '—', r.ratePercent ?? '—', money(r.taxableValuePaise), money(r.cgstPaise), money(r.sgstPaise)]))}
            {pager(data.rows.length)}
          </Section>
        </>);
      case 'tds-register':
        return (<>
          {!!data.missingPan?.length && (
            <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800 flex gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>No PAN on record for <b>{data.missingPan.join(', ')}</b>. A deductee without a PAN attracts a higher rate and will hold up your Form 26Q — add it under Expenses → Vendors.</span>
            </div>
          )}
          <Section title="By deductee (what Form 26Q needs)">
            {table(['Deductee', 'PAN', 'Section', 'Deductions', 'Gross paid', 'TDS'],
              data.deductees.map((d: any) => [d.vendorName, d.pan || <span key="x" className="text-amber-600 font-semibold">missing</span>, d.section || '—', d.deductions, money(d.grossPaise), money(d.tdsPaise)]),
              ['Total', '', '', data.deductions, money(data.totalGrossPaise), money(data.totalTdsPaise)])}
          </Section>
          <Section title="By quarter">
            {table(['Quarter', 'Deductions', 'TDS'], data.quarters.map((q: any) => [q.quarter, q.deductions, money(q.tdsPaise)]))}
          </Section>
          <Section title="Voucher by voucher">
            {table(['Voucher', 'Date', 'Deductee', 'Gross', 'TDS'],
              paged(data.rows).map((r: any) => [r.voucherNumber, shortDate(r.expenseDate), r.vendorName, money(r.grossPaise), money(r.tdsPaise)]))}
            {pager(data.rows.length)}
          </Section>
        </>);
      default: return null;
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Financial Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Every figure below is calculated from the society’s posted entries</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => download('pdf')} disabled={!!exporting || !data} variant="outlined" startIcon={exporting === 'pdf' ? <CircularProgress size={14} /> : <FileText className="w-4 h-4" />} className="font-bold">PDF</Button>
          <Button onClick={() => download('xlsx')} disabled={!!exporting || !data} variant="outlined" startIcon={exporting === 'xlsx' ? <CircularProgress size={14} /> : <Sheet className="w-4 h-4" />} className="font-bold">Excel</Button>
          {/* The pack is the reason most of these reports get run at all — it
              shouldn't be something you assemble by downloading six PDFs. */}
          <Tooltip title="Every statement the AGM needs — Balance Sheet, Income & Expenditure, Receipts & Payments, funds, budget and dues — in one PDF">
            <span>
              <Button onClick={downloadPack} disabled={!!exporting} variant="contained" startIcon={exporting === 'pack' ? <CircularProgress size={14} color="inherit" /> : <FileArchive className="w-4 h-4" />} className="font-bold whitespace-nowrap">
                Download AGM pack
              </Button>
            </span>
          </Tooltip>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Grouped rail — nine flat tabs gave no clue which report to reach for. */}
        <div className="lg:col-span-3 space-y-4">
          {GROUPS.map(group => (
            <div key={group}>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 px-1">{group}</p>
              <div className="space-y-1">
                {REPORTS.filter(r => r.group === group).map(r => (
                  <button
                    key={r.key}
                    onClick={() => setKey(r.key)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm font-bold transition ${
                      key === r.key ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-9 space-y-4">
          {/* What this is, in plain words. */}
          <Paper elevation={0} className="rounded-2xl border border-slate-200/60 p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[260px]">
                <h2 className="text-lg font-black text-slate-800">{report.label}</h2>
                <p className="text-sm text-slate-600 mt-1">{report.what}</p>
                <p className="text-xs text-slate-500 mt-1.5"><b className="text-slate-600">Who needs it:</b> {report.who}</p>
              </div>
              <Tooltip title="The period this report covers">
                <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-black text-slate-600 whitespace-nowrap">{periodLabel}</div>
              </Tooltip>
            </div>

            {/* One period control, always in the same place — it used to appear on
                some reports and vanish on others, shifting the layout. */}
            <div className="flex flex-wrap gap-2 items-center mt-4 pt-4 border-t border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Period</span>
              {report.period === 'FY' && (
                <FormControl size="small" className="min-w-[160px]">
                  <Select value={fy} onChange={e => setFy(e.target.value)} displayEmpty>
                    {fys.length === 0 && <MenuItem value="">Current year</MenuItem>}
                    {fys.map(f => <MenuItem key={f.fy} value={f.fy}>FY {f.label}</MenuItem>)}
                  </Select>
                </FormControl>
              )}
              {report.period === 'ASOF' && (
                <TextField size="small" type="date" value={asOf} onChange={e => setAsOf(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              )}
              {report.period === 'RANGE' && (<>
                <FormControl size="small" className="min-w-[150px]">
                  <Select value={preset} onChange={e => setPreset(e.target.value as Preset)}>
                    <MenuItem value="FY">Financial year</MenuItem>
                    <MenuItem value="THIS_MONTH">This month</MenuItem>
                    <MenuItem value="LAST_MONTH">Last month</MenuItem>
                    <MenuItem value="CUSTOM">Custom dates</MenuItem>
                  </Select>
                </FormControl>
                {preset === 'FY' && (
                  <FormControl size="small" className="min-w-[150px]">
                    <Select value={fy} onChange={e => setFy(e.target.value)} displayEmpty>
                      {fys.length === 0 && <MenuItem value="">Current year</MenuItem>}
                      {fys.map(f => <MenuItem key={f.fy} value={f.fy}>FY {f.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                )}
                {preset === 'CUSTOM' && (<>
                  <TextField size="small" type="date" label="From" value={custom.from} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField size="small" type="date" label="To" value={custom.to} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} slotProps={{ inputLabel: { shrink: true } }} />
                </>)}
              </>)}
            </div>
          </Paper>

          {loading ? <div className="flex justify-center py-16"><CircularProgress size={30} /></div>
            : error ? (
              <div className="text-center py-12 px-6 border-2 border-dashed border-red-200 rounded-2xl bg-red-50/40">
                <p className="font-bold text-red-700 text-sm">This report couldn’t be loaded.</p>
                <p className="text-xs text-red-600/80 mt-1">{error}</p>
                <Button onClick={load} size="small" variant="outlined" color="error" className="mt-3 font-bold">Try again</Button>
              </div>
            )
            : loadedKey !== key ? <div className="flex justify-center py-16"><CircularProgress size={30} /></div>
            : render()}
        </div>
      </div>

      <AccountLedgerDialog
        code={drill}
        from={report.period === 'RANGE' ? range.from : undefined}
        to={report.period === 'RANGE' ? range.to : report.period === 'ASOF' ? asOf : undefined}
        onClose={() => setDrill(null)}
      />
    </div>
  );
}
