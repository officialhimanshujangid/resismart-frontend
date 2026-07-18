'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, IconButton,
  CircularProgress, TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
  TablePagination, Paper, Zoom, FormControl, Select, MenuItem, Grid, Switch, FormControlLabel, Chip,
} from '@mui/material';
import { Plus, Pencil, Trash2, X, Tag } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

interface FlatSize { _id: string; name: string; }
interface Fund { _id: string; name: string; category: string; ledgerAccountCode?: string; }
interface PerSize { flatSizeId: string; label: string; amountPaise: number; }
interface PerBlock { blockId: string; label: string; amountPaise: number; }
interface ChargeHead {
  _id: string;
  code: string; name: string; description?: string;
  category: string; pricingMode: string;
  uniformAmountPaise?: number; perSizeAmounts?: PerSize[]; perBlockAmounts?: PerBlock[];
  ratePerSqftPaise?: number; areaBasis?: string;
  perUnitRatePaise?: number; meterType?: string;
  quantityKey?: string;
  percentOf?: string; percentValue?: number;
  applicability?: { occupancy?: string[]; blockIds?: string[]; flatIds?: string[]; exemptFlatIds?: string[] };
  billTo?: string;
  gstApplicable?: boolean; gstRatePercent?: number; sacCode?: string;
  countsTowardRwaExemption?: boolean;
  incomeAccountCode?: string;
  fundId?: string;
  isRecurring?: boolean; isActive?: boolean; sortOrder?: number;
}

const CATEGORIES = ['MAINTENANCE', 'SINKING_FUND', 'REPAIR_FUND', 'CORPUS', 'WATER', 'PARKING', 'FESTIVAL', 'NON_OCCUPANCY', 'UTILITY', 'ADHOC', 'OTHER'];
const PRICING_MODES = [
  { v: 'UNIFORM', l: 'Uniform (same for all flats)' },
  { v: 'PER_FLAT_SIZE', l: 'Per flat size' },
  { v: 'PER_BLOCK', l: 'Per wing / block' },
  { v: 'PER_SQFT', l: 'Per sq. ft. (area based)' },
  { v: 'METERED', l: 'Metered (per unit)' },
  { v: 'PER_QUANTITY', l: 'Per quantity (e.g. 2 cars × ₹500)' },
  { v: 'PERCENTAGE', l: 'Percentage of another head' },
  { v: 'FLAT_ADHOC', l: 'Fixed one-time / ad-hoc' },
];
/** Keys societies commonly count. Free text is still allowed — this is a nudge, not a list. */
const QUANTITY_KEY_SUGGESTIONS = ['parkingSlots', 'twoWheelerSlots', 'shops', 'servantRooms'];
const OCCUPANCY = ['ALL', 'OWNER_OCCUPIED', 'RENTED', 'VACANT'];

const rupees = (paise?: number) => ((paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const blankForm = () => ({
  code: '', name: '', description: '', category: 'MAINTENANCE', pricingMode: 'UNIFORM',
  uniformAmount: '', perSizeAmounts: [] as { flatSizeId: string; label: string; amount: string }[],
  perBlockAmounts: [] as { blockId: string; label: string; amount: string }[], blockIds: [] as string[],
  ratePerSqft: '', areaBasis: 'CARPET', perUnitRate: '', meterType: '', quantityKey: '',
  percentOf: 'MAINTENANCE', percentValue: '', occupancy: ['ALL'] as string[], billTo: 'OWNER',
  fundId: '',
  gstApplicable: false, gstRatePercent: '', sacCode: '', countsTowardRwaExemption: true,
  isRecurring: true, isActive: true, sortOrder: '100',
});

export default function ChargeHeadsPage() {
  const { showToast, confirm } = useToastConfirm();
  const [heads, setHeads] = useState<ChargeHead[]>([]);
  const [sizes, setSizes] = useState<FlatSize[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [blocks, setBlocks] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  const load = async () => {
    try {
      setLoading(true);
      const [h, s, f, b] = await Promise.all([
        api.get('/finance/society/charge-heads'),
        api.get('/flat-sizes'),
        api.get('/finance/society/funds'),
        api.get('/societies/blocks'),
      ]);
      setHeads(h.data);
      setSizes(s.data.flatSizes || []);
      setFunds(f.data || []);
      setBlocks(Array.isArray(b.data) ? b.data : (b.data?.blocks ?? []));
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Failed to load charge heads', 'error');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const set = (patch: Partial<ReturnType<typeof blankForm>>) => setForm(f => ({ ...f, ...patch }));

  const openCreate = () => { setEditId(null); setForm(blankForm()); setModalOpen(true); };
  const openEdit = (h: ChargeHead) => {
    setEditId(h._id);
    setForm({
      ...blankForm(),
      code: h.code, name: h.name, description: h.description || '',
      category: h.category, pricingMode: h.pricingMode,
      uniformAmount: h.uniformAmountPaise ? String(h.uniformAmountPaise / 100) : '',
      perSizeAmounts: (h.perSizeAmounts || []).map(p => ({ flatSizeId: p.flatSizeId, label: p.label, amount: String(p.amountPaise / 100) })),
      perBlockAmounts: (h.perBlockAmounts || []).map(p => ({ blockId: p.blockId, label: p.label, amount: String(p.amountPaise / 100) })),
      blockIds: h.applicability?.blockIds || [],
      ratePerSqft: h.ratePerSqftPaise ? String(h.ratePerSqftPaise / 100) : '',
      areaBasis: h.areaBasis || 'CARPET',
      perUnitRate: h.perUnitRatePaise ? String(h.perUnitRatePaise / 100) : '',
      meterType: h.meterType || '',
      quantityKey: h.quantityKey || '',
      percentOf: h.percentOf || 'MAINTENANCE', percentValue: h.percentValue ? String(h.percentValue) : '',
      // Keep the whole array — collapsing to [0] here silently dropped every
      // occupancy beyond the first on save.
      occupancy: h.applicability?.occupancy?.length ? h.applicability.occupancy : ['ALL'],
      billTo: h.billTo || 'OWNER',
      fundId: h.fundId || '',
      gstApplicable: !!h.gstApplicable, gstRatePercent: h.gstRatePercent ? String(h.gstRatePercent) : '',
      sacCode: h.sacCode || '', countsTowardRwaExemption: h.countsTowardRwaExemption ?? true,
      isRecurring: h.isRecurring ?? true, isActive: h.isActive ?? true,
      sortOrder: String(h.sortOrder ?? 100),
    });
    setModalOpen(true);
  };

  const toPaise = (v: string) => Math.round(parseFloat(v || '0') * 100);

  const buildPayload = () => {
    const p: any = {
      code: form.code.trim(), name: form.name.trim(), description: form.description || undefined,
      category: form.category, pricingMode: form.pricingMode,
      // blockIds is sent explicitly so an edit can clear it; omitting the key
      // would leave the stored scoping untouched, which is the behaviour we want
      // for the keys this form does not manage (flatIds, exemptFlatIds).
      applicability: { occupancy: form.occupancy.length ? form.occupancy : ['ALL'], blockIds: form.blockIds }, billTo: form.billTo,
      fundId: form.fundId || '', // '' unlinks; the backend falls back to the category default
      gstApplicable: form.gstApplicable,
      gstRatePercent: form.gstApplicable && form.gstRatePercent ? Number(form.gstRatePercent) : undefined,
      sacCode: form.gstApplicable && form.sacCode ? form.sacCode : undefined,
      countsTowardRwaExemption: form.countsTowardRwaExemption,
      isRecurring: form.isRecurring, isActive: form.isActive, sortOrder: Number(form.sortOrder) || 100,
    };
    if (form.pricingMode === 'UNIFORM' || form.pricingMode === 'FLAT_ADHOC') p.uniformAmountPaise = toPaise(form.uniformAmount);
    if (form.pricingMode === 'PER_FLAT_SIZE') p.perSizeAmounts = form.perSizeAmounts.filter(r => r.flatSizeId).map(r => ({ flatSizeId: r.flatSizeId, label: r.label, amountPaise: toPaise(r.amount) }));
    if (form.pricingMode === 'PER_BLOCK') p.perBlockAmounts = form.perBlockAmounts.filter(r => r.blockId).map(r => ({ blockId: r.blockId, label: r.label, amountPaise: toPaise(r.amount) }));
    if (form.pricingMode === 'PER_SQFT') { p.ratePerSqftPaise = toPaise(form.ratePerSqft); p.areaBasis = form.areaBasis; }
    if (form.pricingMode === 'METERED') { p.perUnitRatePaise = toPaise(form.perUnitRate); p.meterType = form.meterType || undefined; }
    if (form.pricingMode === 'PER_QUANTITY') { p.perUnitRatePaise = toPaise(form.perUnitRate); p.quantityKey = form.quantityKey.trim() || undefined; }
    if (form.pricingMode === 'PERCENTAGE') { p.percentOf = form.percentOf; p.percentValue = Number(form.percentValue) || 0; }
    return p;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editId) { const { code, ...rest } = payload; await api.put(`/finance/society/charge-heads/${editId}`, rest); showToast('Charge head updated', 'success'); }
      else { await api.post('/finance/society/charge-heads', payload); showToast('Charge head created', 'success'); }
      setModalOpen(false); load();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to save charge head', 'error');
    } finally { setSaving(false); }
  };

  const remove = async (h: ChargeHead) => {
    const ok = await confirm({ title: 'Delete charge head', message: `Delete "${h.name}"? If it's used on invoices it will be deactivated instead.`, confirmText: 'Delete', severity: 'error' });
    if (!ok) return;
    try { await api.delete(`/finance/society/charge-heads/${h._id}`); showToast('Charge head removed', 'success'); load(); }
    catch (e: any) { showToast(e.response?.data?.error || 'Failed to delete', 'error'); }
  };

  const addSizeRow = () => set({ perSizeAmounts: [...form.perSizeAmounts, { flatSizeId: '', label: '', amount: '' }] });
  const setSizeRow = (i: number, patch: any) => set({ perSizeAmounts: form.perSizeAmounts.map((r, idx) => idx === i ? { ...r, ...patch } : r) });
  const addBlockRow = () => set({ perBlockAmounts: [...form.perBlockAmounts, { blockId: '', label: '', amount: '' }] });
  const setBlockRow = (i: number, patch: any) => set({ perBlockAmounts: form.perBlockAmounts.map((r, idx) => idx === i ? { ...r, ...patch } : r) });

  const priceLabel = (h: ChargeHead) => {
    switch (h.pricingMode) {
      case 'UNIFORM': case 'FLAT_ADHOC': return `₹${rupees(h.uniformAmountPaise)}`;
      case 'PER_FLAT_SIZE': return `${h.perSizeAmounts?.length || 0} size tiers`;
      case 'PER_BLOCK': return `${h.perBlockAmounts?.length || 0} wing rates`;
      case 'PER_SQFT': return `₹${rupees(h.ratePerSqftPaise)}/sqft`;
      case 'METERED': return `₹${rupees(h.perUnitRatePaise)}/unit`;
      case 'PER_QUANTITY': return `₹${rupees(h.perUnitRatePaise)} × ${h.quantityKey || '—'}`;
      case 'PERCENTAGE': return `${h.percentValue}% of ${h.percentOf}`;
      default: return '—';
    }
  };

  // The endpoint returns every head in one array, so paginate client-side.
  // Clamp the page so deleting the last row on the last page can't strand us on an empty view.
  const safePage = Math.min(page, Math.max(0, Math.ceil(heads.length / pageSize) - 1));
  const pagedHeads = heads.slice(safePage * pageSize, safePage * pageSize + pageSize);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Charge Heads</h1>
          <p className="text-sm text-slate-500 mt-0.5">Define the maintenance charges that make up each invoice</p>
        </div>
        <Button onClick={openCreate} variant="contained" startIcon={<Plus className="w-4 h-4" />} sx={{ whiteSpace: 'nowrap' }}>Add Charge Head</Button>
      </div>

      <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white"><CircularProgress size={32} thickness={4} /></div>
        ) : heads.length === 0 ? (
          <div className="text-center py-20 text-slate-400 font-semibold text-sm bg-white">No charge heads yet. Click "Add Charge Head" to create one.</div>
        ) : (
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 70 }}>Order</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Pricing</TableCell>
                <TableCell>Applies to</TableCell>
                <TableCell>GST</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody className="bg-white">
              {pagedHeads.map((h) => (
                <TableRow key={h._id}>
                  <TableCell className="font-semibold text-slate-500">{h.sortOrder ?? 100}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-slate-700">{h.code}</TableCell>
                  <TableCell className="font-bold text-slate-800">{h.name}</TableCell>
                  <TableCell><Chip size="small" label={h.category.replace(/_/g, ' ')} className="bg-slate-100 text-slate-600 font-semibold" /></TableCell>
                  <TableCell className="text-slate-600 font-semibold">{priceLabel(h)}</TableCell>
                  <TableCell className="text-slate-500 text-xs font-semibold">{(h.applicability?.occupancy || ['ALL']).join(', ').replace(/_/g, ' ')}</TableCell>
                  <TableCell>{h.gstApplicable ? <span className="text-emerald-600 font-bold text-xs">{h.gstRatePercent}%</span> : <span className="text-slate-400 text-xs">—</span>}</TableCell>
                  <TableCell><span className={`text-xs font-bold ${h.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>{h.isActive ? 'Active' : 'Inactive'}</span></TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton onClick={() => openEdit(h)} size="small" className="bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-xl p-2"><Pencil className="w-4 h-4" /></IconButton>
                      <IconButton onClick={() => remove(h)} size="small" className="bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-500 rounded-xl p-2"><Trash2 className="w-4 h-4" /></IconButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <TablePagination
          component="div" count={heads.length} page={safePage}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={e => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} slots={{ transition: Zoom }} maxWidth="sm" fullWidth scroll="paper">
        <DialogTitle className="flex justify-between items-center pr-3">
          <span className="flex items-center gap-2"><Tag className="w-5 h-5 text-blue-600" />{editId ? 'Edit Charge Head' : 'New Charge Head'}</span>
          <IconButton onClick={() => setModalOpen(false)} size="small"><X className="w-5 h-5" /></IconButton>
        </DialogTitle>
        <form onSubmit={submit}>
          <DialogContent className="space-y-4">
            <Grid container spacing={2}>
              <Grid size={{ xs: 4 }}>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Code *</span>
                <TextField hiddenLabel required fullWidth size="small" placeholder="MAINT" value={form.code} disabled={!!editId} onChange={e => set({ code: e.target.value.toUpperCase() })} />
              </Grid>
              <Grid size={{ xs: 8 }}>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Name *</span>
                <TextField hiddenLabel required fullWidth size="small" placeholder="Monthly Maintenance" value={form.name} onChange={e => set({ name: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Category</span>
                <FormControl fullWidth size="small"><Select value={form.category} onChange={e => set({ category: e.target.value })}>{CATEGORIES.map(c => <MenuItem key={c} value={c}>{c.replace(/_/g, ' ')}</MenuItem>)}</Select></FormControl>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Pricing Mode</span>
                <FormControl fullWidth size="small"><Select value={form.pricingMode} onChange={e => set({ pricingMode: e.target.value })}>{PRICING_MODES.map(m => <MenuItem key={m.v} value={m.v}>{m.l}</MenuItem>)}</Select></FormControl>
              </Grid>

              {(form.pricingMode === 'UNIFORM' || form.pricingMode === 'FLAT_ADHOC') && (
                <Grid size={{ xs: 6 }}>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Amount (₹)</span>
                  <TextField hiddenLabel fullWidth size="small" type="number" value={form.uniformAmount} onChange={e => set({ uniformAmount: e.target.value })} />
                </Grid>
              )}
              {form.pricingMode === 'PER_SQFT' && (
                <>
                  <Grid size={{ xs: 6 }}>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Rate per sq.ft. (₹)</span>
                    <TextField hiddenLabel fullWidth size="small" type="number" value={form.ratePerSqft} onChange={e => set({ ratePerSqft: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Area basis</span>
                    <FormControl fullWidth size="small"><Select value={form.areaBasis} onChange={e => set({ areaBasis: e.target.value })}><MenuItem value="CARPET">Carpet area</MenuItem><MenuItem value="BUILTUP">Built-up area</MenuItem></Select></FormControl>
                  </Grid>
                </>
              )}
              {form.pricingMode === 'METERED' && (
                <>
                  <Grid size={{ xs: 6 }}>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Rate per unit (₹)</span>
                    <TextField hiddenLabel fullWidth size="small" type="number" value={form.perUnitRate} onChange={e => set({ perUnitRate: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Meter type</span>
                    <TextField hiddenLabel fullWidth size="small" placeholder="Water / Electricity" value={form.meterType} onChange={e => set({ meterType: e.target.value })} />
                  </Grid>
                </>
              )}
              {form.pricingMode === 'PER_QUANTITY' && (
                <>
                  <Grid size={{ xs: 6 }}>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Rate for each one (₹)</span>
                    <TextField hiddenLabel fullWidth size="small" type="number" placeholder="500" value={form.perUnitRate} onChange={e => set({ perUnitRate: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">What is being counted</span>
                    <TextField
                      hiddenLabel fullWidth size="small" placeholder="parkingSlots"
                      value={form.quantityKey}
                      onChange={e => set({ quantityKey: e.target.value.replace(/[^A-Za-z0-9_]/g, '') })}
                      slotProps={{ htmlInput: { list: 'quantity-key-suggestions' } }}
                    />
                    <datalist id="quantity-key-suggestions">
                      {QUANTITY_KEY_SUGGESTIONS.map(k => <option key={k} value={k} />)}
                    </datalist>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <p className="text-[11px] text-slate-500 -mt-2">
                      Each flat is billed this rate for however many it has. The count lives on the flat itself — set it under
                      Flats → Edit → Billable counts, using this exact key. A flat with no count for
                      <b> {form.quantityKey || 'this key'}</b> is not billed at all.
                      {form.perUnitRate && form.quantityKey && (
                        <> A flat with 2 would be billed <b>₹{rupees(toPaise(form.perUnitRate) * 2)}</b>.</>
                      )}
                    </p>
                  </Grid>
                </>
              )}
              {form.pricingMode === 'PERCENTAGE' && (
                <>
                  <Grid size={{ xs: 6 }}>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Percent of</span>
                    <FormControl fullWidth size="small"><Select value={form.percentOf} onChange={e => set({ percentOf: e.target.value })}><MenuItem value="MAINTENANCE">Maintenance line</MenuItem><MenuItem value="BASE">Running base</MenuItem></Select></FormControl>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Percent value (%)</span>
                    <TextField hiddenLabel fullWidth size="small" type="number" value={form.percentValue} onChange={e => set({ percentValue: e.target.value })} />
                  </Grid>
                </>
              )}
              {form.pricingMode === 'PER_FLAT_SIZE' && (
                <Grid size={{ xs: 12 }} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Amount per flat size (₹)</span>
                    <Button size="small" onClick={addSizeRow} startIcon={<Plus className="w-3 h-3" />}>Add size</Button>
                  </div>
                  {form.perSizeAmounts.map((r, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <FormControl size="small" className="flex-1">
                        <Select displayEmpty value={r.flatSizeId} onChange={e => { const sz = sizes.find(s => s._id === e.target.value); setSizeRow(i, { flatSizeId: e.target.value, label: sz?.name || '' }); }}>
                          <MenuItem value="" disabled>Select size</MenuItem>
                          {sizes.map(s => <MenuItem key={s._id} value={s._id}>{s.name}</MenuItem>)}
                        </Select>
                      </FormControl>
                      <TextField hiddenLabel size="small" type="number" placeholder="₹" value={r.amount} onChange={e => setSizeRow(i, { amount: e.target.value })} className="w-28" />
                    </div>
                  ))}
                </Grid>
              )}

              {form.pricingMode === 'PER_BLOCK' && (
                <Grid size={{ xs: 12 }} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Amount per wing</span>
                    <Button size="small" onClick={addBlockRow} startIcon={<Plus className="w-3 h-3" />}>Add wing</Button>
                  </div>
                  {form.perBlockAmounts.map((r, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <FormControl size="small" className="flex-1">
                        <Select displayEmpty value={r.blockId} onChange={e => { const bk = blocks.find(b => b._id === e.target.value); setBlockRow(i, { blockId: e.target.value, label: bk?.name || '' }); }}>
                          <MenuItem value="" disabled>Select wing</MenuItem>
                          {blocks.map(b => <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>)}
                        </Select>
                      </FormControl>
                      <TextField hiddenLabel size="small" type="number" placeholder="₹" value={r.amount} onChange={e => setBlockRow(i, { amount: e.target.value })} className="w-28" />
                      <IconButton size="small" onClick={() => set({ perBlockAmounts: form.perBlockAmounts.filter((_, idx) => idx !== i) })}>
                        <Trash2 className="w-4 h-4 text-slate-400" />
                      </IconButton>
                    </div>
                  ))}
                  {form.perBlockAmounts.length > 0 && (
                    <p className="text-[11px] text-slate-500">
                      Total if every wing is billed once: ₹{rupees(form.perBlockAmounts.reduce((s, r) => s + toPaise(r.amount), 0))} per round.
                      A wing left out of this list is not billed — the invoice preview will name those flats.
                    </p>
                  )}
                </Grid>
              )}

              <Grid size={{ xs: 6 }}>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Applies to</span>
                <FormControl fullWidth size="small">
                  <Select
                    multiple
                    value={form.occupancy}
                    onChange={e => {
                      const v = (typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value) as string[];
                      // "All flats" is exclusive — pairing it with a specific occupancy is meaningless.
                      set({ occupancy: v.includes('ALL') && v.length > 1 ? v.filter(o => o !== 'ALL') : v.length ? v : ['ALL'] });
                    }}
                    renderValue={(v) => (v as string[]).map(o => o.replace(/_/g, ' ')).join(', ')}
                  >
                    {OCCUPANCY.map(o => <MenuItem key={o} value={o}>{o === 'ALL' ? 'All flats' : o.replace(/_/g, ' ')}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Bill to</span>
                <FormControl fullWidth size="small"><Select value={form.billTo} onChange={e => set({ billTo: e.target.value })}><MenuItem value="OWNER">Owner</MenuItem><MenuItem value="OCCUPANT">Occupant</MenuItem></Select></FormControl>
              </Grid>

              {/* Wing scoping. This had no input at all, so every save through
                  this form silently wiped whatever an API caller had set. */}
              {blocks.length > 1 && (
                <Grid size={{ xs: 12 }}>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Limit to wings</span>
                  <FormControl fullWidth size="small">
                    <Select
                      multiple displayEmpty
                      value={form.blockIds}
                      onChange={e => set({ blockIds: (typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value) as string[] })}
                      renderValue={(v) => (v as string[]).length
                        ? blocks.filter(b => (v as string[]).includes(b._id)).map(b => b.name).join(', ')
                        : 'Every wing'}
                    >
                      {blocks.map(b => <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Leave empty to bill every wing. This decides <b>who</b> is billed — to charge wings
                    different <b>amounts</b>, use the &ldquo;Per wing / block&rdquo; pricing mode above.
                  </p>
                </Grid>
              )}

              <Grid size={{ xs: 12 }}>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Collects into fund</span>
                <FormControl fullWidth size="small">
                  <Select value={form.fundId} onChange={e => set({ fundId: e.target.value })} displayEmpty>
                    <MenuItem value="">Not a fund — treat as regular income</MenuItem>
                    {funds.map(f => <MenuItem key={f._id} value={f._id}>{f.name}{f.ledgerAccountCode ? ` · ${f.ledgerAccountCode}` : ''}</MenuItem>)}
                  </Select>
                </FormControl>
                <p className="text-[11px] text-slate-500 mt-1">
                  {form.fundId
                    ? 'Money billed under this head goes into the fund’s balance instead of income — this is how a fund gets collected.'
                    : 'Pick a fund to make this head collect into it. Leave blank for ordinary income.'}
                </p>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <FormControlLabel control={<Switch checked={form.gstApplicable} onChange={e => set({ gstApplicable: e.target.checked })} />} label={<span className="text-sm font-semibold">GST applicable</span>} />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <FormControlLabel
                  control={<Switch checked={form.countsTowardRwaExemption} onChange={e => set({ countsTowardRwaExemption: e.target.checked })} />}
                  label={<span className="text-sm font-semibold">Counts toward the ₹7,500 GST exemption limit</span>} />
                <p className="text-[11px] text-slate-500 -mt-1">
                  {form.countsTowardRwaExemption
                    ? 'This head is part of the member’s monthly contribution when testing the exemption.'
                    : 'Excluded from the test — use this for pure reimbursements like property tax or common-area electricity, which shouldn’t push a member over the limit.'}
                </p>
              </Grid>
              {form.gstApplicable && (
                <>
                  <Grid size={{ xs: 6 }}>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">GST rate (%)</span>
                    <TextField hiddenLabel fullWidth size="small" type="number" value={form.gstRatePercent} onChange={e => set({ gstRatePercent: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">SAC code</span>
                    <TextField hiddenLabel fullWidth size="small" placeholder="9995" value={form.sacCode} onChange={e => set({ sacCode: e.target.value })} />
                  </Grid>
                </>
              )}

              <Grid size={{ xs: 4 }}>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Sort order</span>
                <TextField hiddenLabel fullWidth size="small" type="number" value={form.sortOrder} onChange={e => set({ sortOrder: e.target.value })} />
              </Grid>
              <Grid size={{ xs: 8 }} className="flex items-end gap-3">
                <FormControlLabel control={<Switch checked={form.isRecurring} onChange={e => set({ isRecurring: e.target.checked })} />} label={<span className="text-sm font-semibold">Recurring</span>} />
                <FormControlLabel control={<Switch checked={form.isActive} onChange={e => set({ isActive: e.target.checked })} />} label={<span className="text-sm font-semibold">Active</span>} />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions className="p-5 pt-0 gap-2">
            <Button onClick={() => setModalOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
            <Button type="submit" disabled={saving} variant="contained" fullWidth className="py-2.5 font-bold">{saving ? <CircularProgress size={20} color="inherit" /> : editId ? 'Save Changes' : 'Create'}</Button>
          </DialogActions>
        </form>
      </Dialog>
    </div>
  );
}
