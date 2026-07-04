'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import {
  Button, CircularProgress, Paper, Grid, Select, MenuItem, FormControl,
  TableContainer, Table, TableHead, TableBody, TableRow, TableCell, TablePagination, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { useAuth } from '@/context/AuthContext';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { CheckCircle2, Crown, Download, Sparkles, Clock, ShieldCheck, XCircle } from 'lucide-react';

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
  const { user, activeProfile } = useAuth();
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
  const [nextAmountPaise, setNextAmountPaise] = useState(0);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [selectedPlanToUpgrade, setSelectedPlanToUpgrade] = useState<Plan | null>(null);

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
      setNextAmountPaise(res.data.nextAmountPaise || 0);
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
        api.get(`/plans/public?module=${activeProfile?.role.startsWith('SHOP_') ? 'shop' : 'society'}`).then((r) => setPlans(r.data.plans || [])).catch(() => { }),
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
  // Time remaining includes all prepaid upcoming periods
  const effectiveEndDate = upcoming.length > 0 ? upcoming[upcoming.length - 1].endDate : subscription?.endDate;
  const daysLeft = effectiveEndDate ? Math.max(0, Math.ceil((new Date(effectiveEndDate).getTime() - Date.now()) / 86400000)) : 0;
  const planName = subscription?.planId?.name || (subscription?.tenure === 'trial' ? 'Free Trial' : '—');
  const formatDate = (s?: string) => (s ? new Date(s).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
  const priceFor = (p: Plan, tenure: string) => p.computedPricing?.find((c) => c.tenure === tenure);

  const [checkoutIntent, setCheckoutIntent] = useState<string>('upgrade');

  const handleUpgradeClick = async (plan: Plan, overrideTenure?: string, intent: string = 'upgrade') => {
    const tenure = overrideTenure || tenureByPlan[plan._id] || 'yearly';
    
    let finalIntent = intent;
    const isCurrentPlan = subscription?.planId?._id === plan._id && subscription?.tenure === tenure;
    if (isCurrentPlan && upcoming.length > 0 && finalIntent === 'upgrade') {
      finalIntent = 'setup_autopay';
    }
    
    setPayingPlan(plan._id);
    try {
      const res = await api.post('/billing/upgrade-preview', { planId: plan._id, tenure, intent: finalIntent });
      setPreviewData(res.data.preview);
      setSelectedPlanToUpgrade(plan);
      setCheckoutIntent(finalIntent);
      setPreviewOpen(true);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Could not fetch upgrade details', 'error');
    } finally {
      setPayingPlan(null);
    }
  };

  const confirmUpgrade = async () => {
    if (!selectedPlanToUpgrade) return;
    const plan = selectedPlanToUpgrade;
    const tenure = previewData?.tenure || 'yearly';
    
    setPreviewOpen(false);
    setPayingPlan(plan._id);
    try {
      const ok = await loadRazorpay();
      if (!ok) { showToast('Could not load the payment gateway. Check your connection.', 'error'); return; }

      const res = await api.post('/billing/checkout', { planId: plan._id, tenure, intent: checkoutIntent });
      const { subscriptionId, orderId, keyId, invoiceId } = res.data;

      const rzpOptions: any = {
        key: keyId,
        name: 'Resismart',
        description: checkoutIntent === 'manual_renewal' ? `${plan.name} — ${tenure} (One-Time Renewal)` : checkoutIntent === 'setup_autopay' ? `Auto-Pay Setup (${plan.name})` : `${plan.name} — ${tenure} (auto-renews)`,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: '#0a5bd7' },
        handler: async (response: any) => {
          try {
            await api.post('/billing/verify-payment', {
              invoiceId,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            showToast(checkoutIntent === 'manual_renewal' ? 'Payment successful — plan renewed.' : 'Subscription active — you will be auto-charged each cycle.', 'success');
            await fetchSubscription();
            await fetchInvoices();
          } catch (err: any) {
            showToast(err.response?.data?.message || 'Payment verification failed', 'error');
          }
        },
        modal: { ondismiss: () => setPayingPlan(null) },
      };

      if (subscriptionId) rzpOptions.subscription_id = subscriptionId;
      if (orderId) rzpOptions.order_id = orderId;

      const rzp = new (window as any).Razorpay(rzpOptions);
      rzp.on('payment.failed', () => showToast('Payment failed. Please try again.', 'error'));
      rzp.open();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Could not start checkout', 'error');
    } finally {
      setPayingPlan(null);
    }
  };

  const handleCancelAutopay = async () => {
    const ok = await confirm({
      title: 'Turn Off Auto-Pay',
      message: 'Are you sure you want to cancel your Auto-Pay mandate? Your current plan and any prepaid periods will remain active until they expire, but automatic renewal will stop after that.',
      confirmText: 'Turn Off Auto-Pay',
      cancelText: 'Keep Auto-Pay',
      severity: 'error',
    });
    if (!ok) return;
    setCancelling(true);
    try {
      await api.post('/billing/cancel');
      showToast('Auto-Pay has been turned off. Your plan remains active until it expires.', 'success');
      await fetchSubscription();
      await fetchInvoices();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to cancel Auto-Pay', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const statusColor: Record<string, string> = {
    trialing: 'bg-amber-50 text-amber-700 border-amber-200',
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    past_due: 'bg-red-50 text-red-700 border-red-200',
  };

  // Auto-pay detection: check both active subscription AND any upcoming scheduled plan
  const hasAutoPay = !!subscription?.razorpaySubscriptionId || upcoming.some((u: any) => !!u.razorpaySubscriptionId);
  
  // The date when AUTO-PAY will next charge — this is when the last prepaid period ends
  const autoPayChargeDate = (() => {
    if (!hasAutoPay) return undefined;
    // If there are upcoming scheduled plans with autopay, charge happens after the LAST scheduled one ends
    const upcomingWithAutopay = upcoming.filter((u: any) => !!u.razorpaySubscriptionId);
    if (upcomingWithAutopay.length > 0) return upcomingWithAutopay[upcomingWithAutopay.length - 1].endDate;
    // If autopay is on the active sub, it charges when the active sub ends (or after last upcoming)
    if (upcoming.length > 0) return upcoming[upcoming.length - 1].endDate;
    return subscription?.endDate;
  })();

  // "Next Billing Date" = when is the next payment due?
  // - If autopay is on: it's the autoPayChargeDate
  // - If no autopay but has upcoming prepaid: the last prepaid end date (that's when they need to pay next)
  // - Otherwise: the active subscription end date
  // - Free tier: Never
  const nextBillingDate = planStatus?.isFreeTier 
    ? 'Never' 
    : hasAutoPay 
      ? formatDate(autoPayChargeDate) 
      : upcoming.length > 0 
        ? formatDate(upcoming[upcoming.length - 1].endDate) 
        : formatDate(subscription?.endDate);

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

      {/* Current subscription Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 shadow-xl text-white">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl mix-blend-screen pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-indigo-500/20 blur-3xl mix-blend-screen pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row gap-8 justify-between items-start md:items-center">
          <div className="space-y-4 flex-1">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2.5 rounded-xl border border-white/10 shadow-inner">
                <Crown className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <div className="text-blue-200 text-sm font-bold uppercase tracking-widest mb-0.5">Your Active Plan</div>
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-black tracking-tight">{planStatus?.planName || planName}</h2>
                  {planStatus && (
                    <span className={`text-xs uppercase px-2.5 py-1 rounded-full font-black tracking-wide border shadow-sm ${
                      planStatus.isFreeTier ? 'bg-white/10 text-white border-white/20' :
                      planStatus.status === 'past_due' ? 'bg-red-500/20 text-red-300 border-red-500/30' :
                      'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}>
                      {planStatus.isFreeTier ? 'Free Tier' : planStatus.status === 'past_due' ? 'Grace Period' : 'Active'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <p className="text-slate-300 font-medium">
              {subscription ? `You are on a ${subscription.tenure} billing cycle.` : 'No active subscription found.'}
            </p>
            
            {hasAutoPay && (
              <div className="inline-flex items-center gap-2 mt-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-blue-400 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                </span>
                <span className="text-sm font-bold text-blue-300">Auto-Pay is Active</span>
                <button onClick={handleCancelAutopay} disabled={cancelling} className="ml-4 text-xs font-bold text-slate-400 hover:text-white transition-colors underline decoration-slate-600 hover:decoration-white underline-offset-4">
                  {cancelling ? 'Cancelling...' : 'Turn off auto-renewal'}
                </button>
              </div>
            )}
          </div>
          
          <div className="flex flex-row md:flex-col gap-6 md:gap-4 w-full md:w-auto bg-black/20 p-5 rounded-2xl border border-white/5 backdrop-blur-md">
            <div>
              <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Next Billing Date</div>
              <div className="text-xl font-black text-white">{nextBillingDate}</div>
            </div>
            {subscription && !planStatus?.isFreeTier && (
              <>
                <div className="hidden md:block w-full h-px bg-white/10"></div>
                <div>
                  <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Time Remaining</div>
                  <div className="text-xl font-black text-white">{daysLeft} day{daysLeft !== 1 ? 's' : ''}</div>
                </div>
              </>
            )}
          </div>
        </div>
        {/* Explicit Auto-Pay Message */}
        {subscription && !planStatus?.isFreeTier && (() => {
          if (hasAutoPay) {
            return (
              <div className="mt-6 pt-5 border-t border-slate-700">
                <div className="flex items-start justify-between gap-3 bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-blue-100">Auto-Pay is ON</h4>
                      <p className="text-sm text-blue-200/80 mt-1">{inr(nextAmountPaise / 100)} will be deducted automatically on {formatDate(autoPayChargeDate)}.</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button variant="outlined" size="small" onClick={handleCancelAutopay} disabled={cancelling} sx={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444', '&:hover': { borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)' } }} className="font-bold w-full text-xs">{cancelling ? 'Cancelling...' : 'Turn Off Auto-Pay'}</Button>
                  </div>
                </div>
              </div>
            );
          } else if (upcoming.length > 0) {
            return (
              <div className="mt-6 pt-5 border-t border-slate-700">
                <div className="flex items-start justify-between gap-3 bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-100">Paid in Advance</h4>
                      <p className="text-sm text-emerald-200/80 mt-1">You have upcoming scheduled plans. You are fully paid until {formatDate(upcoming[upcoming.length - 1].endDate)}.</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button variant="outlined" size="small" onClick={() => {
                      const plan = plans.find(p => p._id === subscription.planId?._id);
                      if (plan) handleUpgradeClick(plan, subscription.tenure, 'setup_autopay');
                    }} sx={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34d399', '&:hover': { borderColor: '#34d399', backgroundColor: 'rgba(16, 185, 129, 0.1)' } }} className="font-bold w-full text-xs">Turn On Auto-Pay</Button>
                  </div>
                </div>
              </div>
            );
          } else {
            return (
              <div className="mt-6 pt-5 border-t border-slate-700">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-100">Auto-Pay is OFF</h4>
                    <p className="text-sm text-amber-200/80 mt-1">Manual payment of {inr(nextAmountPaise / 100)} is required before {formatDate(subscription.endDate)} to continue your plan.</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button variant="contained" size="small" onClick={() => {
                    const plan = plans.find(p => p._id === subscription.planId?._id);
                    if (plan) handleUpgradeClick(plan, subscription.tenure, 'manual_renewal');
                    else {
                      const fakePlan = { _id: subscription.planId?._id, name: subscription.planId?.name, basePrice: 0, isFeatured: false, capabilities: {} };
                      handleUpgradeClick(fakePlan as any, subscription.tenure, 'manual_renewal');
                    }
                  }} className="bg-amber-500 text-slate-900 hover:bg-amber-400 shadow-none font-bold w-full">Pay Manual Renewal</Button>
                  
                  <Button variant="outlined" size="small" onClick={() => {
                    const plan = plans.find(p => p._id === subscription.planId?._id);
                    if (plan) handleUpgradeClick(plan, subscription.tenure, 'setup_autopay');
                    else {
                      const fakePlan = { _id: subscription.planId?._id, name: subscription.planId?.name, basePrice: 0, isFeatured: false, capabilities: {} };
                      handleUpgradeClick(fakePlan as any, subscription.tenure, 'setup_autopay');
                    }
                  }} sx={{ borderColor: 'rgba(251, 191, 36, 0.4)', color: '#fcd34d', '&:hover': { borderColor: '#fcd34d', backgroundColor: 'rgba(251, 191, 36, 0.1)' } }} className="font-bold w-full text-xs">Turn On Auto-Pay</Button>
                </div>
              </div>
              </div>
            );
          }
        })()}
        {/* Plan limits */}
        {Object.keys(capabilities).length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-700">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400 mb-4"><ShieldCheck className="w-4 h-4" /> Your Current Capacity Limits</div>
            <Grid container spacing={2}>
              {Object.entries(CAP_LABELS).map(([key, label]) => (
                <Grid size={{ xs: 6, sm: 4, md: 2 }} key={key}>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center hover:bg-white/10 transition-colors">
                    <div className="text-xl font-black text-white">{cap(capabilities[key] ?? 0)}</div>
                    <div className="text-[10px] font-bold uppercase text-slate-400 mt-1">{label}</div>
                  </div>
                </Grid>
              ))}
            </Grid>
          </div>
        )}
      </div>

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
                    {(() => {
                      const isCurrentPlan = subscription?.planId?._id === p._id && subscription?.tenure === tenure;
                      const isProcessing = payingPlan === p._id;

                      if (isCurrentPlan && hasAutoPay) {
                        return (
                          <Button variant="outlined" fullWidth disabled className="font-bold py-2.5 border-emerald-200 text-emerald-700 bg-emerald-50 opacity-100">
                            Current Plan (Auto-Renews)
                          </Button>
                        );
                      }

                      // Determine button label
                      let buttonLabel = 'Subscribe & Pay';
                      if (isCurrentPlan) {
                        buttonLabel = upcoming.length > 0 ? 'Setup Auto-Pay' : 'Renew Plan';
                      }

                      return (
                        <Button variant={p.isFeatured ? 'contained' : 'outlined'} fullWidth disabled={isProcessing}
                          onClick={() => {
                            if (isCurrentPlan && upcoming.length > 0) {
                              handleUpgradeClick(p, undefined, 'setup_autopay');
                            } else {
                              handleUpgradeClick(p);
                            }
                          }} className="font-bold py-2.5">
                          {isProcessing ? <CircularProgress size={20} color="inherit" /> : buttonLabel}
                        </Button>
                      );
                    })()}
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

      {/* Upgrade Preview Modal */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="sm" fullWidth sx={{ '& .MuiDialog-paper': { borderRadius: '16px' } }}>
        <DialogTitle sx={{ pb: 1, pt: 3, px: 3 }}>
          <div className="flex items-center gap-2 text-xl font-black text-slate-800">
            <Sparkles className="w-5 h-5 text-[#0a5bd7]" /> 
            {checkoutIntent === 'setup_autopay' ? 'Setup Auto-Pay' : checkoutIntent === 'manual_renewal' ? 'Manual Renewal' : previewData?.mode === 'scheduled' ? 'Renew Plan' : 'Confirm Plan Change'}
          </div>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pb: 1 }}>
          {previewData && (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-slate-600 font-medium">
                {checkoutIntent === 'setup_autopay' 
                  ? 'You are setting up an auto-pay mandate for your upcoming cycle. No charges will be made today.' 
                  : checkoutIntent === 'manual_renewal' 
                  ? 'You are manually paying for your upcoming billing cycle.' 
                  : previewData.mode === 'scheduled' 
                  ? 'Your current plan will be extended. The new term will start automatically when your current term ends.' 
                  : 'You are changing your plan. Please review the details below before proceeding to checkout.'}
              </p>
              
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-500 font-bold">New Plan</span>
                  <span className="text-sm font-black text-slate-800">{previewData.newPlanName} ({previewData.tenure})</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-500 font-bold">Plan Price</span>
                  <span className="text-sm font-black text-slate-800">{inr(previewData.newPricePaise / 100)}</span>
                </div>
                
                {previewData.creditPaise > 0 && (
                  <>
                    <div className="my-3 border-t border-slate-200 border-dashed"></div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-emerald-600 font-bold">Unused Credit from Current Plan</span>
                      <span className="text-sm font-black text-emerald-600">+{inr(previewData.creditPaise / 100)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium max-w-[90%] leading-tight">
                      Since online payments charge the full plan price immediately, your unused credit will be converted into <b>{previewData.bonusDays} bonus days</b> added to your new subscription.
                    </p>
                  </>
                )}
              </div>

              <div className="bg-blue-50/50 rounded-xl p-4 border border-[#0a5bd7]/20 flex justify-between items-center">
                <span className="font-black text-[#0a5bd7]">{checkoutIntent === 'setup_autopay' ? 'Amount Due Today' : 'Amount Due Today'}</span>
                <span className="text-xl font-black text-[#0a5bd7]">{inr((previewData.amountDuePaise || 0) / 100)}</span>
              </div>
            </div>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <Button onClick={() => setPreviewOpen(false)} color="inherit" className="font-bold">Cancel</Button>
          <Button onClick={confirmUpgrade} variant="contained" disableElevation className="font-bold bg-[#0a5bd7] px-6">
            {checkoutIntent === 'setup_autopay' ? 'Confirm Setup' : 'Confirm & Pay'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
