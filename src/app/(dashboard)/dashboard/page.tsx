'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { CircularProgress } from '@mui/material';
import ModuleScope from '../../../components/common/ModuleScope';
import {
  Building, Users, Clock, CheckCircle2, ReceiptText, Repeat, Crown, ArrowRight, Sparkles, ShieldCheck,
} from 'lucide-react';
import api from '../../../lib/api';

const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

export default function DashboardPage() {
  const { user, activeProfile } = useAuth();
  const role = activeProfile?.role || '';

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#0a5bd7]/10 via-indigo-600/5 to-slate-100 p-6 md:p-8 border border-slate-200/60">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2 bg-white/70 border border-slate-200/60 rounded-full px-3 py-1 w-fit">
            <Sparkles className="w-4 h-4 text-[#0a5bd7]" />
            <span className="text-xs font-bold text-slate-700">{activeProfile ? `${activeProfile.tenantType} workspace` : 'Workspace'}</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-800">Hello, {user?.name || 'there'}!</h2>
          <p className="text-slate-600 text-sm">Signed in as <span className="font-bold">{role.replace(/_/g, ' ')}</span></p>
        </div>
      </div>

      {role.startsWith('SYSTEM_') ? (
        <OwnerDashboard />
      ) : role.startsWith('SOCIETY_') ? (
        <SocietyAdminDashboard />
      ) : (
        <BasicContextCard role={role} tenant={activeProfile?.tenantType} />
      )}
    </div>
  );
}

/* ───────────── Owner ───────────── */
function OwnerDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, active: 0, subs: 0, paid: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const totalP = (s = '') => api.get(`/societies?isPagination=true&pageSize=1${s ? `&status=${s}` : ''}`).then((r) => r.data.pagination?.total ?? 0).catch(() => 0);
        const [total, pendingCount, active, subs, paid, recentRes, pendingRes] = await Promise.all([
          totalP(),
          totalP('PENDING'),
          totalP('ACTIVE'),
          api.get('/billing/subscriptions?isPagination=true&pageSize=1&status=active').then((r) => r.data.pagination?.total ?? 0).catch(() => 0),
          api.get('/billing/invoices?isPagination=true&pageSize=1&status=PAID').then((r) => r.data.pagination?.total ?? 0).catch(() => 0),
          api.get('/societies?isPagination=true&pageSize=6').then((r) => r.data.societies || []).catch(() => []),
          api.get('/societies?isPagination=true&pageSize=5&status=PENDING').then((r) => r.data.societies || []).catch(() => []),
        ]);
        setStats({ total, pending: pendingCount, active, subs, paid });
        setRecent(recentRes);
        setPending(pendingRes);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-24"><CircularProgress size={32} thickness={4} /></div>;

  const cards = [
    { label: 'Total Societies', value: stats.total, icon: <Building className="w-5 h-5 text-blue-500" /> },
    { label: 'Pending Approvals', value: stats.pending, icon: <Clock className="w-5 h-5 text-amber-500" /> },
    { label: 'Active Subscriptions', value: stats.subs, icon: <Repeat className="w-5 h-5 text-emerald-500" /> },
    { label: 'Paid Invoices', value: stats.paid, icon: <ReceiptText className="w-5 h-5 text-violet-500" /> },
  ];

  return (
    <>
      <div className="flex items-center gap-2"><ModuleScope scope="society" /><span className="text-xs text-slate-400">Live platform metrics</span></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c, i) => (
          <Card key={i} className="bg-white border-slate-200/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2 p-5">
              <span className="text-sm font-semibold text-slate-500">{c.label}</span>
              <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg">{c.icon}</div>
            </CardHeader>
            <CardContent className="p-5 pt-0"><div className="text-3xl font-extrabold text-slate-800">{c.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white border-slate-200/60 shadow-sm">
          <CardHeader className="p-6 flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-extrabold text-slate-800 flex items-center gap-2"><Building className="w-5 h-5 text-[#0a5bd7]" /> Recent Societies</CardTitle>
            <Link href="/dashboard/societies" className="text-xs font-bold text-[#0a5bd7] inline-flex items-center gap-1 hover:underline">View all <ArrowRight className="w-3.5 h-3.5" /></Link>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            {recent.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">No societies yet.</p> : (
              <div className="divide-y divide-slate-100">
                {recent.map((s) => (
                  <Link key={s._id} href={`/owner/societies/${s._id}`} className="py-3 flex items-center justify-between first:pt-0 last:pb-0 hover:bg-slate-50 -mx-2 px-2 rounded-lg transition-colors">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{s.name}</p>
                      <p className="text-[11px] text-slate-500">{[s.city, s.state].filter(Boolean).join(', ') || s.address}</p>
                    </div>
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-black border ${STATUS_STYLES[s.status]}`}>{s.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200/60 shadow-sm">
          <CardHeader className="p-6"><CardTitle className="text-lg font-extrabold text-slate-800 flex items-center gap-2"><Clock className="w-5 h-5 text-amber-500" /> Awaiting Approval</CardTitle></CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            {pending.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">Nothing pending. 🎉</p> : (
              <div className="space-y-2">
                {pending.map((s) => (
                  <Link key={s._id} href={`/owner/societies/${s._id}`} className="block p-3 rounded-xl bg-amber-50/50 border border-amber-100 hover:bg-amber-50 transition-colors">
                    <p className="text-sm font-bold text-slate-800">{s.name}</p>
                    <p className="text-[11px] text-slate-500">{s.contactEmail || s.address}</p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

/* ───────────── Society Admin ───────────── */
function SocietyAdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<any>(null);
  const [caps, setCaps] = useState<Record<string, number>>({});
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [s, inv] = await Promise.all([
          api.get('/billing/my-subscription').then((r) => r.data).catch(() => null),
          api.get('/billing/invoices?isPagination=true&pageSize=5').then((r) => r.data.invoices || []).catch(() => []),
        ]);
        if (s) { setSub(s.subscription); setCaps(s.capabilities || {}); }
        setInvoices(inv);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-24"><CircularProgress size={32} thickness={4} /></div>;

  const planName = sub?.planId?.name || (sub?.tenure === 'trial' ? 'Free Trial' : '—');
  const daysLeft = sub?.endDate ? Math.max(0, Math.ceil((new Date(sub.endDate).getTime() - Date.now()) / 86400000)) : 0;
  const CAP_LABELS: Record<string, string> = { max_flat_count: 'Flats', max_staff_count: 'Staff', max_member_count: 'Members', max_visitor_count: 'Visitors', max_tickets_count: 'Tickets', max_service_count: 'Services' };

  return (
    <>
      <div className="flex items-center gap-2"><ModuleScope scope="society" /><span className="text-xs text-slate-400">Your society workspace</span></div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-white border-slate-200/60 shadow-sm">
          <CardHeader className="p-6 pb-2"><CardTitle className="text-sm font-bold text-slate-500 flex items-center gap-2"><Crown className="w-4 h-4 text-[#0a5bd7]" /> Current Plan</CardTitle></CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="text-2xl font-extrabold text-slate-800">{planName}</div>
            <p className="text-xs text-slate-500 mt-1 capitalize">{sub ? `${sub.status} · ${sub.tenure}` : 'No active plan'}</p>
            <Link href="/dashboard/billing" className="text-xs font-bold text-[#0a5bd7] inline-flex items-center gap-1 hover:underline mt-3">Manage billing <ArrowRight className="w-3.5 h-3.5" /></Link>
          </CardContent>
        </Card>
        <Card className="bg-white border-slate-200/60 shadow-sm">
          <CardHeader className="p-6 pb-2"><CardTitle className="text-sm font-bold text-slate-500 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> Time Remaining</CardTitle></CardHeader>
          <CardContent className="px-6 pb-6"><div className="text-2xl font-extrabold text-slate-800">{daysLeft} days</div><p className="text-xs text-slate-500 mt-1">Ends {fmtDate(sub?.endDate)}</p></CardContent>
        </Card>
        <Card className="bg-white border-slate-200/60 shadow-sm">
          <CardHeader className="p-6 pb-2"><CardTitle className="text-sm font-bold text-slate-500 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Status</CardTitle></CardHeader>
          <CardContent className="px-6 pb-6"><div className="text-2xl font-extrabold text-slate-800 capitalize">{sub?.status || '—'}</div></CardContent>
        </Card>
      </div>

      {Object.keys(caps).length > 0 && (
        <Card className="bg-white border-slate-200/60 shadow-sm">
          <CardHeader className="p-6 pb-2"><CardTitle className="text-sm font-bold text-slate-500 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#0a5bd7]" /> Plan Limits</CardTitle></CardHeader>
          <CardContent className="px-6 pb-6 grid grid-cols-3 sm:grid-cols-6 gap-3">
            {Object.entries(CAP_LABELS).map(([k, label]) => (
              <div key={k} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                <div className="text-lg font-black text-slate-800">{caps[k] === -1 ? '∞' : (caps[k] ?? 0)}</div>
                <div className="text-[10px] font-bold uppercase text-slate-400">{label}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="bg-white border-slate-200/60 shadow-sm">
        <CardHeader className="p-6 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-extrabold text-slate-800 flex items-center gap-2"><ReceiptText className="w-5 h-5 text-[#0a5bd7]" /> Recent Invoices</CardTitle>
          <Link href="/dashboard/billing" className="text-xs font-bold text-[#0a5bd7] inline-flex items-center gap-1 hover:underline">All invoices <ArrowRight className="w-3.5 h-3.5" /></Link>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-0">
          {invoices.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">No invoices yet.</p> : (
            <div className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <div key={inv._id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{inv.planId?.name || 'Subscription'} <span className="text-slate-400 font-normal">· {inv.invoiceType === 'OFFLINE_CASH' ? 'Cash' : 'Online'}</span></p>
                    <p className="text-[11px] text-slate-500">{fmtDate(inv.paidAt || inv.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">{inr(inv.amount / 100)}</p>
                    <span className={`text-[10px] uppercase font-black ${inv.status === 'PAID' ? 'text-emerald-600' : 'text-amber-600'}`}>{inv.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

/* ───────────── Other roles ───────────── */
function BasicContextCard({ role, tenant }: { role: string; tenant?: string }) {
  return (
    <Card className="bg-white border-slate-200/60 shadow-sm">
      <CardContent className="p-8 text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto"><Users className="w-7 h-7 text-[#0a5bd7]" /></div>
        <h3 className="text-lg font-extrabold text-slate-800">Workspace ready</h3>
        <p className="text-sm text-slate-500">You are in the <span className="font-bold">{tenant}</span> workspace as <span className="font-bold">{role.replace(/_/g, ' ')}</span>. Use the sidebar to access your available modules.</p>
      </CardContent>
    </Card>
  );
}
