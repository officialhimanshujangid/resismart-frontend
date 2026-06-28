'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Button, CircularProgress, Paper, Grid, Select, MenuItem, FormControl,
  TableContainer, Table, TableHead, TableBody, TableRow, TableCell, TablePagination, Chip,
} from '@mui/material';
import { useAuth } from '@/context/AuthContext';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { CheckCircle2, Crown, Download, Sparkles, Clock, ShieldCheck } from 'lucide-react';

interface Plan {
  _id: string; name: string; description?: string; basePrice: number; isFeatured: boolean;
  capabilities: Record<string, number>;
  computedPricing?: { tenure: string; label: string; totalPrice: number; perMonthEquivalent: number; savedAmount: number; discountPercent: number }[];
}
interface Subscription { _id: string; status: string; tenure: string; startDate: string; endDate: string; planId?: any; razorpaySubscriptionId?: string; }
interface Invoice {
  _id: string; invoiceType: string; amount: number; status: string; createdAt: string; paidAt?: string;
  customInvoiceNumber?: string; customPdfUrl?: string; razorpayInvoiceUrl?: string; planId?: { name: string }; tenure?: string;
}

const CAP_LABELS: Record<string, string> = {
  max_flat_count: 'Flats', max_staff_count: 'Staff', max_member_count: 'Members',
  max_visitor_count: 'Visitors', max_tickets_count: 'Tickets', max_service_count: 'Services',
};

const TENURES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'halfYearly', label: 'Half-Yearly' },
  { value: 'yearly', label: 'Yearly' },
];

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function BillingPage() {
  const { user } = useAuth();
  const { showToast, confirm } = useToastConfirm();
  const [cancelling, setCancelling] = useState(false);

  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [capabilities, setCapabilities] = useState<Record<string, number>>({});
  const [planStatus, setPlanStatus] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tenureByPlan, setTenureByPlan] = useState<Record<string, string>>({});
  const [payingPlan, setPayingPlan] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invTotal, setInvTotal] = useState(0);
  const [invPage, setInvPage] = useState(0);
  const [invPageSize, setInvPageSize] = useState(10);
  const [invLoading, setInvLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await api.get('/billing/my-subscription');
      setSubscription(res.data.subscription);
      setCapabilities(res.data.capabilities || {});
      setPlanStatus(res.data.planStatus || null);
      setUpcoming(res.data.upcoming || []);
    } catch {
      showToast('Failed to load subscription', 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInvoices = useCallback(async () => {
    try {
      setInvLoading(true);
      const res = await api.get(`/billing/invoices?isPagination=true&page=${invPage + 1}&pageSize=${invPageSize}`);
      setInvoices(res.data.invoices || []);
      setInvTotal(res.data.pagination?.total ?? 0);
    } catch {
      // silent
    } finally {
      setInvLoading(false);
    }
  }, [invPage, invPageSize]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([
        fetchSubscription(),
        api.get('/plans/public').then((r) => setPlans(r.data.plans || [])).catch(() => {}),
      ]);
      setLoading(false);
    })();
  }, [fetchSubscription]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const downloadInvoice = async (id: string) => {
    try {
      const res = await api.get(`/billing/invoices/${id}/download`);
      if (res.data?.url) window.open(res.data.url, '_blank', 'noopener');
      else showToast('No document available', 'error');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Could not open invoice', 'error');
    }
  };

  const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
  const cap = (v: number) => (v === -1 ? 'Unlimited' : v);
  const daysLeft = subscription?.endDate ? Math.max(0, Math.ceil((new Date(subscription.endDate).getTime() - Date.now()) / 86400000)) : 0;
  const planName = subscription?.planId?.name || (subscription?.tenure === 'trial' ? 'Free Trial' : '—');
  const formatDate = (s?: string) => (s ? new Date(s).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
  const priceFor = (p: Plan, tenure: string) => p.computedPricing?.find((c) => c.tenure === tenure);

  const handleUpgrade = async (plan: Plan) => {
    const tenure = tenureByPlan[plan._id] || 'yearly';
    setPayingPlan(plan._id);
    try {
      const ok = await loadRazorpay();
      if (!ok) { showToast('Could not load the payment gateway. Check your connection.', 'error'); return; }

      const res = await api.post('/billing/checkout', { planId: plan._id, tenure });
      const { subscriptionId, keyId, invoiceId } = res.data;

      const rzp = new (window as any).Razorpay({
        key: keyId,
        subscription_id: subscriptionId,
        name: 'ResiSmart',
        description: `${plan.name} — ${tenure} (auto-renews)`,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: '#0a5bd7' },
        handler: async (response: any) => {
          try {
            await api.post('/billing/verify-payment', {
              invoiceId,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            showToast('Subscription active — you will be auto-charged each cycle.', 'success');
            await fetchSubscription();
            await fetchInvoices();
          } catch (err: any) {
            showToast(err.response?.data?.message || 'Payment verification failed', 'error');
          }
        },
        modal: { ondismiss: () => setPayingPlan(null) },
      });
      rzp.on('payment.failed', () => showToast('Payment failed. Please try again.', 'error'));
      rzp.open();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Could not start checkout', 'error');
    } finally {
      setPayingPlan(null);
    }
  };

  const handleCancel = async () => {
    const ok = await confirm({
      title: 'Cancel Subscription',
      message: 'Cancel auto-renewal? Your plan stays active until the current period ends, then it will not renew.',
      confirmText: 'Cancel subscription', cancelText: 'Keep it', severity: 'error',
    });
    if (!ok) return;
    setCancelling(true);
    try {
      await api.post('/billing/cancel');
      showToast('Subscription cancelled. Auto-renewal is off.', 'success');
      await fetchSubscription();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to cancel', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const statusColor: Record<string, string> = {
    trialing: 'bg-amber-50 text-amber-700 border-amber-200',
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    past_due: 'bg-red-50 text-red-700 border-red-200',
  };

  if (loading) return <div className="flex items-center justify-center py-32"><CircularProgress size={34} thickness={4} /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Billing & Subscription</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your plan, upgrade online, and download invoices</p>
      </div>

      {/* Free-tier / grace banner */}
      {planStatus?.isFreeTier && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm font-semibold">
          You&apos;re on the <strong>Free tier</strong> with limited capacity. Upgrade to a paid plan below to unlock more flats, staff and features.
        </div>
      )}
      {planStatus?.status === 'past_due' && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold">
          Your plan term has ended — you&apos;re in a <strong>grace period</strong>{planStatus.graceEndsAt ? ` until ${formatDate(planStatus.graceEndsAt)}` : ''}. Renew now to avoid dropping to the Free tier.
        </div>
      )}

      {/* Current subscription */}
      <Paper elevation={0} className="p-6 rounded-2xl border border-slate-200/60">
        <Grid container spacing={3} sx={{ alignItems: 'center' }}>
          <Grid size={{ xs: 12, md: 5 }}>
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-5 h-5 text-[#0a5bd7]" />
              <span className="text-lg font-black text-slate-800">{planStatus?.planName || planName}</span>
              {planStatus && <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-black border ${planStatus.isFreeTier ? 'bg-slate-100 text-slate-600 border-slate-200' : statusColor[planStatus.status] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>{planStatus.isFreeTier ? 'Free Tier' : planStatus.status === 'past_due' ? 'Grace' : planStatus.status}</span>}
            </div>
            <p className="text-sm text-slate-500">{subscription ? `${subscription.tenure} billing` : 'No active subscription'}</p>
            {subscription?.status === 'active' && subscription?.razorpaySubscriptionId && (
              <Button onClick={handleCancel} disabled={cancelling} size="small" color="error" variant="text" className="mt-1 font-bold normal-case px-0">
                {cancelling ? <CircularProgress size={14} color="inherit" /> : 'Cancel auto-renewal'}
              </Button>
            )}
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-1"><Clock className="w-3.5 h-3.5" /> Renews / Ends</div>
            <div className="font-bold text-slate-800">{planStatus?.isFreeTier ? 'No expiry' : formatDate(subscription?.endDate)}</div>
          </Grid>
          <Grid size={{ xs: 6, md: 4 }}>
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-1"><Sparkles className="w-3.5 h-3.5" /> Time Remaining</div>
            <div className="font-bold text-slate-800">{planStatus?.isFreeTier ? '∞' : `${daysLeft} days`}</div>
          </Grid>
        </Grid>

        {/* Plan limits */}
        {Object.keys(capabilities).length > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500 mb-3"><ShieldCheck className="w-3.5 h-3.5" /> Your Plan Limits</div>
            <Grid container spacing={2}>
              {Object.entries(CAP_LABELS).map(([key, label]) => (
                <Grid size={{ xs: 6, sm: 4, md: 2 }} key={key}>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                    <div className="text-lg font-black text-slate-800">{cap(capabilities[key] ?? 0)}</div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">{label}</div>
                  </div>
                </Grid>
              ))}
            </Grid>
          </div>
        )}
      </Paper>

      {/* Upcoming (scheduled) plans */}
      {upcoming.length > 0 && (
        <Paper elevation={0} className="p-5 rounded-2xl border border-blue-100 bg-blue-50/30">
          <div className="text-xs font-black uppercase tracking-wider text-[#0a5bd7] mb-3">Upcoming Plans</div>
          <div className="space-y-2">
            {upcoming.map((u: any) => (
              <div key={u._id} className="flex items-center justify-between text-sm">
                <span className="font-bold text-slate-800">{u.planId?.name || 'Plan'} <span className="font-normal text-slate-400 capitalize">· {u.tenure}</span></span>
                <span className="text-xs text-slate-500">Starts {formatDate(u.startDate)} → {formatDate(u.endDate)}</span>
              </div>
            ))}
          </div>
        </Paper>
      )}

      {/* Upgrade plans */}
      <div>
        <h2 className="text-lg font-black text-slate-800 mb-3">{subscription?.tenure === 'trial' ? 'Upgrade to a paid plan' : 'Change your plan'}</h2>
        <Grid container spacing={3}>
          {plans.map((p) => {
            const tenure = tenureByPlan[p._id] || 'yearly';
            const pricing = priceFor(p, tenure);
            return (
              <Grid size={{ xs: 12, md: 4 }} key={p._id}>
                <div className={`relative h-full flex flex-col rounded-2xl border bg-white transition-all duration-300 hover:-translate-y-1 ${p.isFeatured ? 'border-[#0a5bd7] shadow-lg shadow-blue-500/10 ring-1 ring-[#0a5bd7]/20' : 'border-slate-200/70 hover:shadow-md'}`}>
                  {p.isFeatured && (
                    <div className="absolute -top-px left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-black tracking-wide text-white bg-gradient-to-r from-[#0a5bd7] to-[#2691f5] px-3 py-1 rounded-full shadow">MOST POPULAR</div>
                  )}
                  <div className="p-6 flex flex-col h-full">
                    <span className="text-base font-black text-slate-800">{p.name}</span>
                    <p className="text-xs text-slate-400 mt-1 mb-4 min-h-[32px]">{p.description}</p>
                    <div className="mb-4">
                      <span className="text-4xl font-black text-slate-900 tracking-tight">{pricing ? inr(pricing.totalPrice) : inr(p.basePrice)}</span>
                      <span className="text-xs text-slate-400 font-semibold"> / {TENURES.find((t) => t.value === tenure)?.label.toLowerCase()}</span>
                      {pricing && pricing.perMonthEquivalent > 0 && <div className="text-[11px] text-slate-400 mt-0.5">≈ {inr(pricing.perMonthEquivalent)}/mo</div>}
                      {pricing && pricing.savedAmount > 0 && <div className="inline-block mt-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">Save {inr(pricing.savedAmount)} · {pricing.discountPercent}% off</div>}
                    </div>
                    <FormControl size="small" fullWidth className="mb-4">
                      <Select value={tenure} onChange={(e) => setTenureByPlan((m) => ({ ...m, [p._id]: e.target.value as string }))}>
                        {TENURES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                      </Select>
                    </FormControl>
                    <ul className="text-sm text-slate-600 space-y-2 mb-5 flex-1">
                      {Object.entries(CAP_LABELS).map(([key, label]) => (
                        <li key={key} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> <span className="font-bold text-slate-800">{cap(p.capabilities?.[key] ?? 0)}</span> {label}</li>
                      ))}
                    </ul>
                    <Button variant={p.isFeatured ? 'contained' : 'outlined'} fullWidth disabled={payingPlan === p._id}
                      onClick={() => handleUpgrade(p)} className="font-bold py-2.5">
                      {payingPlan === p._id ? <CircularProgress size={20} color="inherit" /> : 'Subscribe & Pay'}
                    </Button>
                  </div>
                </div>
              </Grid>
            );
          })}
          {plans.length === 0 && <Grid size={{ xs: 12 }}><p className="text-sm text-slate-400">No plans available right now.</p></Grid>}
        </Grid>
      </div>

      {/* Invoice history */}
      <div>
        <h2 className="text-lg font-black text-slate-800 mb-3">Invoice History</h2>
        <TableContainer component={Paper} elevation={1} className="rounded-2xl border border-slate-200/60 shadow-sm overflow-x-auto">
          {invLoading ? (
            <div className="flex items-center justify-center py-16 bg-white"><CircularProgress size={28} thickness={4} /></div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-16 text-slate-400 font-semibold text-sm bg-white">No invoices yet.</div>
          ) : (
            <Table sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="right">Download</TableCell>
                </TableRow>
              </TableHead>
              <TableBody className="bg-white">
                {invoices.map((inv) => {
                  const url = inv.customPdfUrl || inv.razorpayInvoiceUrl;
                  return (
                    <TableRow key={inv._id}>
                      <TableCell className="font-mono text-xs text-slate-600">{inv.customInvoiceNumber || inv._id.slice(-8).toUpperCase()}</TableCell>
                      <TableCell className="font-semibold text-slate-700">{inv.planId?.name || '—'}{inv.tenure ? <span className="text-slate-400"> · {inv.tenure}</span> : ''}</TableCell>
                      <TableCell><Chip size="small" label={inv.invoiceType === 'OFFLINE_CASH' ? 'Cash' : 'Online'} /></TableCell>
                      <TableCell className="font-bold text-slate-800">{inr(inv.amount / 100)}</TableCell>
                      <TableCell>
                        <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-black border ${inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : inv.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{inv.status}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{formatDate(inv.paidAt || inv.createdAt)}</TableCell>
                      <TableCell align="right">
                        {url ? (
                          <button onClick={() => downloadInvoice(inv._id)} className="inline-flex items-center gap-1 text-[#0a5bd7] font-bold text-xs hover:underline"><Download className="w-3.5 h-3.5" /> PDF</button>
                        ) : <span className="text-xs text-slate-400">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          <TablePagination component="div" count={invTotal} page={invPage}
            onPageChange={(_, np) => setInvPage(np)} rowsPerPage={invPageSize}
            onRowsPerPageChange={(e) => { setInvPageSize(parseInt(e.target.value, 10)); setInvPage(0); }}
            rowsPerPageOptions={[5, 10, 25, 50]} sx={{ borderTop: '1px solid #f1f5f9', backgroundColor: '#fff' }} />
        </TableContainer>
      </div>
    </div>
  );
}
