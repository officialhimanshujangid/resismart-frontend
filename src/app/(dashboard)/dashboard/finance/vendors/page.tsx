'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip,
  CircularProgress, TablePagination, FormControl, Select, MenuItem, Switch, FormControlLabel, Tooltip,
} from '@mui/material';
import { Plus, X, Search, Pencil, Trash2, Building2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

const rupees = (p?: number) => `₹${((p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const money = (p?: number) => <span className="font-mono">{rupees(p)}</span>;
const dt = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

interface Vendor {
  _id: string; name: string; contactPerson?: string; phone?: string; email?: string;
  gstin?: string; pan?: string;
  tdsApplicable: boolean; tdsSection?: string; tdsRatePercent?: number;
  tdsThresholdSinglePaise: number; tdsThresholdAnnualPaise: number;
  bank?: { accountName?: string; last4?: string; ifsc?: string; bankName?: string; upiId?: string } | null;
  notes?: string; isActive: boolean;
  createdByName: string; updatedByName?: string; createdAt: string; updatedAt: string;
  outstandingPayablePaise?: number;
}

interface LedgerRow {
  entryId: string; voucherNumber: string; voucherType: string; entryDate: string;
  narration?: string; description?: string;
  debitPaise: number; creditPaise: number; balancePaise: number;
}

interface VendorDetail {
  vendor: Vendor; entries: LedgerRow[];
  outstandingPayablePaise: number; billedPaise: number; paidPaise: number;
  financialYear: string; fyGrossPaise: number; fyTdsPaise: number;
}

const blankForm = () => ({
  name: '', contactPerson: '', phone: '', email: '', gstin: '', pan: '',
  tdsApplicable: false, tdsSection: '194C', tdsRatePercent: '',
  tdsThresholdSingle: '30000', tdsThresholdAnnual: '100000',
  bankAccountName: '', bankAccountNumber: '', bankIfsc: '', bankName: '', bankUpiId: '',
  notes: '', isActive: true,
});

/** Sections most Indian societies deduct under, so nobody has to look them up. */
const TDS_SECTIONS = [
  { v: '194C', l: '194C — Contractors (₹30k / ₹1L)' },
  { v: '194J', l: '194J — Professional / technical' },
  { v: '194I', l: '194I — Rent' },
  { v: '194H', l: '194H — Commission / brokerage' },
  { v: '194Q', l: '194Q — Purchase of goods' },
];

export default function VendorsPage() {
  const { showToast, confirm } = useToastConfirm();
  const [rows, setRows] = useState<Vendor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('true');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<VendorDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page + 1), pageSize: String(pageSize) });
      if (search.trim()) params.append('search', search.trim());
      if (activeFilter) params.append('isActive', activeFilter);
      const res = await api.get(`/finance/society/vendors?${params.toString()}`);
      setRows(res.data.vendors || []);
      setTotal(res.data.pagination?.total ?? 0);
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to load vendors', 'error'); }
    finally { setLoading(false); }
  }, [page, pageSize, search, activeFilter, showToast]);

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const openCreate = () => { setEditing(null); setForm(blankForm()); setFormOpen(true); };

  const openEdit = (v: Vendor) => {
    setEditing(v);
    setForm({
      name: v.name, contactPerson: v.contactPerson || '', phone: v.phone || '', email: v.email || '',
      gstin: v.gstin || '', pan: v.pan || '',
      tdsApplicable: v.tdsApplicable, tdsSection: v.tdsSection || '194C',
      tdsRatePercent: v.tdsRatePercent != null ? String(v.tdsRatePercent) : '',
      tdsThresholdSingle: String((v.tdsThresholdSinglePaise || 0) / 100),
      tdsThresholdAnnual: String((v.tdsThresholdAnnualPaise || 0) / 100),
      bankAccountName: v.bank?.accountName || '', bankAccountNumber: '',
      bankIfsc: v.bank?.ifsc || '', bankName: v.bank?.bankName || '', bankUpiId: v.bank?.upiId || '',
      notes: v.notes || '', isActive: v.isActive,
    });
    setFormOpen(true);
  };

  const openDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      const res = await api.get(`/finance/society/vendors/${id}`);
      setDetail(res.data);
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to load vendor', 'error'); }
    finally { setDetailLoading(false); }
  };

  const submit = async () => {
    setSaving(true);
    try {
      const body: any = {
        name: form.name.trim(),
        contactPerson: form.contactPerson || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        gstin: form.gstin ? form.gstin.toUpperCase() : undefined,
        pan: form.pan ? form.pan.toUpperCase() : undefined,
        tdsApplicable: form.tdsApplicable,
        tdsSection: form.tdsApplicable ? form.tdsSection : undefined,
        tdsRatePercent: form.tdsApplicable && form.tdsRatePercent ? Number(form.tdsRatePercent) : undefined,
        tdsThresholdSinglePaise: Math.round(parseFloat(form.tdsThresholdSingle || '0') * 100),
        tdsThresholdAnnualPaise: Math.round(parseFloat(form.tdsThresholdAnnual || '0') * 100),
        notes: form.notes || undefined,
        isActive: form.isActive,
      };
      const bank: any = {};
      if (form.bankAccountName) bank.accountName = form.bankAccountName;
      if (form.bankAccountNumber) bank.accountNumber = form.bankAccountNumber;
      if (form.bankIfsc) bank.ifsc = form.bankIfsc.toUpperCase();
      if (form.bankName) bank.bankName = form.bankName;
      if (form.bankUpiId) bank.upiId = form.bankUpiId;
      if (Object.keys(bank).length) body.bank = bank;

      if (editing) await api.put(`/finance/society/vendors/${editing._id}`, body);
      else await api.post('/finance/society/vendors', body);
      showToast(editing ? 'Vendor updated' : 'Vendor added', 'success');
      setFormOpen(false); load();
      if (detail?.vendor._id === editing?._id && editing) openDetail(editing._id);
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to save vendor', 'error'); }
    finally { setSaving(false); }
  };

  const remove = async (v: Vendor) => {
    const yes = await confirm({
      title: `Remove ${v.name}?`,
      message: 'If this vendor has any bills against it, it will be deactivated instead of deleted so its history and TDS record stay intact.',
      confirmText: 'Remove', cancelText: 'Cancel',
    });
    if (!yes) return;
    try {
      const res = await api.delete(`/finance/society/vendors/${v._id}`);
      showToast(res.data?.message || 'Done', 'success');
      if (detail?.vendor._id === v._id) setDetail(null);
      load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to remove vendor', 'error'); }
  };

  // ---------------------------------------------------------------- detail view
  if (detail) {
    const d = detail;
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center gap-3">
          <IconButton size="small" onClick={() => setDetail(null)}><ArrowLeft className="w-5 h-5" /></IconButton>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-slate-800 truncate">{d.vendor.name}</h1>
            <p className="text-xs text-slate-500">{d.vendor.contactPerson || 'No contact person'}{d.vendor.phone ? ` · ${d.vendor.phone}` : ''}</p>
          </div>
          {!d.vendor.isActive && <Chip size="small" label="Inactive" className="bg-slate-200 text-slate-600 font-bold" />}
          <Button variant="outlined" startIcon={<Pencil className="w-4 h-4" />} onClick={() => openEdit(d.vendor)}>Edit</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: 'Outstanding payable', v: d.outstandingPayablePaise, tone: d.outstandingPayablePaise > 0 ? 'text-amber-600' : 'text-emerald-600' },
            { l: `Billed in ${d.financialYear}`, v: d.fyGrossPaise, tone: 'text-slate-800' },
            { l: `TDS withheld ${d.financialYear}`, v: d.fyTdsPaise, tone: 'text-slate-800' },
            { l: 'Paid to date', v: d.paidPaise, tone: 'text-slate-800' },
          ].map(t => (
            <Paper key={t.l} elevation={0} className="p-4 rounded-2xl border border-slate-200/60">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t.l}</p>
              <p className={`text-xl font-black mt-1 font-mono ${t.tone}`}>{rupees(t.v)}</p>
            </Paper>
          ))}
        </div>

        <Paper elevation={0} className="p-5 rounded-2xl border border-slate-200/60 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {[
            ['PAN', d.vendor.pan], ['GSTIN', d.vendor.gstin], ['Email', d.vendor.email],
            ['TDS', d.vendor.tdsApplicable ? `${d.vendor.tdsSection} @ ${d.vendor.tdsRatePercent}%` : 'Not deducted'],
            ['TDS thresholds', d.vendor.tdsApplicable ? `${rupees(d.vendor.tdsThresholdSinglePaise)} single · ${rupees(d.vendor.tdsThresholdAnnualPaise)} a year` : '—'],
            ['Bank', d.vendor.bank?.last4 ? `${d.vendor.bank.bankName || 'Account'} ••••${d.vendor.bank.last4}${d.vendor.bank.ifsc ? ` · ${d.vendor.bank.ifsc}` : ''}` : d.vendor.bank?.upiId || '—'],
          ].map(([l, v]) => (
            <div key={l as string}>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">{l}</p>
              <p className="font-semibold text-slate-700 mt-0.5 break-words">{(v as string) || '—'}</p>
            </div>
          ))}
          {d.vendor.tdsApplicable && !d.vendor.pan && (
            <div className="sm:col-span-2 lg:col-span-3 bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              TDS is being deducted but there is no PAN on record. Form 26Q cannot be filed for this vendor until you add one.
            </div>
          )}
          {d.vendor.notes && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Notes</p>
              <p className="text-slate-600 mt-0.5">{d.vendor.notes}</p>
            </div>
          )}
        </Paper>

        <div>
          <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Account with the society (Sundry Creditors)</p>
          <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead><TableRow>
                {['Date', 'Voucher', 'Particulars', 'Billed', 'Paid', 'Balance'].map((h, i) => (
                  <TableCell key={h} sx={{ fontWeight: 700 }} align={i > 2 ? 'right' : 'left'}>{h}</TableCell>
                ))}
              </TableRow></TableHead>
              <TableBody className="bg-white">
                {d.entries.length === 0 ? (
                  <TableRow><TableCell colSpan={6} align="center" className="py-10 text-slate-400 text-sm font-semibold">Nothing billed to this vendor yet.</TableCell></TableRow>
                ) : d.entries.map(e => (
                  <TableRow key={`${e.entryId}-${e.voucherNumber}`} hover>
                    <TableCell>{dt(e.entryDate)}</TableCell>
                    <TableCell className="font-mono text-xs">{e.voucherNumber}</TableCell>
                    <TableCell className="text-slate-600">{e.description || e.narration || '—'}</TableCell>
                    <TableCell align="right">{e.creditPaise > 0 ? money(e.creditPaise) : '—'}</TableCell>
                    <TableCell align="right">{e.debitPaise > 0 ? money(e.debitPaise) : '—'}</TableCell>
                    <TableCell align="right" className="font-bold">{money(e.balancePaise)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <p className="text-[11px] text-slate-400 mt-2">
            Built from the posted ledger, so the total of every vendor&apos;s balance here equals the Sundry Creditors figure on your Balance Sheet.
          </p>
        </div>

        {formOpen && <VendorForm />}
      </div>
    );
  }

  // ------------------------------------------------------------------ list view
  function VendorForm() {
    return (
      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3">
          <span>{editing ? `Edit ${editing.name}` : 'New vendor'}</span>
          <IconButton onClick={() => setFormOpen(false)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <DialogContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Vendor name *"><TextField hiddenLabel fullWidth size="small" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Contact person"><TextField hiddenLabel fullWidth size="small" value={form.contactPerson} onChange={e => setForm(f => ({ ...f, contactPerson: e.target.value }))} /></Field>
            <Field label="Phone"><TextField hiddenLabel fullWidth size="small" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></Field>
            <Field label="Email"><TextField hiddenLabel fullWidth size="small" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="PAN"><TextField hiddenLabel fullWidth size="small" placeholder="AABCL1234M" value={form.pan} onChange={e => setForm(f => ({ ...f, pan: e.target.value.toUpperCase() }))} /></Field>
            <Field label="GSTIN"><TextField hiddenLabel fullWidth size="small" placeholder="27AABCL1234M1Z5" value={form.gstin} onChange={e => setForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))} /></Field>
          </div>

          <div className="border-t pt-4 space-y-3">
            <FormControlLabel
              control={<Switch checked={form.tdsApplicable} onChange={e => setForm(f => ({ ...f, tdsApplicable: e.target.checked }))} />}
              label={<span className="text-sm font-semibold">Deduct TDS from this vendor</span>}
            />
            {form.tdsApplicable && (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Section">
                    <FormControl fullWidth size="small">
                      <Select value={form.tdsSection} onChange={e => setForm(f => ({ ...f, tdsSection: e.target.value }))}>
                        {TDS_SECTIONS.map(s => <MenuItem key={s.v} value={s.v}>{s.l}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Field>
                  <Field label="Rate (%)"><TextField hiddenLabel fullWidth size="small" type="number" value={form.tdsRatePercent} onChange={e => setForm(f => ({ ...f, tdsRatePercent: e.target.value }))} /></Field>
                  <Field label="Single-bill threshold (₹)"><TextField hiddenLabel fullWidth size="small" type="number" value={form.tdsThresholdSingle} onChange={e => setForm(f => ({ ...f, tdsThresholdSingle: e.target.value }))} /></Field>
                  <Field label="Annual threshold (₹)"><TextField hiddenLabel fullWidth size="small" type="number" value={form.tdsThresholdAnnual} onChange={e => setForm(f => ({ ...f, tdsThresholdAnnual: e.target.value }))} /></Field>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Nothing is withheld until a single bill crosses the first figure, or the year&apos;s total for this vendor crosses the second — then the whole year catches up. Set either to 0 to deduct from the first rupee. <b>PAN is required</b>: Form 26Q cannot be filed without it.
                </p>
              </>
            )}
          </div>

          <div className="border-t pt-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Payment details</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Account holder"><TextField hiddenLabel fullWidth size="small" value={form.bankAccountName} onChange={e => setForm(f => ({ ...f, bankAccountName: e.target.value }))} /></Field>
              <Field label={editing?.bank?.last4 ? `Account number (saved ••••${editing.bank.last4})` : 'Account number'}>
                <TextField hiddenLabel fullWidth size="small" type="password" placeholder={editing?.bank?.last4 ? 'Blank keeps the saved one' : ''} value={form.bankAccountNumber} onChange={e => setForm(f => ({ ...f, bankAccountNumber: e.target.value }))} />
              </Field>
              <Field label="IFSC"><TextField hiddenLabel fullWidth size="small" placeholder="HDFC0001234" value={form.bankIfsc} onChange={e => setForm(f => ({ ...f, bankIfsc: e.target.value.toUpperCase() }))} /></Field>
              <Field label="Bank"><TextField hiddenLabel fullWidth size="small" value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} /></Field>
              <Field label="UPI ID"><TextField hiddenLabel fullWidth size="small" placeholder="vendor@okicici" value={form.bankUpiId} onChange={e => setForm(f => ({ ...f, bankUpiId: e.target.value }))} /></Field>
            </div>
            <p className="text-[11px] text-slate-500">The account number is encrypted and never shown again — only its last four digits.</p>
          </div>

          <div className="border-t pt-4 space-y-3">
            <Field label="Notes"><TextField hiddenLabel fullWidth size="small" multiline minRows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></Field>
            <FormControlLabel
              control={<Switch checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />}
              label={<span className="text-sm font-semibold">Active</span>}
            />
          </div>
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setFormOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={submit} disabled={saving || !form.name.trim()} variant="contained" fullWidth className="py-2.5 font-bold">
            {saving ? <CircularProgress size={18} color="inherit" /> : editing ? 'Save' : 'Add vendor'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Vendors</h1>
          <p className="text-sm text-slate-500">Who the society pays, what it still owes them, and the TDS record behind it.</p>
        </div>
        <Button variant="contained" startIcon={<Plus className="w-4 h-4" />} onClick={openCreate} className="font-bold">New vendor</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <TextField
          hiddenLabel size="small" placeholder="Search name, PAN, GSTIN, phone…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          slotProps={{ input: { startAdornment: <Search className="w-4 h-4 text-slate-400 mr-2" /> } }}
          className="flex-1 min-w-[220px]"
        />
        <FormControl size="small" className="w-40">
          <Select value={activeFilter} onChange={e => { setActiveFilter(e.target.value); setPage(0); }} displayEmpty>
            <MenuItem value="true">Active only</MenuItem>
            <MenuItem value="false">Inactive only</MenuItem>
            <MenuItem value="">All vendors</MenuItem>
          </Select>
        </FormControl>
      </div>

      <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        <Table size="small" sx={{ minWidth: 760 }}>
          <TableHead><TableRow>
            {['Vendor', 'PAN', 'TDS', 'Outstanding', ''].map((h, i) => (
              <TableCell key={h || i} sx={{ fontWeight: 700 }} align={i === 3 ? 'right' : 'left'}>{h}</TableCell>
            ))}
          </TableRow></TableHead>
          <TableBody className="bg-white">
            {loading ? (
              <TableRow><TableCell colSpan={5} align="center" className="py-12"><CircularProgress size={28} /></TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} align="center" className="py-12 text-slate-400 text-sm font-semibold">
                {search ? 'No vendor matches that search.' : 'No vendors yet. Add the first one to start recording expenses against it.'}
              </TableCell></TableRow>
            ) : rows.map(v => (
              <TableRow key={v._id} hover sx={{ cursor: 'pointer' }} onClick={() => openDetail(v._id)}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-300 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{v.name}</p>
                      {v.contactPerson && <p className="text-xs text-slate-400 truncate">{v.contactPerson}</p>}
                    </div>
                    {!v.isActive && <Chip size="small" label="Inactive" className="bg-slate-100 text-slate-500 text-[10px]" />}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {v.pan || (v.tdsApplicable
                    ? <Tooltip title="TDS is deducted but no PAN is on record — Form 26Q cannot be filed"><span className="text-red-600 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" />missing</span></Tooltip>
                    : <span className="text-slate-300">—</span>)}
                </TableCell>
                <TableCell className="text-xs text-slate-600">{v.tdsApplicable ? `${v.tdsSection || '—'} @ ${v.tdsRatePercent}%` : <span className="text-slate-300">None</span>}</TableCell>
                <TableCell align="right" className={`font-bold font-mono ${(v.outstandingPayablePaise || 0) > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {rupees(v.outstandingPayablePaise)}
                </TableCell>
                <TableCell align="right" onClick={e => e.stopPropagation()}>
                  <IconButton size="small" onClick={() => openEdit(v)}><Pencil className="w-4 h-4 text-slate-400" /></IconButton>
                  <IconButton size="small" onClick={() => remove(v)}><Trash2 className="w-4 h-4 text-slate-400" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div" count={total} page={page} rowsPerPage={pageSize}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={e => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[25, 50, 100]}
        />
      </TableContainer>

      {detailLoading && <div className="flex justify-center py-4"><CircularProgress size={24} /></div>}
      {formOpen && <VendorForm />}
    </div>
  );
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span>
    {children}
  </div>
);
