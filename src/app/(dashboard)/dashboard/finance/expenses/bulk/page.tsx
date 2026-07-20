'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import {
  Paper, Button, TextField, CircularProgress, Radio, RadioGroup, FormControlLabel,
  Checkbox, Select, MenuItem, FormControl, Chip, Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import {
  Upload, Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Copy,
  ArrowRight, Info,
} from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

/**
 * Recording many expenses at once.
 *
 * The one thing this screen must never do is surprise anyone about money. So:
 * nothing posts without a preview, the preview counts what will actually post
 * (not what was in the file), and both warnings — "you may have already
 * recorded this" and "you cannot approve your own" — appear BEFORE the button,
 * not after the result.
 */

type Shape = 'ONE_VOUCHER' | 'PER_ROW';

interface PreviewRow { rowNumber: number; data: Record<string, string>; status: 'CREATE' | 'SKIP' | 'ERROR'; message?: string }
interface PreviewResult {
  columns: string[];
  rows: PreviewRow[];
  totals: { rows: number; create: number; error: number };
  totalAmountPaise: number;
  summary: string;
  duplicateWarning?: string;
  approvalWarning?: string;
}

const rupees = (p: number) => `₹${(p / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function BulkExpensePage() {
  const { showToast } = useToastConfirm();
  const router = useRouter();

  const [shape, setShape] = useState<Shape>('PER_ROW');
  const [alreadyPaid, setAlreadyPaid] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'BANK' | 'CASH' | 'CHEQUE' | 'UPI'>('BANK');
  const [periodLabel, setPeriodLabel] = useState('');
  const [defaultDate, setDefaultDate] = useState('');

  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);

  /** Everything the two calls share, so preview and commit cannot drift. */
  const formData = () => {
    const fd = new FormData();
    if (file) fd.append('file', file);
    if (csvText.trim()) fd.append('csvText', csvText.trim());
    fd.append('shape', shape);
    fd.append('alreadyPaid', String(alreadyPaid));
    fd.append('paymentMode', paymentMode);
    if (periodLabel) fd.append('periodLabel', periodLabel);
    if (defaultDate) fd.append('defaultDate', defaultDate);
    return fd;
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.get('/finance/society/expenses/bulk/template', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = 'expenses-template.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Could not build the template', 'error');
    }
  };

  const runPreview = async () => {
    if (!file && !csvText.trim()) return showToast('Choose a file or paste your rows first', 'error');
    setBusy(true);
    try {
      const res = await api.post('/finance/society/expenses/bulk/preview', formData());
      setPreview(res.data?.data);
    } catch (e: any) {
      setPreview(null);
      showToast(e.response?.data?.message || 'Could not read that file', 'error');
    } finally { setBusy(false); }
  };

  const runCommit = async () => {
    setBusy(true);
    try {
      const res = await api.post('/finance/society/expenses/bulk/commit', formData());
      const d = res.data?.data;
      showToast(d?.summary || 'Recorded', 'success');
      router.push('/dashboard/finance/expenses');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not record those expenses', 'error');
    } finally { setBusy(false); }
  };

  // Re-previewing on every option change would be noise; the options change what
  // commit does, so a stale preview must not be trusted.
  const invalidate = <T,>(set: (v: T) => void) => (v: T) => { setPreview(null); set(v); };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-24">
      <div>
        <h1 className="text-xl font-black text-slate-900">Record many expenses at once</h1>
        <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
          For the month&apos;s bills, the staff payments, or a year of history you are moving across.
          Nothing is recorded until you have seen exactly what will happen.
        </p>
      </div>

      {/* ------------------------------------------------------------ options */}
      <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4 space-y-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            How should I read this file?
          </span>
          <RadioGroup value={shape} onChange={e => invalidate(setShape)(e.target.value as Shape)} className="!mt-1">
            <FormControlLabel value="PER_ROW" control={<Radio size="small" />} label={
              <span className="text-sm text-slate-700">
                <strong>Each row is a separate expense</strong>
                <span className="text-slate-500"> — several different bills</span>
              </span>
            } />
            <FormControlLabel value="ONE_VOUCHER" control={<Radio size="small" />} label={
              <span className="text-sm text-slate-700">
                <strong>The whole file is one expense</strong>
                <span className="text-slate-500"> — like the month&apos;s staff payments</span>
              </span>
            } />
          </RadioGroup>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Label (optional)</span>
            <TextField size="small" fullWidth placeholder="July 2026" value={periodLabel}
              onChange={e => setPeriodLabel(e.target.value)} className="!mt-1"
              slotProps={{ input: { className: '!rounded-xl' } }} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Date for rows without one</span>
            <TextField size="small" fullWidth type="date" value={defaultDate}
              onChange={e => invalidate(setDefaultDate)(e.target.value)} className="!mt-1"
              slotProps={{ input: { className: '!rounded-xl' } }} />
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
          <FormControlLabel
            control={<Checkbox size="small" checked={alreadyPaid}
              onChange={e => invalidate(setAlreadyPaid)(e.target.checked)} />}
            label={<span className="text-sm font-semibold text-slate-700">This money has already been paid</span>}
          />
          <p className="text-xs text-slate-500 ml-8 -mt-1">
            Approves and pays them straight away, so the bank balance drops now.
            Leave it off to record them for approval first.
          </p>
          {alreadyPaid && (
            <div className="ml-8 mt-2">
              <FormControl size="small">
                <Select value={paymentMode} onChange={e => setPaymentMode(e.target.value as any)}
                  className="!rounded-xl">
                  {['BANK', 'CASH', 'CHEQUE', 'UPI'].map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
              </FormControl>
            </div>
          )}
        </div>
      </Paper>

      {/* --------------------------------------------------------------- input */}
      <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Your rows</span>
          <Button size="small" startIcon={<Download className="w-3.5 h-3.5" />} onClick={downloadTemplate}
            className="!normal-case !font-bold !text-xs">
            Template with your heads
          </Button>
        </div>

        <Button component="label" variant="outlined" fullWidth
          startIcon={<FileSpreadsheet className="w-4 h-4" />}
          className="!rounded-xl !normal-case !font-bold !py-3 !border-dashed">
          {file ? file.name : 'Choose a .xlsx or .csv file'}
          <input type="file" hidden accept=".xlsx,.xls,.csv"
            onChange={e => { setPreview(null); setFile(e.target.files?.[0] || null); }} />
        </Button>

        <div className="text-center text-xs text-slate-400">or paste</div>
        <TextField
          multiline minRows={3} fullWidth placeholder={'Head,Amount,Note\nElectricity,45000,July'}
          value={csvText} onChange={e => { setPreview(null); setCsvText(e.target.value); }}
          slotProps={{ input: { className: '!rounded-xl !text-xs !font-mono' } }}
        />

        <Button fullWidth variant="contained" disabled={busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Upload className="w-4 h-4" />}
          onClick={runPreview} className="!rounded-xl !normal-case !font-bold">
          Check it first
        </Button>
      </Paper>

      {/* ------------------------------------------------------------- preview */}
      {preview && (
        <Paper elevation={0} className="rounded-2xl border border-slate-200/70 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/60">
            <p className="font-bold text-slate-800 text-sm">{preview.summary}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Chip size="small" icon={<CheckCircle2 className="w-3 h-3" />}
                label={`${preview.totals.create} will post`}
                className="!bg-emerald-50 !text-emerald-700 !font-bold !text-[11px]" />
              {preview.totals.error > 0 && (
                <Chip size="small" icon={<AlertTriangle className="w-3 h-3" />}
                  label={`${preview.totals.error} skipped`}
                  className="!bg-amber-50 !text-amber-700 !font-bold !text-[11px]" />
              )}
              <Chip size="small" label={rupees(preview.totalAmountPaise)}
                className="!bg-slate-200 !text-slate-700 !font-black !text-[11px]" />
            </div>
          </div>

          {preview.duplicateWarning && (
            <div className="m-4 rounded-xl bg-amber-50 border border-amber-300 p-3 flex items-start gap-2">
              <Copy className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900">{preview.duplicateWarning}</p>
            </div>
          )}
          {preview.approvalWarning && (
            <div className="m-4 rounded-xl bg-sky-50 border border-sky-200 p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <p className="text-xs text-sky-900">{preview.approvalWarning}</p>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell className="!text-[10px] !font-black !uppercase !text-slate-500">Row</TableCell>
                  {preview.columns.map(c => (
                    <TableCell key={c} className="!text-[10px] !font-black !uppercase !text-slate-500">{c}</TableCell>
                  ))}
                  <TableCell className="!text-[10px] !font-black !uppercase !text-slate-500">Result</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {preview.rows.map(r => (
                  <TableRow key={r.rowNumber} className={r.status === 'ERROR' ? '!bg-amber-50/50' : ''}>
                    <TableCell className="!text-xs !text-slate-400">{r.rowNumber}</TableCell>
                    {preview.columns.map(c => (
                      <TableCell key={c} className="!text-xs !text-slate-700">{r.data[c] || '—'}</TableCell>
                    ))}
                    <TableCell className="!text-xs">
                      {r.status === 'ERROR'
                        ? <span className="text-amber-700">{r.message}</span>
                        : <span className="text-emerald-600 font-semibold">Will post</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="p-4 border-t border-slate-100">
            <Button fullWidth variant="contained" disabled={busy || preview.totals.create === 0}
              endIcon={<ArrowRight className="w-4 h-4" />} onClick={runCommit}
              className="!rounded-xl !normal-case !font-bold !py-2.5">
              {preview.totals.create === 0
                ? 'Nothing here can be recorded'
                : `Record ${preview.totals.create} ${preview.totals.create > 1 ? 'entries' : 'entry'} — ${rupees(preview.totalAmountPaise)}`}
            </Button>
          </div>
        </Paper>
      )}
    </div>
  );
}
