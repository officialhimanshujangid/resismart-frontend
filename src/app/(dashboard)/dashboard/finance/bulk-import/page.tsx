'use client';

import React, { useState, useRef } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, TextField, CircularProgress, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, Chip, FormControlLabel, Checkbox,
} from '@mui/material';
import { Info, Download, Upload, ClipboardPaste, AlertTriangle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

type Kind = 'FLATS' | 'MEMBERS' | 'OPENING_DUES';
type RowStatus = 'CREATE' | 'SKIP' | 'ERROR';

interface PreviewRow { rowNumber: number; data: Record<string, string>; status: RowStatus; message?: string }
interface PreviewResult {
  kind: Kind;
  columns: string[];
  rows: PreviewRow[];
  totals: { rows: number; create: number; skip: number; error: number };
  totalAmountPaise: number;
  summary: string;
  requiresForce?: boolean;
  warning?: string;
}

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const KINDS: { key: Kind; label: string; blurb: string; slug: string }[] = [
  {
    key: 'FLATS', slug: 'flats',
    label: 'Flats',
    blurb: 'Every flat in the society, with its block and whether it is owner-occupied, rented or empty. Blocks you name here are created automatically.',
  },
  {
    key: 'MEMBERS', slug: 'members',
    label: 'Members & Shares',
    blurb: 'Who owns each flat and how many shares they hold. Import your flats first — this needs them to exist.',
  },
  {
    key: 'OPENING_DUES', slug: 'opening-dues',
    label: 'Opening Dues',
    blurb: 'What each flat already owed you on the day you started using ResiSmart. This posts a single opening entry to your books.',
  },
];

const STATUS_STYLE: Record<RowStatus, { chip: string; row: string; label: string }> = {
  CREATE: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', row: '', label: 'Will add' },
  SKIP: { chip: 'bg-slate-100 text-slate-500 border-slate-200', row: 'opacity-60', label: 'Already there' },
  ERROR: { chip: 'bg-red-50 text-red-700 border-red-200', row: 'bg-red-50/50', label: 'Problem' },
};

const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{children}</span>
);

export default function BulkImportPage() {
  const { showToast } = useToastConfirm();
  const fileRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<Kind>('FLATS');
  const [csvText, setCsvText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [force, setForce] = useState(false);

  const active = KINDS.find(k => k.key === kind)!;

  /** Any change to the source invalidates the preview — a stale verdict is a lie. */
  const reset = () => { setPreview(null); setForce(false); };

  const switchKind = (k: Kind) => {
    setKind(k); setCsvText(''); setFile(null); reset();
    if (fileRef.current) fileRef.current.value = '';
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.get(`/finance/society/import/${active.slug}/template`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resismart-${active.slug}-template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Could not download the template', 'error');
    }
  };

  /**
   * Both doors post to the same endpoint: a chosen file goes as multipart, and
   * pasted text goes as JSON.
   */
  const send = async (action: 'preview' | 'commit') => {
    const url = `/finance/society/import/${active.slug}/${action}`;
    if (file) {
      const fd = new FormData();
      fd.append('file', file);
      if (action === 'commit' && force) fd.append('force', 'true');
      return api.post(url, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return api.post(url, { csvText, ...(action === 'commit' && force ? { force: true } : {}) });
  };

  const runPreview = async () => {
    if (!csvText.trim() && !file) { showToast('Paste your spreadsheet or choose a file first', 'error'); return; }
    setBusy(true); setPreview(null); setForce(false);
    try {
      const res = await send('preview');
      setPreview(res.data);
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Could not read that file', 'error');
    } finally { setBusy(false); }
  };

  const runCommit = async () => {
    setCommitting(true);
    try {
      const res = await send('commit');
      showToast(res.data?.summary || 'Imported', 'success');
      setCsvText(''); setFile(null); reset();
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Could not import that file', 'error');
    } finally { setCommitting(false); }
  };

  const hasErrors = !!preview?.totals.error;
  const nothingToDo = !!preview && preview.totals.create === 0;
  const blockedByForce = !!preview?.requiresForce && !force;
  const canCommit = !!preview && !hasErrors && !nothingToDo && !blockedByForce && !committing;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl pb-28">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Bulk Import</h1>
        <p className="text-sm text-slate-500 mt-0.5">Set up your whole society from a spreadsheet instead of typing it in flat by flat</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 flex gap-2">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <span>
          Download the template, fill it in, and paste or upload it here. We will check <b>every row</b> and show you
          exactly what will happen <b>before</b> anything is saved. Nothing is written until you press Import.
        </span>
      </div>

      {/* What are we importing? */}
      <Paper elevation={0} className="rounded-2xl border border-slate-200/60 p-4 space-y-3">
        <Label>What are you importing?</Label>
        <div className="grid sm:grid-cols-3 gap-3">
          {KINDS.map(k => (
            <button
              key={k.key}
              onClick={() => switchKind(k.key)}
              className={`text-left p-3 rounded-xl border transition ${
                kind === k.key ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-200' : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <p className={`font-bold text-sm ${kind === k.key ? 'text-blue-800' : 'text-slate-700'}`}>{k.label}</p>
              <p className="text-xs text-slate-500 mt-1 leading-snug">{k.blurb}</p>
            </button>
          ))}
        </div>
      </Paper>

      {/* Source */}
      <Paper elevation={0} className="rounded-2xl border border-slate-200/60 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-white border border-slate-200"><FileSpreadsheet className="w-4 h-4 text-blue-600" /></div>
            <div>
              <p className="font-bold text-slate-800 text-sm">Your {active.label.toLowerCase()} file</p>
              <p className="text-xs text-slate-500 mt-0.5">Columns needed: {(preview?.columns || []).join(', ') || defaultColumns(kind).join(', ')}</p>
            </div>
          </div>
          <Button size="small" variant="outlined" startIcon={<Download className="w-4 h-4" />} onClick={downloadTemplate}>
            Download template
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <Label>Upload a file (.xlsx or .csv)</Label>
            <div className="flex items-center gap-3 flex-wrap">
              <Button component="label" variant="outlined" size="small" startIcon={<Upload className="w-4 h-4" />}>
                Choose file
                <input
                  ref={fileRef}
                  hidden
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={e => { setFile(e.target.files?.[0] || null); setCsvText(''); reset(); }}
                />
              </Button>
              {file && (
                <span className="text-xs text-slate-600">
                  <b>{file.name}</b>
                  <button className="ml-2 text-red-600 hover:underline" onClick={() => { setFile(null); reset(); if (fileRef.current) fileRef.current.value = ''; }}>remove</button>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px bg-slate-100 flex-1" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">or paste it</span>
            <div className="h-px bg-slate-100 flex-1" />
          </div>

          <div className="space-y-1">
            <Label>Paste from Excel or Google Sheets (CSV)</Label>
            <TextField
              hiddenLabel fullWidth multiline minRows={4} maxRows={12} size="small"
              placeholder={defaultColumns(kind).join(',')}
              value={csvText}
              disabled={!!file}
              onChange={e => { setCsvText(e.target.value); reset(); }}
              slotProps={{ input: { className: 'font-mono text-xs' } }}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              {file ? 'Remove the file above to paste instead.' : 'Include the header row. Copy your sheet and paste straight in.'}
            </p>
          </div>

          <Button
            onClick={runPreview}
            disabled={busy || (!csvText.trim() && !file)}
            variant="contained"
            startIcon={busy ? undefined : <ClipboardPaste className="w-4 h-4" />}
            className="font-bold"
          >
            {busy ? <CircularProgress size={18} color="inherit" /> : 'Check my file'}
          </Button>
        </div>
      </Paper>

      {/* The verdict — every row, with its reason */}
      {preview && (
        <>
          <Paper elevation={0} className={`rounded-2xl border p-4 ${hasErrors ? 'border-red-200 bg-red-50/50' : 'border-emerald-200 bg-emerald-50/50'}`}>
            <div className="flex items-start gap-3">
              {hasErrors
                ? <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                : <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
              <div className="flex-1">
                <p className={`font-bold text-sm ${hasErrors ? 'text-red-800' : 'text-emerald-800'}`}>{preview.summary}</p>
                <div className="flex gap-6 mt-3 flex-wrap">
                  <div><Label>Will add</Label><p className="text-lg font-black text-emerald-700">{preview.totals.create}</p></div>
                  <div><Label>Already there</Label><p className="text-lg font-black text-slate-500">{preview.totals.skip}</p></div>
                  <div><Label>Problems</Label><p className={`text-lg font-black ${hasErrors ? 'text-red-600' : 'text-slate-400'}`}>{preview.totals.error}</p></div>
                  {kind === 'OPENING_DUES' && (
                    <div><Label>Total dues</Label><p className="text-lg font-black text-blue-700">{rupees(preview.totalAmountPaise)}</p></div>
                  )}
                </div>
              </div>
            </div>
          </Paper>

          {preview.warning && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 flex gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p>{preview.warning}</p>
                <FormControlLabel
                  className="mt-1"
                  control={<Checkbox size="small" checked={force} onChange={e => setForce(e.target.checked)} />}
                  label={<span className="text-xs font-semibold">I understand these are different dues — post them anyway</span>}
                />
              </div>
            </div>
          )}

          <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
            <Table sx={{ minWidth: 720 }} size="small">
              <TableHead><TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Row</TableCell>
                {preview.columns.map(c => <TableCell key={c} sx={{ fontWeight: 700 }}>{c}</TableCell>)}
                <TableCell sx={{ fontWeight: 700 }}>Verdict</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>What happens</TableCell>
              </TableRow></TableHead>
              <TableBody className="bg-white">
                {preview.rows.map(r => (
                  <TableRow key={r.rowNumber} className={STATUS_STYLE[r.status].row}>
                    <TableCell className="font-mono text-xs text-slate-400">{r.rowNumber}</TableCell>
                    {preview.columns.map(c => (
                      <TableCell key={c} className="text-slate-600 text-xs">{r.data[c] || <span className="text-slate-300">—</span>}</TableCell>
                    ))}
                    <TableCell>
                      <Chip
                        size="small" label={STATUS_STYLE[r.status].label}
                        className={`border font-bold text-[10px] ${STATUS_STYLE[r.status].chip}`}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell className={`text-xs ${r.status === 'ERROR' ? 'text-red-700 font-semibold' : 'text-slate-500'}`}>
                      {r.message || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Paper elevation={2} className="rounded-2xl border border-slate-200/60 p-4 sticky bottom-4 bg-white/95 backdrop-blur">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-xs text-slate-500 flex-1">
                {hasErrors
                  ? <span className="text-red-700 font-semibold">Fix the rows marked in red in your spreadsheet, then check the file again. Nothing will be imported while any row has a problem.</span>
                  : nothingToDo
                    ? 'Everything in this file is already on the system — there is nothing left to import.'
                    : blockedByForce
                      ? <span className="text-amber-800 font-semibold">Tick the confirmation above to post these dues anyway.</span>
                      : 'Checked every row. Importing will make exactly the changes listed above.'}
              </p>
              <Button onClick={runCommit} disabled={!canCommit} variant="contained" className="font-bold px-6 py-2.5">
                {committing ? <CircularProgress size={18} color="inherit" /> : `Import ${preview.totals.create} row${preview.totals.create === 1 ? '' : 's'}`}
              </Button>
            </div>
          </Paper>
        </>
      )}
    </div>
  );
}

/** Mirrors the server's columns so the hint is right before the first preview. */
function defaultColumns(kind: Kind): string[] {
  if (kind === 'FLATS') return ['Block', 'Flat Number', 'Status', 'Carpet Area Sqft', 'Built-up Area Sqft'];
  if (kind === 'MEMBERS') return ['Block', 'Flat Number', 'Member Name', 'Shares', 'Face Value'];
  return ['Block', 'Flat Number', 'Amount Due'];
}
