'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  CircularProgress, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  Paper, Zoom, FormControl, Select, MenuItem,
} from '@mui/material';
import { Plus, X, Building2, TrendingDown, Wallet, Landmark, PackageX, History, Undo2 } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface Asset {
  _id: string; name: string; description?: string;
  assetAccountCode: string; assetAccountName?: string;
  purchaseDate: string; costPaise: number; salvageValuePaise: number;
  method: 'SLM' | 'WDV'; ratePercent: number; usefulLifeYears?: number;
  accumulatedDepreciationPaise: number; netBookValuePaise: number;
  lastDepreciationUpTo?: string; isActive: boolean;
  disposedOn?: string; disposalProceedsPaise?: number;
}
interface DepRun {
  _id: string; upToDate: string; totalPaise: number; voucherNumber: string;
  status: 'POSTED' | 'REVERSED'; assetsCharged: number; postedByName: string;
  reversedOn?: string; reversalReason?: string;
}
interface Totals { costPaise: number; accumulatedDepreciationPaise: number; netBookValuePaise: number; count: number }
interface PreviewRow {
  assetId: string; name: string; method: 'SLM' | 'WDV'; ratePercent: number;
  days: number; openingNetBookValuePaise: number; depreciationPaise: number;
  closingNetBookValuePaise: number; skipReason?: string;
}
interface Preview { upToDate: string; rows: PreviewRow[]; chargeable: number; skipped: number; totalPaise: number }

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const shortDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';
const today = () => new Date().toISOString().slice(0, 10);
/** The API takes full ISO timestamps; a date input gives a bare YYYY-MM-DD. */
const toIso = (ymd: string) => new Date(`${ymd}T00:00:00`).toISOString();

// The 15xx cost heads. Kept in step with ASSET_ACCOUNT_CODES in the backend service.
const ASSET_ACCOUNTS = [
  { code: '1500', label: 'Building & Structure' },
  { code: '1510', label: 'Lift & Elevators' },
  { code: '1520', label: 'Plant & Machinery (pumps, DG, STP)' },
  { code: '1530', label: 'Furniture & Fixtures' },
  { code: '1540', label: 'Computers & Equipment' },
];

const METHOD_HELP: Record<string, string> = {
  SLM: 'Straight-line — the same amount every year.',
  WDV: 'Written-down value — a fixed % of what is left, so it drops a little each year.',
};

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

export default function AssetsPage() {
  const { showToast } = useToastConfirm();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const emptyForm = { name: '', description: '', assetAccountCode: '', purchaseDate: today(), cost: '', salvage: '', method: 'SLM', ratePercent: '', usefulLifeYears: '' };
  const [form, setForm] = useState(emptyForm);

  const [depOpen, setDepOpen] = useState(false);
  const [depDate, setDepDate] = useState(today());
  const [depBusy, setDepBusy] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  const [runs, setRuns] = useState<DepRun[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reverseOf, setReverseOf] = useState<DepRun | null>(null);
  const [reverseReason, setReverseReason] = useState('');

  const [disposeOf, setDisposeOf] = useState<Asset | null>(null);
  const [disposal, setDisposal] = useState({ disposedOn: today(), proceeds: '', receivedIn: 'BANK', note: '' });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [a, r] = await Promise.all([
        api.get('/finance/society/assets?includeDisposed=true'),
        api.get('/finance/society/assets/depreciation/runs'),
      ]);
      setAssets(a.data.assets); setTotals(a.data.totals);
      setRuns(r.data || []);
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to load assets', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const doDispose = async () => {
    if (!disposeOf) return;
    setSaving(true);
    try {
      await api.post(`/finance/society/assets/${disposeOf._id}/dispose`, {
        disposedOn: toIso(disposal.disposedOn),
        proceedsPaise: disposal.proceeds ? Math.round(parseFloat(disposal.proceeds) * 100) : 0,
        receivedIn: disposal.receivedIn,
        note: disposal.note || undefined,
      });
      showToast(`${disposeOf.name} disposed and taken off the books`, 'success');
      setDisposeOf(null); setDisposal({ disposedOn: today(), proceeds: '', receivedIn: 'BANK', note: '' }); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Could not dispose this asset', 'error'); }
    finally { setSaving(false); }
  };

  const doReverse = async () => {
    if (!reverseOf) return;
    setSaving(true);
    try {
      const res = await api.post(`/finance/society/assets/depreciation/runs/${reverseOf._id}/reverse`, { reason: reverseReason || undefined });
      showToast(`Run reversed (${res.data.voucherNumber}) — ${res.data.assetsRestored} asset(s) restored`, 'success');
      setReverseOf(null); setReverseReason(''); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Could not reverse this run', 'error'); }
    finally { setSaving(false); }
  };

  /** What the disposal will book, shown before it posts. */
  const disposalMath = (() => {
    if (!disposeOf) return null;
    const proceeds = disposal.proceeds ? Math.round(parseFloat(disposal.proceeds) * 100) || 0 : 0;
    const nbv = disposeOf.netBookValuePaise;
    return { proceeds, nbv, gain: proceeds - nbv };
  })();

  const submit = async () => {
    setSaving(true);
    try {
      await api.post('/finance/society/assets', {
        name: form.name,
        description: form.description || undefined,
        assetAccountCode: form.assetAccountCode,
        purchaseDate: toIso(form.purchaseDate),
        costPaise: Math.round(parseFloat(form.cost) * 100),
        salvageValuePaise: form.salvage ? Math.round(parseFloat(form.salvage) * 100) : 0,
        method: form.method,
        ratePercent: parseFloat(form.ratePercent),
        usefulLifeYears: form.usefulLifeYears ? parseInt(form.usefulLifeYears, 10) : undefined,
      });
      showToast('Asset added to the register', 'success');
      setCreateOpen(false); setForm(emptyForm); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to add asset', 'error'); }
    finally { setSaving(false); }
  };

  /** Preview first, post second — the same two-step as invoice generation. */
  const runPreview = async () => {
    setDepBusy(true);
    try {
      const res = await api.get(`/finance/society/assets/depreciation/preview?upToDate=${encodeURIComponent(toIso(depDate))}`);
      setPreview(res.data);
    } catch (e: any) { showToast(e.response?.data?.error || 'Preview failed', 'error'); }
    finally { setDepBusy(false); }
  };

  const runDepreciation = async () => {
    setDepBusy(true);
    try {
      const res = await api.post('/finance/society/assets/depreciation/run', { upToDate: toIso(depDate) });
      if (res.data.posted) showToast(`Charged ${rupees(res.data.totalPaise)} across ${res.data.assetsCharged} asset(s) — voucher ${res.data.voucherNumber}`, 'success');
      else showToast('Nothing to charge — this period is already up to date', 'info');
      setDepOpen(false); setPreview(null); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Depreciation run failed', 'error'); }
    finally { setDepBusy(false); }
  };

  const canSubmit = form.name && form.assetAccountCode && form.cost && form.ratePercent;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Fixed Assets</h1>
          <p className="text-sm text-slate-500 mt-0.5">The lifts, pumps and furniture the society owns — and what they are worth today</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setHistoryOpen(true)} variant="text" startIcon={<History className="w-4 h-4" />} sx={{ whiteSpace: 'nowrap' }}>History</Button>
          <Button onClick={() => { setDepOpen(true); setPreview(null); }} variant="outlined" startIcon={<TrendingDown className="w-4 h-4" />} sx={{ whiteSpace: 'nowrap' }}>Run Depreciation</Button>
          <Button onClick={() => setCreateOpen(true)} variant="contained" startIcon={<Plus className="w-4 h-4" />} sx={{ whiteSpace: 'nowrap' }}>Add Asset</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={<Landmark className="w-5 h-5 text-blue-600" />} label="What it cost" value={rupees(totals?.costPaise)} hint={`${totals?.count ?? 0} asset(s) on the register`} tone="bg-blue-50" />
        <StatCard icon={<TrendingDown className="w-5 h-5 text-amber-600" />} label="Written off so far" value={rupees(totals?.accumulatedDepreciationPaise)} hint="Wear and tear charged to date" tone="bg-amber-50" />
        <StatCard icon={<Wallet className="w-5 h-5 text-emerald-600" />} label="Worth today" value={rupees(totals?.netBookValuePaise)} hint="Cost less what's been written off" tone="bg-emerald-50" />
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
        Assets lose value as they age. Each year the society records a slice of that loss as an expense — that is depreciation.
        It never moves any money; it just keeps the Balance Sheet honest about what the society's things are actually worth.
      </div>

      <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        {loading ? <div className="flex justify-center py-20 bg-white"><CircularProgress size={32} thickness={4} /></div>
          : assets.length === 0 ? <div className="text-center py-20 text-slate-400 font-semibold text-sm bg-white">No assets yet. Click "Add Asset" to start the register.</div>
          : (
            <Table sx={{ minWidth: 900 }}>
              <TableHead><TableRow>
                <TableCell>Asset</TableCell><TableCell>Head</TableCell><TableCell>Bought</TableCell>
                <TableCell>Method</TableCell><TableCell align="right">Cost</TableCell>
                <TableCell align="right">Written off</TableCell><TableCell align="right">Worth today</TableCell>
                <TableCell>Charged up to</TableCell>
                <TableCell align="right"></TableCell>
              </TableRow></TableHead>
              <TableBody className="bg-white">
                {assets.map(a => (
                  <TableRow key={a._id} hover className={a.disposedOn ? 'opacity-60' : undefined}>
                    <TableCell>
                      <p className="font-bold text-slate-800">{a.name}</p>
                      {a.description && <p className="text-xs text-slate-400 max-w-xs truncate">{a.description}</p>}
                      {a.disposedOn && (
                        <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                          Disposed {shortDate(a.disposedOn)}{a.disposalProceedsPaise ? ` for ${rupees(a.disposalProceedsPaise)}` : ' (scrapped)'}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-600 text-xs">{a.assetAccountName || a.assetAccountCode}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{shortDate(a.purchaseDate)}</TableCell>
                    <TableCell>
                      <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-black border bg-slate-100 text-slate-600 border-slate-200">{a.method}</span>
                      <span className="text-xs text-slate-400 ml-1">{a.ratePercent}%</span>
                    </TableCell>
                    <TableCell align="right" className="font-semibold text-slate-700">{rupees(a.costPaise)}</TableCell>
                    <TableCell align="right" className="text-amber-600 font-semibold">{a.accumulatedDepreciationPaise ? rupees(a.accumulatedDepreciationPaise) : '—'}</TableCell>
                    <TableCell align="right" className="font-black text-slate-800">{rupees(a.netBookValuePaise)}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{shortDate(a.lastDepreciationUpTo)}</TableCell>
                    <TableCell align="right">
                      {!a.disposedOn && (
                        <Button size="small" startIcon={<PackageX className="w-3.5 h-3.5" />} onClick={() => setDisposeOf(a)} className="font-bold whitespace-nowrap">Dispose</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </TableContainer>

      {/* Add asset */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} slots={{ transition: Zoom }} maxWidth="sm" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3">
          <span className="flex items-center gap-2"><Building2 className="w-5 h-5 text-blue-600" />Add Asset</span>
          <IconButton onClick={() => setCreateOpen(false)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">What is it? *</span>
            <TextField hiddenLabel fullWidth size="small" placeholder="e.g. Lift — A Wing" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <TextField hiddenLabel fullWidth size="small" placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Kind of asset *</span>
              <FormControl fullWidth size="small">
                <Select displayEmpty value={form.assetAccountCode} onChange={e => setForm(f => ({ ...f, assetAccountCode: e.target.value }))}>
                  <MenuItem value="" disabled>Choose one</MenuItem>
                  {ASSET_ACCOUNTS.map(a => <MenuItem key={a.code} value={a.code}>{a.label}</MenuItem>)}
                </Select>
              </FormControl>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Bought on *</span>
              <TextField hiddenLabel fullWidth size="small" type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">What it cost (₹) *</span>
              <TextField hiddenLabel fullWidth size="small" type="number" placeholder="0.00" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Scrap value (₹)</span>
              <TextField hiddenLabel fullWidth size="small" type="number" placeholder="0.00" value={form.salvage} onChange={e => setForm(f => ({ ...f, salvage: e.target.value }))} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 -mt-2">Scrap value is what it would still fetch at the end of its life. Leave blank if nothing. The asset is never written below this.</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1 col-span-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Method *</span>
              <FormControl fullWidth size="small">
                <Select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                  <MenuItem value="SLM">Straight-line</MenuItem>
                  <MenuItem value="WDV">Written-down</MenuItem>
                </Select>
              </FormControl>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Rate % a year *</span>
              <TextField hiddenLabel fullWidth size="small" type="number" placeholder="10" value={form.ratePercent} onChange={e => setForm(f => ({ ...f, ratePercent: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Life (years)</span>
              <TextField hiddenLabel fullWidth size="small" type="number" placeholder="10" value={form.usefulLifeYears} onChange={e => setForm(f => ({ ...f, usefulLifeYears: e.target.value }))} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 -mt-2">{METHOD_HELP[form.method]}</p>
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setCreateOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={submit} disabled={saving || !canSubmit} variant="contained" fullWidth className="py-2.5 font-bold">{saving ? <CircularProgress size={18} color="inherit" /> : 'Add'}</Button>
        </DialogActions>
      </Dialog>

      {/* Run depreciation — preview, then post */}
      <Dialog open={depOpen} onClose={() => setDepOpen(false)} slots={{ transition: Zoom }} maxWidth="sm" fullWidth scroll="paper">
        <DialogTitle className="flex justify-between items-center pr-3">
          <span className="flex items-center gap-2"><TrendingDown className="w-5 h-5 text-blue-600" />Run Depreciation</span>
          <IconButton onClick={() => setDepOpen(false)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Charge wear and tear up to</span>
            <TextField hiddenLabel fullWidth size="small" type="date" value={depDate} onChange={e => { setDepDate(e.target.value); setPreview(null); }} />
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800">
            This books one voucher: depreciation as an expense, matched by the same amount against the assets.
            Only the stretch since each asset was last charged is counted, so running it again for the same date changes nothing.
          </div>

          {preview && (
            <div className="space-y-2">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Assets to charge</span><span className="font-bold text-slate-800">{preview.chargeable}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Nothing to charge</span><span className="font-bold text-slate-800">{preview.skipped}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-2 mt-1"><span className="font-black text-slate-800">Total to be charged</span><span className="font-black text-blue-700">{rupees(preview.totalPaise)}</span></div>
              </div>
              {preview.rows.length > 0 && (
                <Table size="small">
                  <TableHead><TableRow>
                    <TableCell>Asset</TableCell><TableCell align="right">Days</TableCell>
                    <TableCell align="right">Charge</TableCell><TableCell align="right">Worth after</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {preview.rows.map(r => (
                      <TableRow key={r.assetId}>
                        <TableCell>
                          <span className={r.depreciationPaise > 0 ? 'font-semibold text-slate-700' : 'text-slate-400'}>{r.name}</span>
                          {r.skipReason && <span className="block text-[10px] text-slate-400 italic">{r.skipReason}</span>}
                        </TableCell>
                        <TableCell align="right" className="text-slate-500">{r.days || '—'}</TableCell>
                        <TableCell align="right" className={r.depreciationPaise > 0 ? 'font-bold text-amber-600' : 'text-slate-400'}>{r.depreciationPaise ? rupees(r.depreciationPaise) : '—'}</TableCell>
                        <TableCell align="right" className="font-semibold text-slate-700">{rupees(r.closingNetBookValuePaise)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {preview.totalPaise === 0 && (
                <p className="text-xs text-slate-500 text-center py-1">Nothing to charge for this date — everything is already up to date.</p>
              )}
            </div>
          )}
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={runPreview} disabled={depBusy} variant="outlined" fullWidth className="py-2.5 font-bold">{depBusy && !preview ? <CircularProgress size={18} /> : 'Preview'}</Button>
          <Button onClick={runDepreciation} disabled={depBusy || !preview || preview.totalPaise === 0} variant="contained" fullWidth className="py-2.5 font-bold">{depBusy ? <CircularProgress size={18} color="inherit" /> : 'Post'}</Button>
        </DialogActions>
      </Dialog>

      {/* Disposal — show the gain or loss before it posts, not after. */}
      <Dialog open={!!disposeOf} onClose={() => setDisposeOf(null)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3">
          <span>Dispose &ldquo;{disposeOf?.name}&rdquo;</span>
          <IconButton onClick={() => setDisposeOf(null)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Sold or scrapped? This takes the asset off the books — its cost and everything written off against it — and
            records whatever you got for it.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Date</span>
              <TextField hiddenLabel fullWidth size="small" type="date" value={disposal.disposedOn} onChange={e => setDisposal(d => ({ ...d, disposedOn: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Sold for (₹)</span>
              <TextField hiddenLabel fullWidth size="small" type="number" placeholder="0 if scrapped" value={disposal.proceeds} onChange={e => setDisposal(d => ({ ...d, proceeds: e.target.value }))} />
            </div>
          </div>
          {!!disposal.proceeds && Number(disposal.proceeds) > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Money received in</span>
              <FormControl fullWidth size="small">
                <Select value={disposal.receivedIn} onChange={e => setDisposal(d => ({ ...d, receivedIn: e.target.value }))}>
                  <MenuItem value="BANK">Bank</MenuItem><MenuItem value="CASH">Cash</MenuItem>
                </Select>
              </FormControl>
            </div>
          )}
          <TextField hiddenLabel fullWidth size="small" placeholder="Note (optional)" value={disposal.note} onChange={e => setDisposal(d => ({ ...d, note: e.target.value }))} />
          {disposalMath && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Worth on the books</span><b className="text-slate-800">{rupees(disposalMath.nbv)}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">You&apos;re getting</span><b className="text-slate-800">{rupees(disposalMath.proceeds)}</b></div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-500">{disposalMath.gain >= 0 ? 'Profit on sale' : 'Loss on sale'}</span>
                <b className={disposalMath.gain >= 0 ? 'text-emerald-700' : 'text-red-600'}>{rupees(Math.abs(disposalMath.gain))}</b>
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                {disposalMath.gain >= 0
                  ? 'Booked as Profit on Sale of Assets — taxable income, not a member contribution.'
                  : 'Booked as Loss on Sale of Assets — an expense for the year.'}
              </p>
            </div>
          )}
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setDisposeOf(null)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={doDispose} disabled={saving} variant="contained" color="error" fullWidth className="py-2.5 font-bold">
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Dispose'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Run history — the only way to undo a depreciation charge. */}
      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} slots={{ transition: Zoom }} maxWidth="md" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3">
          <div>
            <p className="font-bold text-slate-800">Depreciation runs</p>
            <p className="text-xs text-slate-500 font-normal mt-0.5">Charged the wrong period? Reverse it — the register and the ledger both roll back together.</p>
          </div>
          <IconButton onClick={() => setHistoryOpen(false)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent>
          {runs.length === 0 ? <div className="text-center py-12 text-slate-400 font-semibold text-sm">No depreciation has been run yet.</div> : (
            <TableContainer component={Paper} elevation={0} className="rounded-2xl border border-slate-200/60 overflow-x-auto">
              <Table size="small" sx={{ minWidth: 620 }}>
                <TableHead><TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Voucher</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Charged up to</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Assets</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right"></TableCell>
                </TableRow></TableHead>
                <TableBody className="bg-white">
                  {runs.map(r => (
                    <TableRow key={r._id}>
                      <TableCell className="font-mono text-xs font-bold text-slate-700">{r.voucherNumber}</TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{shortDate(r.upToDate)}</TableCell>
                      <TableCell align="right" className="text-slate-600">{r.assetsCharged}</TableCell>
                      <TableCell align="right" className="font-bold text-slate-800">{rupees(r.totalPaise)}</TableCell>
                      <TableCell>
                        {r.status === 'REVERSED'
                          ? <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-black border bg-red-50 text-red-600 border-red-100">Reversed</span>
                          : <span className="text-[9px] uppercase px-2 py-0.5 rounded-full font-black border bg-emerald-50 text-emerald-700 border-emerald-100">Posted</span>}
                        {r.reversalReason && <p className="text-[11px] text-slate-400 mt-0.5">{r.reversalReason}</p>}
                      </TableCell>
                      <TableCell align="right">
                        {r.status === 'POSTED' && (
                          <Button size="small" color="error" startIcon={<Undo2 className="w-3.5 h-3.5" />} onClick={() => setReverseOf(r)} className="font-bold whitespace-nowrap">Reverse</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!reverseOf} onClose={() => setReverseOf(null)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3">
          <span>Reverse depreciation run</span>
          <IconButton onClick={() => setReverseOf(null)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-3">
          <p className="text-sm text-slate-600">
            Undo <b>{reverseOf?.voucherNumber}</b> — {rupees(reverseOf?.totalPaise)} charged across {reverseOf?.assetsCharged} asset(s)
            up to {shortDate(reverseOf?.upToDate)}.
          </p>
          <TextField hiddenLabel fullWidth size="small" placeholder="Why? (optional)" value={reverseReason} onChange={e => setReverseReason(e.target.value)} />
          <p className="text-[11px] text-slate-500">
            The original entry stays on record and an opposite one is posted against it — that is how a ledger corrects itself.
            Each asset&apos;s written-off total goes back to what it was, so the period can be charged again correctly.
          </p>
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setReverseOf(null)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={doReverse} disabled={saving} variant="contained" color="error" fullWidth className="py-2.5 font-bold">
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Reverse'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
