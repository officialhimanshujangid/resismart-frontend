'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Paper, CircularProgress, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Tabs, Tab, TextField,
} from '@mui/material';

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const REPORTS = [
  { key: 'trial-balance', label: 'Trial Balance', period: false },
  { key: 'income-expenditure', label: 'Income & Expenditure', period: false },
  { key: 'balance-sheet', label: 'Balance Sheet', period: false },
  { key: 'receipts-payments', label: 'Receipts & Payments', period: true },
  { key: 'defaulters', label: 'Defaulters', period: false },
  { key: 'collection-register', label: 'Collections', period: true },
  { key: 'fund-statement', label: 'Funds', period: false },
  { key: 'gst-register', label: 'GST', period: true },
  { key: 'tds-register', label: 'TDS', period: true },
];

const Th = (props: any) => <TableCell sx={{ fontWeight: 700 }} {...props} />;
const money = (p?: number) => <span className="font-mono">{rupees(p)}</span>;

export default function ReportsPage() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [loadedKey, setLoadedKey] = useState(''); // which report the current `data` belongs to
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const report = REPORTS[tab];

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setData(null); setLoadedKey('');
      const params = new URLSearchParams();
      if (report.period && from) params.append('from', from);
      if (report.period && to) params.append('to', to);
      const res = await api.get(`/finance/society/reports/${report.key}?${params.toString()}`);
      setData(res.data); setLoadedKey(report.key);
    } catch { setData(null); } finally { setLoading(false); }
  }, [report.key, report.period, from, to]);
  useEffect(() => { load(); }, [load]);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6"><p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">{title}</p>{children}</div>
  );
  const rowsTable = (cols: string[], rows: any[][], foot?: any[]) => (
    <TableContainer component={Paper} elevation={0} className="rounded-2xl border border-slate-200/60 overflow-x-auto">
      <Table size="small">
        <TableHead><TableRow>{cols.map((c, i) => <Th key={i} align={i === 0 ? 'left' : 'right'}>{c}</Th>)}</TableRow></TableHead>
        <TableBody>
          {rows.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j} align={j === 0 ? 'left' : 'right'}>{c}</TableCell>)}</TableRow>)}
          {foot && <TableRow sx={{ '& td': { fontWeight: 800, borderTop: '2px solid #e2e8f0' } }}>{foot.map((c, j) => <TableCell key={j} align={j === 0 ? 'left' : 'right'}>{c}</TableCell>)}</TableRow>}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const render = () => {
    if (!data) return <div className="text-center py-16 text-slate-400 text-sm">No data.</div>;
    switch (report.key) {
      case 'trial-balance':
        return rowsTable(['Account', 'Debit', 'Credit'], data.rows.map((r: any) => [`${r.code} · ${r.name}`, money(r.debitPaise), money(r.creditPaise)]), ['Total', money(data.totalDebitPaise), money(data.totalCreditPaise)]);
      case 'income-expenditure':
        return (<>
          <Section title="Income">{rowsTable(['Head', 'Amount'], data.income.map((r: any) => [r.name, money(r.amountPaise)]), ['Total Income', money(data.totalIncomePaise)])}</Section>
          <Section title="Expenditure">{rowsTable(['Head', 'Amount'], data.expenses.map((r: any) => [r.name, money(r.amountPaise)]), ['Total Expenditure', money(data.totalExpensePaise)])}</Section>
          <div className={`p-4 rounded-2xl font-black ${data.surplusPaise >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{data.surplusPaise >= 0 ? 'Surplus' : 'Deficit'}: {rupees(Math.abs(data.surplusPaise))}</div>
        </>);
      case 'balance-sheet':
        return (<>
          <Section title="Assets">{rowsTable(['Head', 'Amount'], data.assets.map((r: any) => [r.name, money(r.amountPaise)]), ['Total Assets', money(data.assetsTotalPaise)])}</Section>
          <Section title="Liabilities, Funds & Surplus">{rowsTable(['Head', 'Amount'], [...data.liabilities, ...data.funds, ...data.equity].map((r: any) => [r.name, money(r.amountPaise)]).concat([['Current Surplus', money(data.currentSurplusPaise)]]), ['Total', money(data.liabilitiesPlusFundsPlusEquityPaise)])}</Section>
          <div className={`p-3 rounded-xl text-sm font-bold ${data.balanced ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{data.balanced ? '✓ Balanced' : '⚠ Not balanced — check opening balances'}</div>
        </>);
      case 'receipts-payments':
        return (<>
          <div className="text-sm text-slate-600 mb-3">Opening cash/bank: <b>{rupees(data.openingPaise)}</b> · Closing: <b>{rupees(data.closingPaise)}</b></div>
          <Section title="Receipts">{rowsTable(['Head', 'Amount'], data.receipts.map((r: any) => [r.name, money(r.amountPaise)]), ['Total Receipts', money(data.totalReceiptsPaise)])}</Section>
          <Section title="Payments">{rowsTable(['Head', 'Amount'], data.payments.map((r: any) => [r.name, money(r.amountPaise)]), ['Total Payments', money(data.totalPaymentsPaise)])}</Section>
        </>);
      case 'defaulters':
        return rowsTable(['Flat', 'Owner', 'Invoices', 'Oldest due', 'Outstanding'], data.rows.map((r: any) => [`${r.flatNumber} · ${r.blockName}`, r.ownerName || '—', r.invoices, r.oldestDue ? new Date(r.oldestDue).toLocaleDateString('en-IN') : '—', money(r.outstandingPaise)]), ['Total', '', '', '', money(data.totalPaise)]);
      case 'collection-register':
        return rowsTable(['Receipt', 'Flat', 'Mode', 'Date', 'Amount'], data.rows.map((r: any) => [r.receiptNumber, r.flatNumber, r.mode, new Date(r.receiptDate).toLocaleDateString('en-IN'), money(r.amountPaise)]), ['Total', '', '', '', money(data.totalPaise)]);
      case 'fund-statement':
        return rowsTable(['Fund', 'Balance'], data.rows.map((r: any) => [r.name, money(r.balancePaise)]), ['Total Funds', money(data.totalPaise)]);
      case 'gst-register':
        return rowsTable(['Financial Year', 'Invoices', 'GST Collected'], (data.rows || []).map((r: any) => [r.financialYear, r.invoices, money(r.gstPaise)]), ['Total GST', '', money(data.totalGstPaise)]);
      case 'tds-register':
        return <div className="p-6 rounded-2xl border border-slate-200/60 bg-white"><p className="text-sm text-slate-500">TDS deducted on vendor payments</p><p className="text-3xl font-black text-slate-800 mt-1">{rupees(data.totalTdsPaise)}</p><p className="text-xs text-slate-400 mt-1">{data.deductions} deduction(s)</p></div>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div><h1 className="text-2xl font-black text-slate-800 tracking-tight">Financial Reports</h1>
        <p className="text-sm text-slate-500 mt-0.5">Statutory statements and registers, derived from the ledger</p></div>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
        {REPORTS.map(r => <Tab key={r.key} label={r.label} />)}
      </Tabs>

      {report.period && (
        <div className="flex gap-2">
          <TextField size="small" type="date" label="From" value={from} onChange={e => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField size="small" type="date" label="To" value={to} onChange={e => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        </div>
      )}

      {loading || loadedKey !== report.key ? <div className="flex justify-center py-16"><CircularProgress size={30} /></div> : render()}
    </div>
  );
}
