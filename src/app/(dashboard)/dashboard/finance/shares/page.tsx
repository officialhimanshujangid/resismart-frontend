'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, TextField, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, FormControl, Select, MenuItem, Zoom, Autocomplete, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, TablePagination, FormControlLabel, Switch, Chip,
} from '@mui/material';
import { Plus, X, Info, ArrowLeftRight } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface Flat { _id: string; number: string; blockName: string }
interface Row {
  _id: string;
  certificateNumber: string; flat: string; memberName: string; shares: string;
  shareCount: number; amountPaise: number; issuedOn: string; status: string;
}
interface Register {
  rows: Row[]; totalMembers: number; totalSharesIssued: number;
  totalShareCapitalPaise: number; flatsWithoutShares: number;
}

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const shortDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function SharesPage() {
  const { showToast } = useToastConfirm();
  const [reg, setReg] = useState<Register | null>(null);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(false);
  const [open, setOpen] = useState(false);
  const [transferOf, setTransferOf] = useState<Row | null>(null);
  const [toMember, setToMember] = useState('');
  const [page, setPage] = useState(0);
  const [rpp, setRpp] = useState(25);

  // ₹50 a share is the common face value in Indian co-operative societies; how
  // many each member holds varies by the society's own bye-laws, so it's asked for.
  const [form, setForm] = useState({ flatId: '', memberName: '', shareCount: '5', faceValue: '50', receivedIn: 'BANK' });

  const load = async () => {
    try {
      setLoading(true);
      const [r, f] = await Promise.all([
        api.get(`/finance/society/shares?includeHistory=${history}`),
        api.get('/societies/flats'),
      ]);
      setReg(r.data);
      setFlats(f.data.flats || []);
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to load the register', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [history]);

  const issue = async () => {
    setSaving(true);
    try {
      await api.post('/finance/society/shares', {
        flatId: form.flatId,
        memberName: form.memberName.trim(),
        shareCount: Number(form.shareCount),
        faceValuePaise: Math.round(parseFloat(form.faceValue || '0') * 100),
        receivedIn: form.receivedIn,
      });
      showToast('Share certificate issued', 'success');
      setOpen(false); setForm({ ...form, flatId: '', memberName: '' }); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Could not issue the certificate', 'error'); }
    finally { setSaving(false); }
  };

  const doTransfer = async () => {
    if (!transferOf) return;
    setSaving(true);
    try {
      await api.post(`/finance/society/shares/${transferOf._id}/transfer`, { toMemberName: toMember.trim() });
      showToast('Shares transferred', 'success');
      setTransferOf(null); setToMember(''); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Could not transfer the shares', 'error'); }
    finally { setSaving(false); }
  };

  const amount = Number(form.shareCount || 0) * (parseFloat(form.faceValue || '0') || 0);
  const rows = (reg?.rows || []).slice(page * rpp, page * rpp + rpp);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Members &amp; Shares</h1>
          <p className="text-sm text-slate-500 mt-0.5">The society&apos;s statutory register of members</p>
        </div>
        <div className="flex gap-2 items-center">
          <FormControlLabel control={<Switch size="small" checked={history} onChange={e => setHistory(e.target.checked)} />} label={<span className="text-xs font-semibold">Show past holders</span>} />
          <Button onClick={() => setOpen(true)} variant="contained" startIcon={<Plus className="w-4 h-4" />}>Issue Shares</Button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800 flex gap-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Membership of a co-operative society runs through <b>shares</b>, not through owning the flat — every member holds a
          numbered certificate, and the society must keep this register. Share money is <b>capital</b>, not income: it raises the
          Share Capital line on your Balance Sheet and never touches Income &amp; Expenditure. When a flat changes hands the
          certificate is transferred, never edited, so the register keeps the whole chain of who held what.
          <span className="block mt-1 text-blue-700/80">The exact statutory form differs by state — in Maharashtra this is the &ldquo;J Form&rdquo;.</span>
        </span>
      </div>

      {loading ? <div className="flex justify-center py-16"><CircularProgress size={30} /></div> : (<>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {([['Members on record', String(reg?.totalMembers ?? 0), 'text-slate-800'],
            ['Shares issued', String(reg?.totalSharesIssued ?? 0), 'text-slate-800'],
            ['Share capital', rupees(reg?.totalShareCapitalPaise), 'text-emerald-700'],
            ['Flats with no shares', String(reg?.flatsWithoutShares ?? 0), (reg?.flatsWithoutShares || 0) > 0 ? 'text-amber-600' : 'text-slate-800']] as const).map(([l, v, tone]) => (
            <Paper key={l} elevation={0} className="p-4 rounded-2xl border border-slate-200/60">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{l}</p>
              <p className={`text-lg font-black ${tone}`}>{v}</p>
            </Paper>
          ))}
        </div>

        {(reg?.flatsWithoutShares || 0) > 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span><b>{reg?.flatsWithoutShares}</b> flat(s) hold no shares, so their occupants are not yet members of the society. Issue certificates to complete the register.</span>
          </div>
        )}

        <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
          {!reg?.rows.length ? <div className="text-center py-16 text-slate-400 font-semibold text-sm">No certificates issued yet.</div> : (
            <Table sx={{ minWidth: 780 }}>
              <TableHead><TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Certificate</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Flat</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Member</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Share nos.</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Shares</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Amount</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Issued</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right"></TableCell>
              </TableRow></TableHead>
              <TableBody className="bg-white">
                {rows.map(r => (
                  <TableRow key={r.certificateNumber}>
                    <TableCell className="font-mono text-xs font-bold text-slate-700">{r.certificateNumber}</TableCell>
                    <TableCell className="font-semibold text-slate-700">{r.flat}</TableCell>
                    <TableCell className="text-slate-600">{r.memberName}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{r.shares}</TableCell>
                    <TableCell align="right" className="text-slate-700">{r.shareCount}</TableCell>
                    <TableCell align="right" className="font-mono text-slate-700">{rupees(r.amountPaise)}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{shortDate(r.issuedOn)}</TableCell>
                    <TableCell align="right">
                      {r.status === 'ACTIVE'
                        ? <Button size="small" startIcon={<ArrowLeftRight className="w-3.5 h-3.5" />} onClick={() => setTransferOf(r)} className="font-bold">Transfer</Button>
                        : <Chip size="small" label={r.status} className="bg-slate-100 text-slate-500 font-bold" />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!!reg?.rows.length && (
            <TablePagination component="div" count={reg.rows.length} page={page} rowsPerPage={rpp}
              onPageChange={(_, p) => setPage(p)}
              onRowsPerPageChange={e => { setRpp(parseInt(e.target.value, 10)); setPage(0); }}
              rowsPerPageOptions={[25, 50, 100]} />
          )}
        </TableContainer>
      </>)}

      <Dialog open={open} onClose={() => setOpen(false)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3"><span>Issue share certificate</span><IconButton onClick={() => setOpen(false)} size="small"><X className="w-5 h-5" /></IconButton></DialogTitle>
        <DialogContent className="space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Flat *</span>
            <Autocomplete size="small" options={flats} getOptionLabel={f => `${f.blockName} ${f.number}`.trim()}
              value={flats.find(f => f._id === form.flatId) || null}
              onChange={(_, v) => setForm(f => ({ ...f, flatId: v?._id || '' }))}
              renderInput={params => <TextField {...params} hiddenLabel placeholder="Select flat" />} />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Member name *</span>
            <TextField hiddenLabel fullWidth size="small" value={form.memberName} onChange={e => setForm(f => ({ ...f, memberName: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Number of shares</span>
              <TextField hiddenLabel fullWidth size="small" type="number" value={form.shareCount} onChange={e => setForm(f => ({ ...f, shareCount: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Face value each (₹)</span>
              <TextField hiddenLabel fullWidth size="small" type="number" value={form.faceValue} onChange={e => setForm(f => ({ ...f, faceValue: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Money received in</span>
            <FormControl fullWidth size="small">
              <Select value={form.receivedIn} onChange={e => setForm(f => ({ ...f, receivedIn: e.target.value }))}>
                <MenuItem value="BANK">Bank</MenuItem><MenuItem value="CASH">Cash</MenuItem>
              </Select>
            </FormControl>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm">
            <span className="text-slate-500">Share money to collect:</span> <b className="text-slate-800">₹{amount.toLocaleString('en-IN')}</b>
            <p className="text-[11px] text-slate-500 mt-1">Posted as Share Capital, not income. Share numbers are allotted automatically.</p>
          </div>
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={issue} disabled={saving || !form.flatId || !form.memberName.trim() || Number(form.shareCount) < 1} variant="contained" fullWidth className="py-2.5 font-bold">
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Issue'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!transferOf} onClose={() => setTransferOf(null)} slots={{ transition: Zoom }} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3"><span>Transfer shares</span><IconButton onClick={() => setTransferOf(null)} size="small"><X className="w-5 h-5" /></IconButton></DialogTitle>
        <DialogContent className="space-y-3">
          <p className="text-sm text-slate-600">
            {transferOf?.flat} · certificate <b>{transferOf?.certificateNumber}</b> held by <b>{transferOf?.memberName}</b>.
          </p>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Transfer to *</span>
            <TextField hiddenLabel fullWidth size="small" placeholder="New member's name" value={toMember} onChange={e => setToMember(e.target.value)} />
          </div>
          <p className="text-[11px] text-slate-500">The same share numbers move to a fresh certificate; the old one is retired but stays on the register. No money moves — the capital hasn&apos;t changed, only who holds it.</p>
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setTransferOf(null)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={doTransfer} disabled={saving || !toMember.trim()} variant="contained" fullWidth className="py-2.5 font-bold">
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Transfer'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
