'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  CircularProgress, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Paper, Zoom, FormControl, Select, MenuItem, Tooltip,
} from '@mui/material';
import { X, Upload, Wand2, Link2, Unlink, EyeOff, CheckCircle2, AlertTriangle, Landmark } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface BankAccountOption { code: string; name: string; accountId: string }
interface BookItem {
  journalEntryId: string; voucherNumber: string; voucherType: string;
  entryDate: string; narration?: string; inPaise: number; outPaise: number; netPaise: number;
}
interface StatementItem {
  _id: string; txnDate: string; description: string; refNo?: string;
  debitPaise: number; creditPaise: number; netPaise: number;
}
interface Reconciliation {
  accountCode: string; accountName: string; asOf: string;
  bookBalancePaise: number; statementBalancePaise: number;
  unmatchedInBooks: BookItem[]; unmatchedOnStatement: StatementItem[];
  booksOnlyNetPaise: number; statementOnlyNetPaise: number;
  differencePaise: number; reconciled: boolean;
  counts: { statementLines: number; matched: number; unmatched: number; ignored: number; bookEntries: number };
}

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
/** Money the society gained is green and prefixed +; money it lost is red and −. */
const signed = (p: number) => `${p < 0 ? '−' : '+'}${rupees(Math.abs(p))}`;
const day = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Parse a pasted or uploaded bank CSV.
 *
 * Kept deliberately forgiving: every Indian bank exports a different shape, and a
 * treasurer pasting a statement cannot be asked to rename columns first. Header
 * names are matched loosely and both layouts banks actually use are handled — a
 * withdrawal/deposit pair, or one signed amount column.
 *
 * Amounts become integer paise here, once, via Math.round on a rupee string —
 * everything downstream is integers.
 */
const HEADERS: Record<string, RegExp> = {
  date: /^(txn|transaction|value|posting)?\s*date$/i,
  description: /^(description|narration|particulars|details|remarks)$/i,
  refNo: /^(ref(erence)?( ?no\.?)?|utr|cheque( ?no\.?)?|chq(\.| ?no\.?)?|instrument( ?no\.?)?)$/i,
  debit: /^(debit|withdrawal|withdrawal amt\.?|dr)$/i,
  credit: /^(credit|deposit|deposit amt\.?|cr)$/i,
  amount: /^amount$/i,
};

interface ParsedRow { txnDate: string; description: string; refNo: string; debitPaise: number; creditPaise: number }

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

/** Rupees as a bank writes them ('1,23,456.78', '(500)', '') → integer paise. */
function toPaise(raw: string): number {
  const cleaned = (raw || '').replace(/[₹,\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  if (!cleaned || cleaned === '-') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** 'dd/mm/yyyy' and 'dd-mm-yy' are what banks send; ISO is what the API wants. */
function toIsoDate(raw: string): string | null {
  const s = (raw || '').trim();
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const dt = new Date(year, Number(m) - 1, Number(d), 12);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function parseCsv(text: string): { rows: ParsedRow[]; error?: string } {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], error: 'Paste the header row and at least one transaction.' };

  const header = splitCsvLine(lines[0]);
  const col = (key: keyof typeof HEADERS) => header.findIndex(h => HEADERS[key].test(h));
  const iDate = col('date'), iDesc = col('description'), iRef = col('refNo');
  const iDebit = col('debit'), iCredit = col('credit'), iAmount = col('amount');

  if (iDate < 0) return { rows: [], error: 'No date column found. Expected a header such as "Date" or "Txn Date".' };
  if (iDebit < 0 && iCredit < 0 && iAmount < 0) {
    return { rows: [], error: 'No amount column found. Expected "Withdrawal"/"Deposit", "Debit"/"Credit", or "Amount".' };
  }

  const rows: ParsedRow[] = [];
  for (let n = 1; n < lines.length; n++) {
    const cells = splitCsvLine(lines[n]);
    const txnDate = toIsoDate(cells[iDate]);
    if (!txnDate) continue; // a total or a blank separator, not a transaction

    let debitPaise = iDebit >= 0 ? toPaise(cells[iDebit]) : 0;
    let creditPaise = iCredit >= 0 ? toPaise(cells[iCredit]) : 0;
    if (iAmount >= 0 && !debitPaise && !creditPaise) {
      // One signed column: negative is money out.
      const amt = toPaise(cells[iAmount]);
      if (amt < 0) debitPaise = -amt; else creditPaise = amt;
    }
    if (!debitPaise && !creditPaise) continue; // a running-balance row

    rows.push({
      txnDate,
      description: (iDesc >= 0 ? cells[iDesc] : '') || 'Bank transaction',
      refNo: iRef >= 0 ? (cells[iRef] || '') : '',
      debitPaise: Math.abs(debitPaise),
      creditPaise: Math.abs(creditPaise),
    });
  }
  if (!rows.length) return { rows: [], error: 'No transactions found in that text.' };
  return { rows };
}

export default function BankReconciliationPage() {
  const { showToast } = useToastConfirm();
  const [accounts, setAccounts] = useState<BankAccountOption[]>([]);
  const [accountCode, setAccountCode] = useState('');
  const [asOf, setAsOf] = useState(today());
  const [data, setData] = useState<Reconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [importing, setImporting] = useState(false);

  const [matchLine, setMatchLine] = useState<StatementItem | null>(null);
  const [matchJe, setMatchJe] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/finance/society/bank/accounts');
        setAccounts(res.data);
        if (res.data.length) setAccountCode(res.data[0].code);
        else setLoading(false);
      } catch (e: any) {
        showToast(e.response?.data?.error || 'Failed to load bank accounts', 'error');
        setLoading(false);
      }
    })();
  }, [showToast]);

  const load = useCallback(async () => {
    if (!accountCode) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({ accountCode });
      if (asOf) params.append('asOf', new Date(`${asOf}T12:00:00`).toISOString());
      const res = await api.get(`/finance/society/bank/reconciliation?${params.toString()}`);
      setData(res.data);
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to load reconciliation', 'error'); }
    finally { setLoading(false); }
  }, [accountCode, asOf, showToast]);
  useEffect(() => { load(); }, [load]);

  const parsed = useMemo(() => (csv.trim() ? parseCsv(csv) : { rows: [] as ParsedRow[] }), [csv]);

  const readFile = async (file?: File | null) => {
    if (!file) return;
    setCsv(await file.text());
  };

  const submitImport = async () => {
    if (!parsed.rows.length) return;
    setImporting(true);
    try {
      const res = await api.post('/finance/society/bank/import', { accountCode, lines: parsed.rows });
      const { imported, duplicates } = res.data;
      showToast(
        duplicates
          ? `${imported} new transaction${imported === 1 ? '' : 's'} added; ${duplicates} were already imported.`
          : `${imported} transaction${imported === 1 ? '' : 's'} added.`,
        'success',
      );
      setImportOpen(false); setCsv(''); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to import statement', 'error'); }
    finally { setImporting(false); }
  };

  const runAutoMatch = async () => {
    setBusy(true);
    try {
      const res = await api.post('/finance/society/bank/auto-match', { accountCode });
      showToast(res.data.matched
        ? `Matched ${res.data.matched} transaction${res.data.matched === 1 ? '' : 's'}.`
        : 'Nothing new could be matched automatically.', res.data.matched ? 'success' : 'info');
      load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Auto-match failed', 'error'); }
    finally { setBusy(false); }
  };

  const lineAction = async (id: string, action: 'unmatch' | 'ignore', body: any = {}) => {
    setBusy(true);
    try {
      await api.post(`/finance/society/bank/lines/${id}/${action}`, body);
      showToast(action === 'ignore' ? 'Row ignored' : 'Match undone', 'success');
      load();
    } catch (e: any) { showToast(e.response?.data?.error || `Failed to ${action}`, 'error'); }
    finally { setBusy(false); }
  };

  const submitMatch = async () => {
    if (!matchLine || !matchJe) return;
    setBusy(true);
    try {
      await api.post(`/finance/society/bank/lines/${matchLine._id}/match`, { journalEntryId: matchJe });
      showToast('Matched', 'success');
      setMatchLine(null); setMatchJe(''); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to match', 'error'); }
    finally { setBusy(false); }
  };

  /** Only vouchers of the same amount can be matched — the server enforces it, so offering others would only invite a rejection. */
  const matchable = useMemo(
    () => (matchLine && data ? data.unmatchedInBooks.filter(b => b.netPaise === matchLine.netPaise) : []),
    [matchLine, data],
  );

  const amount = (p: number) => (
    <span className={p < 0 ? 'text-red-600 font-bold' : 'text-emerald-600 font-bold'}>{signed(p)}</span>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Bank Reconciliation</h1>
          <p className="text-sm text-slate-500 mt-0.5">Prove that what your books say the bank holds is what the bank actually holds</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setCsv(''); setImportOpen(true); }} variant="outlined" startIcon={<Upload className="w-4 h-4" />} disabled={!accountCode} sx={{ whiteSpace: 'nowrap' }}>Import Statement</Button>
          <Button onClick={runAutoMatch} variant="contained" startIcon={<Wand2 className="w-4 h-4" />} disabled={!accountCode || busy} sx={{ whiteSpace: 'nowrap' }}>Auto-match</Button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-900 leading-relaxed">
        <span className="font-black">What this is.</span> Your books and your bank almost never show the same balance on the same day —
        a cheque you wrote may not have been banked yet, and the bank may have taken charges you have not recorded.
        This page lists those differences and proves that, once you account for them, the two agree. Your auditor will ask for it.
      </div>

      <div className="flex flex-wrap gap-2">
        <FormControl size="small" sx={{ minWidth: 260 }}>
          <Select displayEmpty value={accountCode} onChange={e => setAccountCode(e.target.value)}>
            {accounts.length === 0 && <MenuItem value="">No bank accounts found</MenuItem>}
            {accounts.map(a => <MenuItem key={a.code} value={a.code}>{a.code} · {a.name}</MenuItem>)}
          </Select>
        </FormControl>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">As on</span>
          <TextField hiddenLabel size="small" type="date" value={asOf} onChange={e => setAsOf(e.target.value)} sx={{ width: 165 }} />
        </div>
      </div>

      {loading ? <div className="flex justify-center py-20"><CircularProgress size={32} /></div>
        : !data ? <div className="text-center py-20 text-slate-400 font-semibold text-sm">Select a bank account to begin.</div>
        : (
          <>
            {/* ---------------------------------------------- the summary */}
            <Paper elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm p-5 bg-white">
              <div className="flex items-center gap-2 mb-4">
                <Landmark className="w-4 h-4 text-slate-500" />
                <h2 className="text-sm font-black text-slate-800">{data.accountCode} · {data.accountName} — as on {day(data.asOf)}</h2>
              </div>

              <div className="space-y-2 max-w-2xl">
                <div className="flex justify-between items-baseline gap-4 py-2 border-b border-slate-100">
                  <div>
                    <p className="text-sm font-bold text-slate-800">Balance as per your books</p>
                    <p className="text-[11px] text-slate-500">What the ledger says this account holds</p>
                  </div>
                  <span className="font-black text-slate-800 whitespace-nowrap">{rupees(data.bookBalancePaise)}</span>
                </div>

                <div className="flex justify-between items-baseline gap-4 py-2 border-b border-slate-100">
                  <div>
                    <p className="text-sm font-bold text-slate-700">Less: in your books, not yet at the bank</p>
                    <p className="text-[11px] text-slate-500">{data.unmatchedInBooks.length} item{data.unmatchedInBooks.length === 1 ? '' : 's'} — typically cheques written but not yet banked</p>
                  </div>
                  <span className="font-black text-slate-600 whitespace-nowrap">{signed(-data.booksOnlyNetPaise)}</span>
                </div>

                <div className="flex justify-between items-baseline gap-4 py-2 border-b border-slate-100">
                  <div>
                    <p className="text-sm font-bold text-slate-700">Add: at the bank, not yet in your books</p>
                    <p className="text-[11px] text-slate-500">{data.unmatchedOnStatement.length} item{data.unmatchedOnStatement.length === 1 ? '' : 's'} — typically bank charges or interest you have not recorded</p>
                  </div>
                  <span className="font-black text-slate-600 whitespace-nowrap">{signed(data.statementOnlyNetPaise)}</span>
                </div>

                <div className="flex justify-between items-baseline gap-4 py-2">
                  <div>
                    <p className="text-sm font-black text-slate-800">Balance as per the bank statement</p>
                    <p className="text-[11px] text-slate-500">Derived from the transactions you have imported</p>
                  </div>
                  <span className="font-black text-slate-800 whitespace-nowrap">{rupees(data.statementBalancePaise)}</span>
                </div>
              </div>

              <div className={`mt-4 rounded-xl p-3 text-xs font-bold border flex items-start gap-2 ${data.reconciled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                : 'bg-red-50 text-red-800 border-red-100'}`}>
                {data.reconciled
                  ? <><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /><span>Reconciled. Every difference between your books and the bank is explained by the items listed below.</span></>
                  : <><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>Out by {rupees(Math.abs(data.differencePaise))}. Something is unexplained — most often the statement has not been imported all the way back to the start.</span></>}
              </div>

              <p className="mt-3 text-[11px] text-slate-400">
                {data.counts.statementLines} row{data.counts.statementLines === 1 ? '' : 's'} imported · {data.counts.matched} matched · {data.counts.unmatched} unmatched · {data.counts.ignored} ignored
              </p>
            </Paper>

            {/* ---------------------------------------------- the two columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div>
                  <h3 className="text-sm font-black text-slate-800">In your books, not at the bank</h3>
                  <p className="text-[11px] text-slate-500">You recorded these; the bank has not shown them yet.</p>
                </div>
                <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
                  {data.unmatchedInBooks.length === 0
                    ? <div className="text-center py-12 text-slate-400 font-semibold text-xs bg-white">Nothing outstanding — every entry in your books appears on the statement.</div>
                    : (
                      <Table size="small" sx={{ minWidth: 380 }}>
                        <TableHead><TableRow>
                          <TableCell>Voucher</TableCell><TableCell>Date</TableCell>
                          <TableCell>Details</TableCell><TableCell align="right">Amount</TableCell>
                        </TableRow></TableHead>
                        <TableBody className="bg-white">
                          {data.unmatchedInBooks.map(b => (
                            <TableRow key={b.journalEntryId}>
                              <TableCell className="font-mono text-xs font-bold text-slate-700">{b.voucherNumber}</TableCell>
                              <TableCell className="font-mono text-xs text-slate-500">{day(b.entryDate)}</TableCell>
                              <TableCell className="text-xs text-slate-600 max-w-[220px] truncate" title={b.narration || ''}>{b.narration || b.voucherType}</TableCell>
                              <TableCell align="right" className="whitespace-nowrap">{amount(b.netPaise)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                </TableContainer>
              </div>

              <div className="space-y-2">
                <div>
                  <h3 className="text-sm font-black text-slate-800">At the bank, not in your books</h3>
                  <p className="text-[11px] text-slate-500">The bank shows these; you have not recorded them yet.</p>
                </div>
                <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
                  {data.unmatchedOnStatement.length === 0
                    ? <div className="text-center py-12 text-slate-400 font-semibold text-xs bg-white">Nothing unexplained — every bank transaction is in your books.</div>
                    : (
                      <Table size="small" sx={{ minWidth: 420 }}>
                        <TableHead><TableRow>
                          <TableCell>Date</TableCell><TableCell>Description</TableCell>
                          <TableCell align="right">Amount</TableCell><TableCell align="right">Actions</TableCell>
                        </TableRow></TableHead>
                        <TableBody className="bg-white">
                          {data.unmatchedOnStatement.map(s => (
                            <TableRow key={s._id}>
                              <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">{day(s.txnDate)}</TableCell>
                              <TableCell className="text-xs text-slate-600 max-w-[200px]">
                                <span className="block truncate" title={s.description}>{s.description}</span>
                                {s.refNo && <span className="font-mono text-[10px] text-slate-400">{s.refNo}</span>}
                              </TableCell>
                              <TableCell align="right" className="whitespace-nowrap">{amount(s.netPaise)}</TableCell>
                              <TableCell align="right">
                                <div className="flex items-center justify-end gap-1">
                                  <Tooltip title="Match to a voucher in your books">
                                    <IconButton onClick={() => { setMatchLine(s); setMatchJe(''); }} size="small" className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-xl p-2"><Link2 className="w-4 h-4" /></IconButton>
                                  </Tooltip>
                                  <Tooltip title="Not a real transaction — hide this row">
                                    <IconButton onClick={() => lineAction(s._id, 'ignore')} size="small" disabled={busy} className="bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl p-2"><EyeOff className="w-4 h-4" /></IconButton>
                                  </Tooltip>
                                  <Tooltip title="Undo a match">
                                    <IconButton onClick={() => lineAction(s._id, 'unmatch')} size="small" disabled={busy} className="bg-slate-100 hover:bg-amber-50 hover:text-amber-600 text-slate-500 rounded-xl p-2"><Unlink className="w-4 h-4" /></IconButton>
                                  </Tooltip>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                </TableContainer>
              </div>
            </div>
          </>
        )}

      {/* ---------------------------------------------- import dialog */}
      <Dialog open={importOpen} onClose={() => setImportOpen(false)} slots={{ transition: Zoom }} maxWidth="sm" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3">
          <span className="flex items-center gap-2"><Upload className="w-5 h-5 text-blue-600" />Import Bank Statement</span>
          <IconButton onClick={() => setImportOpen(false)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-3">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-900 leading-relaxed">
            Download your statement from net banking as CSV, then paste it below or choose the file.
            Importing the same statement twice is safe — anything already here is skipped.
          </div>
          <Button component="label" variant="outlined" size="small" startIcon={<Upload className="w-4 h-4" />} className="font-bold">
            Choose CSV file
            <input type="file" accept=".csv,text/csv,text/plain" hidden onChange={e => readFile(e.target.files?.[0])} />
          </Button>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Or paste the statement</span>
            <TextField
              hiddenLabel fullWidth multiline rows={8} value={csv} onChange={e => setCsv(e.target.value)}
              placeholder={'Date,Description,Ref No,Withdrawal,Deposit\n01/04/2026,NEFT MAINTENANCE A-101,UTR900001,,5000.00'}
              slotProps={{ htmlInput: { className: 'font-mono text-xs' } }}
            />
          </div>
          {csv.trim() && (parsed.error
            ? <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-800 font-semibold">{parsed.error}</div>
            : <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800 font-semibold">
                Found {parsed.rows.length} transaction{parsed.rows.length === 1 ? '' : 's'}, from {day(parsed.rows[0].txnDate)} to {day(parsed.rows[parsed.rows.length - 1].txnDate)}.
              </div>)}
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setImportOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={submitImport} disabled={importing || !parsed.rows.length} variant="contained" fullWidth className="py-2.5 font-bold">
            {importing ? <CircularProgress size={18} color="inherit" /> : 'Import'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---------------------------------------------- manual match dialog */}
      <Dialog open={!!matchLine} onClose={() => setMatchLine(null)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3">
          <span className="flex items-center gap-2"><Link2 className="w-5 h-5 text-blue-600" />Match to a voucher</span>
          <IconButton onClick={() => setMatchLine(null)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-3">
          {matchLine && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
              <p className="font-bold text-slate-800">{matchLine.description}</p>
              <p className="text-slate-500 font-mono mt-0.5">{day(matchLine.txnDate)}{matchLine.refNo ? ` · ${matchLine.refNo}` : ''} · {signed(matchLine.netPaise)}</p>
            </div>
          )}
          {matchable.length === 0
            ? <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
                No voucher in your books moves this exact amount. Record it first — under Expenses if the bank took money,
                or Collections if money came in — then it will match.
              </div>
            : (
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Voucher</span>
                <FormControl fullWidth size="small">
                  <Select displayEmpty value={matchJe} onChange={e => setMatchJe(e.target.value)}>
                    <MenuItem value="">Select a voucher</MenuItem>
                    {matchable.map(b => (
                      <MenuItem key={b.journalEntryId} value={b.journalEntryId}>
                        {b.voucherNumber} · {day(b.entryDate)} · {signed(b.netPaise)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <p className="text-[11px] text-slate-500 pt-1">Only vouchers of exactly the same amount are shown — matching two different amounts would hide a real difference.</p>
              </div>
            )}
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setMatchLine(null)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={submitMatch} disabled={!matchJe || busy} variant="contained" fullWidth className="py-2.5 font-bold">
            {busy ? <CircularProgress size={18} color="inherit" /> : 'Match'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
