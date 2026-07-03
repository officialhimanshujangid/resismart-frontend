'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import {
  Button, CircularProgress, Paper, Grid, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, Select, MenuItem, IconButton, Chip,
  TableContainer, Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import {
  ArrowLeft, MapPin, CheckCircle2, XCircle, CreditCard, X, Download, Calendar, UserCheck, Globe, Phone, Mail, Store
} from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { useAuth } from '@/context/AuthContext';
import ModuleScope from '@/components/common/ModuleScope';
import ShopsMap from '@/components/shops/ShopsMap';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};
const TENURES = [
  { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' },
  { value: 'halfYearly', label: 'Half-Yearly' }, { value: 'yearly', label: 'Yearly' },
];

export default function ShopDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast, confirm } = useToastConfirm();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState(Number(searchParams.get('tab') || '0'));
  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [planStatus, setPlanStatus] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [cashOpen, setCashOpen] = useState(false);
  const [cashForm, setCashForm] = useState({ planId: '', tenure: 'yearly', note: '', collectedBy: '__me__', paymentMethod: 'cash' });
  const [busy, setBusy] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [onlinePending, setOnlinePending] = useState<{ invoiceId: string; url: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [detail, inv] = await Promise.all([
        api.get(`/shops/${id}`),
        api.get(`/billing/invoices?isPagination=true&pageSize=20&tenantType=SHOP&tenantId=${id}`).then((r) => r.data.invoices || []).catch(() => []),
      ]);
      setShop(detail.data.shop);
      setSubscription(detail.data.subscription);
      setUpcoming(detail.data.upcoming || []);
      setPlanStatus(detail.data.planStatus || null);
      setInvoices(inv);
    } catch {
      showToast('Failed to load shop', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/plans/public?module=shop').then((r) => setPlans(r.data.plans || [])).catch(() => {}); }, []);
  useEffect(() => {
    api.get('/system-employees?isPagination=false')
      .then((r) => setMembers((r.data.employees || []).filter((e: any) => e.userId).map((e: any) => ({ id: e.userId._id, name: e.userId.name }))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (searchParams.get('action') === 'cash' && plans.length > 0) {
      setCashOpen(true);
      setOnlinePending(null);
      setCashForm({ planId: plans[0]?._id || '', tenure: 'yearly', note: '', collectedBy: '__me__', paymentMethod: 'cash' });
    }
  }, [searchParams, plans]);

  // Live prorated preview when picking a plan for an active shop.
  useEffect(() => {
    if (!cashOpen || !cashForm.planId) { setPreview(null); return; }
    let cancelled = false;
    setPreviewLoading(true);
    api.post('/billing/upgrade-preview', { tenantType: 'SHOP', tenantId: id, planId: cashForm.planId, tenure: cashForm.tenure })
      .then((r) => { if (!cancelled) setPreview(r.data.preview); })
      .catch(() => { if (!cancelled) setPreview(null); })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [cashOpen, cashForm.planId, cashForm.tenure, id]);

  const downloadInvoice = async (invId: string) => {
    try {
      const res = await api.get(`/billing/invoices/${invId}/download`);
      if (res.data?.url) window.open(res.data.url, '_blank', 'noopener');
      else showToast('No document available', 'error');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Could not open invoice', 'error');
    }
  };

  const fmt = (s?: string) => (s ? new Date(s).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—');
  const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
  const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

  const approve = async () => {
    const ok = await confirm({ title: 'Approve Shop', message: `Approve "${shop.name}"? This provisions the admin and starts the free trial.`, confirmText: 'Approve', cancelText: 'Cancel', severity: 'info' });
    if (!ok) return;
    setBusy(true);
    try { await api.post(`/shops/${id}/approve`); showToast('Shop approved', 'success'); load(); }
    catch (e: any) { showToast(e.response?.data?.error || 'Failed to approve', 'error'); }
    finally { setBusy(false); }
  };

  const submitReject = async () => {
    setBusy(true);
    try { await api.post(`/shops/${id}/reject`, { reason: rejectReason }); showToast('Shop rejected', 'success'); setRejectOpen(false); setRejectReason(''); load(); }
    catch (e: any) { showToast(e.response?.data?.error || e.response?.data?.message || 'Failed to reject', 'error'); }
    finally { setBusy(false); }
  };

  const submitCash = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: any = { tenantType: 'SHOP', tenantId: id, planId: cashForm.planId, tenure: cashForm.tenure, paymentMethod: cashForm.paymentMethod, note: cashForm.note || undefined };
      if (cashForm.paymentMethod === 'cash') {
        if (cashForm.collectedBy === '__me__') payload.collectedByName = user?.name;
        else if (cashForm.collectedBy) {
          payload.collectedById = cashForm.collectedBy;
          payload.collectedByName = members.find((m) => m.id === cashForm.collectedBy)?.name;
        }
      }
      const res = await api.post('/billing/assign-cash', payload);
      if (res.data?.method === 'online') {
        setOnlinePending({ invoiceId: res.data.invoiceId, url: res.data.paymentLinkUrl });
        showToast(res.data.message || 'Payment link sent', 'success');
      } else {
        showToast(res.data?.message || 'Plan assigned & invoice generated', 'success');
        setCashOpen(false);
        load();
      }
    } catch (e2: any) { showToast(e2.response?.data?.message || 'Failed to assign plan', 'error'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!onlinePending) return;
    let stop = false;
    let tries = 0;
    const tick = async () => {
      if (stop) return;
      tries += 1;
      try {
        const res = await api.get(`/billing/invoices/${onlinePending.invoiceId}/status`);
        if (res.data?.status === 'PAID') {
          showToast('Payment received — plan activated automatically.', 'success');
          setOnlinePending(null);
          setCashOpen(false);
          load();
          return;
        }
      } catch { /* keep polling */ }
      if (tries < 80) setTimeout(tick, 4000); // ~5 min
    };
    const t = setTimeout(tick, 4000);
    return () => { stop = true; clearTimeout(t); };
  }, [onlinePending, showToast, load]);

  if (loading) return <div className="flex items-center justify-center py-32"><CircularProgress size={34} thickness={4} /></div>;
  if (!shop) return <div className="text-center py-32 text-slate-400">Shop not found.</div>;

  const coords = shop.location?.coordinates;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-[#0a5bd7]"><ArrowLeft className="w-3.5 h-3.5" /> Back to shops</button>

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-blue-50/70" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0a5bd7] to-[#2691f5] text-white flex items-center justify-center text-xl font-black shadow-md shadow-blue-500/20">
              {(shop.name || '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight truncate">{shop.name}</h1>
                <span className={`text-[10px] uppercase px-2.5 py-1 rounded-full font-black border ${STATUS_STYLES[shop.status]}`}>{shop.status}</span>
                <ModuleScope scope="shop" />
              </div>
              <p className="text-sm text-slate-500 mt-0.5 truncate">{shop.address}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {shop.status === 'PENDING' && (
              <>
                <Button onClick={approve} disabled={busy} variant="contained" color="success" startIcon={<CheckCircle2 className="w-4 h-4" />}>Approve</Button>
                <Button onClick={() => { setRejectOpen(true); setRejectReason(''); }} disabled={busy} variant="outlined" color="error" startIcon={<XCircle className="w-4 h-4" />}>Reject</Button>
              </>
            )}
            {shop.status === 'ACTIVE' && (
              <Button onClick={() => { setCashOpen(true); setOnlinePending(null); setCashForm({ planId: plans[0]?._id || '', tenure: 'yearly', note: '', collectedBy: '__me__', paymentMethod: 'cash' }); }} variant="contained" startIcon={<CreditCard className="w-4 h-4" />}>Upgrade / Assign Plan</Button>
            )}
          </div>
        </div>
      </div>

      {shop.rejectionReason && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl p-3">Rejection reason: {shop.rejectionReason}</div>
      )}

      <div className="border-b border-slate-200 mb-6 mt-4">
        <div className="flex gap-6 overflow-x-auto no-scrollbar">
          {['Overview', 'Subscription', 'Invoices', 'Location'].map((tab, idx) => (
            <button key={tab} onClick={() => setActiveTab(idx)}
              className={`pb-3 text-sm font-bold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === idx ? 'border-[#0a5bd7] text-[#0a5bd7]' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper elevation={0} className="p-6 rounded-2xl border border-slate-200/60 space-y-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-500">Shop Information</h2>
              <Grid container spacing={2}>
                <Detail label="City" value={shop.city} />
                <Detail label="State" value={shop.state} />
                <Detail label="Pincode" value={shop.pincode} />
                <Detail label="GST Number" value={shop.gstNumber} />
                <Detail label="Store Type" value={shop.storeType} />
                <Detail label="Service Type" value={shop.typeService} />
                <Detail label="Sales & Product" value={shop.salesAndProduct} />
              </Grid>

              <div className="pt-3 border-t border-slate-100">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 mb-2">Admin Contact</h2>
                <div className="space-y-1.5 text-sm">
                  <p className="flex items-center gap-2 text-slate-700"><Mail className="w-4 h-4 text-slate-400" /> {shop.adminEmail || '—'}</p>
                  <p className="flex items-center gap-2 text-slate-700"><Phone className="w-4 h-4 text-slate-400" /> {shop.contactNumber || '—'}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Audit Trail</h2>
                <AuditRow label="Created by" value={shop.createdByName} sub={fmt(shop.createdAt)} />
                <AuditRow label="Updated by" value={shop.updatedByName} sub={fmt(shop.updatedAt)} />
              </div>
            </Paper>
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={0} className="p-6 rounded-2xl border border-slate-200/60 h-full">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 mb-3">Current Plan</h2>
              {subscription ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-slate-500">Plan</span><span className="font-bold text-slate-800">{planStatus?.planName || subscription.planId?.name || 'Free'}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Status</span>
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-black border ${
                      planStatus?.isFreeTier ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : planStatus?.status === 'past_due' ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      {planStatus?.isFreeTier ? 'Free Tier' : planStatus?.status === 'past_due' ? 'Grace Period' : (planStatus?.status || subscription.status)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Tenure</span><span className="font-semibold capitalize text-slate-700">{subscription.tenure}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-500">Started</span><span className="font-semibold text-slate-700">{fmtDate(subscription.startDate)}</span></div>
                  {planStatus?.isFreeTier ? (
                    <div className="flex items-center justify-between"><span className="text-slate-500">Expiry</span><span className="font-semibold text-slate-700">No expiry</span></div>
                  ) : (
                    <div className="flex items-center justify-between"><span className="text-slate-500">Ends / Renews</span><span className="font-semibold text-slate-700">{fmtDate(subscription.endDate)}</span></div>
                  )}
                  {planStatus?.status === 'past_due' && planStatus?.graceEndsAt && (
                    <p className="text-[11px] text-amber-600 pt-1">In grace period — full access until {fmtDate(planStatus.graceEndsAt)}, then drops to Free tier if unpaid.</p>
                  )}
                </div>
              ) : <p className="text-sm text-slate-400">No subscription yet.</p>}
            </Paper>
          </Grid>
          
          <Grid size={{ xs: 12, md: 6 }}>
            <div className="space-y-4">
              {upcoming.length > 0 && (
                <Paper elevation={0} className="p-6 rounded-2xl border border-blue-100 bg-blue-50/30">
                  <h2 className="text-sm font-black uppercase tracking-wider text-[#0a5bd7] mb-3">Upcoming Plans</h2>
                  <div className="space-y-3">
                    {upcoming.map((u) => (
                      <div key={u._id} className="flex items-center justify-between text-sm border-b border-blue-100/60 last:border-0 pb-2 last:pb-0">
                        <div>
                          <div className="font-bold text-slate-800">{u.planId?.name || 'Plan'} <span className="text-slate-400 font-normal capitalize">· {u.tenure}</span></div>
                          <div className="text-[11px] text-slate-500">Starts {fmtDate(u.startDate)} → ends {fmtDate(u.endDate)}</div>
                        </div>
                        <span className="text-[10px] uppercase px-2 py-0.5 rounded-full font-black border bg-blue-50 text-blue-700 border-blue-200">Scheduled</span>
                      </div>
                    ))}
                  </div>
                </Paper>
              )}

              {subscription?.history?.length > 0 && (
                <Paper elevation={0} className="p-6 rounded-2xl border border-slate-200/60">
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-500 mb-4">Activity Timeline</h2>
                  <ol className="relative border-l border-slate-200 ml-2 space-y-5">
                    {[...subscription.history].reverse().map((h: any, i: number) => (
                      <li key={i} className="ml-5">
                        <span className="absolute -left-[7px] w-3.5 h-3.5 rounded-full bg-[#0a5bd7] border-2 border-white" />
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <span className="text-sm font-black text-slate-800 capitalize">{String(h.action).replace(/_/g, ' ')}</span>
                          <span className="text-[11px] font-mono text-slate-400">{fmt(h.date)}</span>
                        </div>
                        {h.note && <p className="text-xs text-slate-500 mt-0.5">{h.note}</p>}
                        {h.performedBy && <p className="text-[10px] text-slate-400 mt-0.5">by {h.performedBy}</p>}
                      </li>
                    ))}
                  </ol>
                </Paper>
              )}
            </div>
          </Grid>
        </Grid>
      )}

      {activeTab === 2 && (
        <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
          {invoices.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-semibold text-sm bg-white">No invoices for this shop.</div>
          ) : (
            <Table sx={{ minWidth: 640 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice #</TableCell><TableCell>Plan</TableCell><TableCell>Type</TableCell>
                  <TableCell>Collected By</TableCell><TableCell>Amount</TableCell><TableCell>Status</TableCell><TableCell>Date</TableCell><TableCell align="right">PDF</TableCell>
                </TableRow>
              </TableHead>
              <TableBody className="bg-white">
                {invoices.map((inv) => {
                  const url = inv.customPdfUrl || inv.razorpayInvoiceUrl;
                  return (
                    <TableRow key={inv._id}>
                      <TableCell className="font-mono text-xs text-slate-600">{inv.customInvoiceNumber || inv._id.slice(-8).toUpperCase()}</TableCell>
                      <TableCell className="text-slate-600">{inv.planId?.name || '—'}</TableCell>
                      <TableCell><Chip size="small" label={inv.invoiceType === 'OFFLINE_CASH' ? 'Cash' : 'Online'} /></TableCell>
                      <TableCell className="text-slate-600 text-sm">{inv.collectedByName || (inv.invoiceType === 'OFFLINE_CASH' ? '—' : 'Online')}</TableCell>
                      <TableCell className="font-bold text-slate-800">{inr(inv.amount / 100)}{inv.creditApplied > 0 && <span className="block text-[10px] font-normal text-emerald-600">+₹{(inv.creditApplied / 100).toLocaleString('en-IN')} credit</span>}</TableCell>
                      <TableCell><span className={`text-[10px] uppercase font-black ${inv.status === 'PAID' ? 'text-emerald-600' : 'text-amber-600'}`}>{inv.status}</span></TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{fmtDate(inv.paidAt || inv.createdAt)}</TableCell>
                      <TableCell align="right">{url ? <button onClick={() => downloadInvoice(inv._id)} className="inline-flex items-center gap-1 text-[#0a5bd7] font-bold text-xs hover:underline"><Download className="w-3.5 h-3.5" /> PDF</button> : <span className="text-xs text-slate-400">—</span>}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      )}

      {activeTab === 3 && (
        <Paper elevation={0} className="p-4 rounded-2xl border border-slate-200/60">
          {coords?.length === 2 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="inline-flex items-center gap-1.5 text-sm text-slate-600 font-mono"><MapPin className="w-4 h-4 text-blue-500" /> {coords[1].toFixed(5)}, {coords[0].toFixed(5)}</p>
                <a href={`https://www.google.com/maps/search/?api=1&query=${coords[1]},${coords[0]}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[#0a5bd7] hover:underline bg-blue-50 px-3 py-1.5 rounded-full">Open in Maps &rarr;</a>
              </div>
              <ShopsMap shops={[shop]} height={450} />
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400 font-semibold text-sm">No valid location coordinates found for this shop.</div>
          )}
        </Paper>
      )}

      {/* Reject dialog */}
      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Reject Shop</DialogTitle>
        <DialogContent>
          <p className="text-sm text-slate-500 mb-3">Provide a reason for rejecting <strong>{shop?.name}</strong>.</p>
          <TextField label="Reason" required fullWidth multiline rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        </DialogContent>
        <DialogActions className="p-5 pt-0 gap-2">
          <Button onClick={() => setRejectOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
          <Button onClick={submitReject} disabled={busy || rejectReason.trim().length < 3} variant="contained" color="error" fullWidth className="py-2.5 font-bold">Reject</Button>
        </DialogActions>
      </Dialog>

      {/* Assign cash dialog */}
      <Dialog open={cashOpen} onClose={() => setCashOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle className="flex justify-between items-center pr-3"><span>Upgrade / Assign Plan (Cash)</span><IconButton onClick={() => setCashOpen(false)} size="small"><X className="w-5 h-5" /></IconButton></DialogTitle>
        {onlinePending ? (
          <>
            <DialogContent className="space-y-4 text-center py-8">
              <CircularProgress size={36} thickness={4} />
              <h3 className="font-extrabold text-slate-800">Waiting for payment…</h3>
              <p className="text-sm text-slate-500">A payment link was emailed to the shop. The plan will activate automatically the moment they pay.</p>
              <div className="flex items-center justify-center gap-2">
                <Button variant="contained" onClick={() => window.open(onlinePending.url, '_blank', 'noopener')}>Open payment link</Button>
                <Button variant="outlined" onClick={() => { navigator.clipboard?.writeText(onlinePending.url); showToast('Link copied', 'success'); }}>Copy link</Button>
              </div>
            </DialogContent>
            <DialogActions className="p-5 pt-0">
              <Button onClick={() => { setOnlinePending(null); setCashOpen(false); load(); }} variant="text" fullWidth>Close (keeps waiting in background)</Button>
            </DialogActions>
          </>
        ) : (
        <form onSubmit={submitCash}>
          <DialogContent className="space-y-3">
            <p className="text-xs text-slate-500 bg-blue-50/60 border border-blue-100 rounded-lg p-2.5">Choosing the same plan <strong>extends</strong> it; a different plan <strong>upgrades</strong> it with prorated credit for the unused time. A PDF invoice is generated either way.</p>

            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Payment method</span>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setCashForm((f) => ({ ...f, paymentMethod: 'cash' }))}
                  className={`py-2 rounded-xl border text-sm font-bold ${cashForm.paymentMethod === 'cash' ? 'border-[#0a5bd7] bg-blue-50 text-[#0a5bd7]' : 'border-slate-200 text-slate-600'}`}>Cash / Offline</button>
                <button type="button" onClick={() => setCashForm((f) => ({ ...f, paymentMethod: 'online' }))}
                  className={`py-2 rounded-xl border text-sm font-bold ${cashForm.paymentMethod === 'online' ? 'border-[#0a5bd7] bg-blue-50 text-[#0a5bd7]' : 'border-slate-200 text-slate-600'}`}>Online (send link)</button>
              </div>
            </div>

            <FormControl fullWidth>
              <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Plan</span>
              <Select value={cashForm.planId} onChange={(e) => {
                const newPlanId = e.target.value as string;
                const p = plans.find(x => x._id === newPlanId);
                const activeTenures = p?.computedPricing?.map((c: any) => c.tenure) || [];
                let newTenure = cashForm.tenure;
                if (activeTenures.length > 0 && !activeTenures.includes(newTenure)) {
                  newTenure = activeTenures[0];
                }
                setCashForm((f) => ({ ...f, planId: newPlanId, tenure: newTenure }));
              }} required>
                {plans.map((p) => <MenuItem key={p._id} value={p._id}>{p.name} — ₹{p.basePrice.toLocaleString('en-IN')}/mo</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Tenure</span>
              <Select value={cashForm.tenure} onChange={(e) => setCashForm((f) => ({ ...f, tenure: e.target.value as string }))}>
                {TENURES.filter(t => {
                  const p = plans.find(x => x._id === cashForm.planId);
                  const active = p?.computedPricing?.map((c: any) => c.tenure) || [];
                  return active.length === 0 || active.includes(t.value);
                }).map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
              </Select>
            </FormControl>

            {/* Prorated preview */}
            {previewLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-2"><CircularProgress size={14} /> Calculating…</div>
            ) : preview && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Action</span><span className="font-bold capitalize text-slate-800">{preview.mode}</span></div>
                {preview.currentPlanName && <div className="flex justify-between"><span className="text-slate-500">Current plan</span><span className="font-semibold text-slate-700">{preview.currentPlanName}</span></div>}
                <div className="flex justify-between"><span className="text-slate-500">New plan price</span><span className="font-semibold text-slate-700">₹{(preview.newPricePaise / 100).toLocaleString('en-IN')}</span></div>
                {preview.creditPaise > 0 && <div className="flex justify-between text-emerald-600"><span>Credit for {preview.remainingDays}d left</span><span className="font-semibold">- ₹{(preview.creditPaise / 100).toLocaleString('en-IN')}</span></div>}
                <div className="flex justify-between border-t border-slate-200 pt-1 mt-1"><span className="font-bold text-slate-700">Amount to collect</span><span className="font-black text-[#0a5bd7]">₹{(preview.amountDuePaise / 100).toLocaleString('en-IN')}</span></div>
                {preview.bonusDays > 0 && <div className="text-[11px] text-emerald-600">+ {preview.bonusDays} bonus days from leftover credit</div>}
                <div className="text-[11px] text-slate-400">New end date: {fmtDate(preview.newEndDate)}</div>
              </div>
            )}

            {cashForm.paymentMethod === 'cash' ? (
              <FormControl fullWidth>
                <span className="text-[10px] font-bold text-slate-500 uppercase mb-1">Cash collected by</span>
                <Select value={cashForm.collectedBy} onChange={(e) => setCashForm((f) => ({ ...f, collectedBy: e.target.value as string }))}>
                  <MenuItem value="__me__">Me — {user?.name || 'Current user'}</MenuItem>
                  {members.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
                </Select>
              </FormControl>
            ) : (
              <p className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded-lg p-2.5">A secure Razorpay payment link will be emailed to the shop. The plan activates automatically once they pay — this window will update.</p>
            )}
            <TextField label="Note (optional)" fullWidth value={cashForm.note} onChange={(e) => setCashForm((f) => ({ ...f, note: e.target.value }))} />
            <p className="text-[11px] text-slate-400">Entry recorded by <strong>{user?.name || 'you'}</strong> on submission.</p>
          </DialogContent>
          <DialogActions className="p-5 pt-0 gap-2">
            <Button onClick={() => setCashOpen(false)} variant="outlined" fullWidth className="py-2.5 font-bold">Cancel</Button>
            <Button type="submit" disabled={busy || !cashForm.planId} variant="contained" fullWidth className="py-2.5 font-bold">{busy ? <CircularProgress size={20} color="inherit" /> : (cashForm.paymentMethod === 'online' ? 'Send Payment Link' : 'Collect Cash & Invoice')}</Button>
          </DialogActions>
        </form>
        )}
      </Dialog>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <Grid size={{ xs: 6, sm: 4 }}>
      <div className="text-[10px] font-bold uppercase text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-800">{value || '—'}</div>
    </Grid>
  );
}

function AuditRow({ label, value, sub }: { label: string; value?: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-bold text-slate-500">{label} <span className="font-semibold text-slate-800">{value || '—'}</span></span>
      <span className="font-mono text-slate-400">{sub}</span>
    </div>
  );
}
