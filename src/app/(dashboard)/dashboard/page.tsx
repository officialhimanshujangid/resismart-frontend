'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { CircularProgress } from '@mui/material';
import ModuleScope from '../../../components/common/ModuleScope';
import {
  Building, Users, Clock, CheckCircle2, ReceiptText, Repeat, Crown, ArrowRight, Sparkles, ShieldCheck,
  Home, Store, MapPin, BadgeCheck, Ruler,
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
  const { user, activeProfile, activeContext } = useAuth();
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
        <MyUnitPanel role={role} tenant={activeProfile?.tenantType} unitLabel={activeContext?.unitLabel || null} />
      )}
    </div>
  );
}

import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

function OwnerDashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/dashboard/metrics');
        setMetrics(res.data.metrics);
      } catch (e) {
        console.error('Failed to fetch metrics', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !metrics) return <div className="flex items-center justify-center py-24"><CircularProgress size={32} thickness={4} /></div>;

  const donutData = [
    { name: 'Societies', value: metrics.totalSocieties },
    { name: 'Shops', value: metrics.totalShops },
  ];
  const COLORS = ['#407BFF', '#FF9F43']; // blue and orange from screenshot

  return (
    <div className="space-y-6 pb-12">
      {/* Top Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue Report (Bar Chart) - takes 2 columns */}
        <Card className="lg:col-span-2 shadow-sm border-slate-100 rounded-2xl overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between p-6 pb-2">
            <CardTitle className="text-lg font-bold text-slate-800">Revenue Report</CardTitle>
            <select className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none text-slate-600">
              <option>Yearly</option>
            </select>
          </CardHeader>
          <CardContent className="p-6 pt-0 flex flex-col h-[350px]">
            <div className="flex gap-4 mb-4 text-xs font-semibold">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#407BFF] inline-block rounded-sm"/> Earning: <span className="font-bold text-slate-800">₹{(metrics.totalRevenuePaise/100).toLocaleString('en-IN')}</span></span>
            </div>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v: number) => `₹${Number(v).toLocaleString('en-IN')}`} width={70} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#407BFF" radius={[4, 4, 4, 4]} barSize={14} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Stats and Donut - takes 1 column */}
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            <Card className="shadow-sm border-slate-100 rounded-2xl">
              <CardContent className="p-5 flex flex-col justify-center">
                <div className="w-10 h-10 bg-blue-50 text-[#407BFF] rounded-xl flex items-center justify-center mb-3">
                  <Building className="w-5 h-5" />
                </div>
                <div className="text-xs text-slate-500 font-semibold mb-1">Total Shops</div>
                <div className="text-2xl font-bold text-slate-800">{metrics.totalShops}</div>
                <div className="text-[10px] text-slate-400 mt-1">Active workspaces</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-slate-100 rounded-2xl">
              <CardContent className="p-5 flex flex-col justify-center">
                <div className="w-10 h-10 bg-amber-50 text-[#FF9F43] rounded-xl flex items-center justify-center mb-3">
                  <Users className="w-5 h-5" />
                </div>
                <div className="text-xs text-slate-500 font-semibold mb-1">Total Customers</div>
                <div className="text-2xl font-bold text-slate-800">{metrics.totalCustomers}</div>
                <div className="text-[10px] text-slate-400 mt-1">Across all tenants</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-slate-100 rounded-2xl">
              <CardContent className="p-5 flex flex-col justify-center">
                <div className="w-10 h-10 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center mb-3">
                  <Repeat className="w-5 h-5" />
                </div>
                <div className="text-xs text-slate-500 font-semibold mb-1">Total Orders</div>
                <div className="text-2xl font-bold text-slate-800">{metrics.totalInvoices}</div>
                <div className="text-[10px] text-slate-400 mt-1">Generated invoices</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-slate-100 rounded-2xl">
              <CardContent className="p-5 flex flex-col justify-center">
                <div className="w-10 h-10 bg-pink-50 text-pink-500 rounded-xl flex items-center justify-center mb-3">
                  <ReceiptText className="w-5 h-5" />
                </div>
                <div className="text-xs text-slate-500 font-semibold mb-1">Total Sales</div>
                <div className="text-xl font-bold text-slate-800">₹{(metrics.totalRevenuePaise/100).toLocaleString('en-IN')}</div>
                <div className="text-[10px] text-slate-400 mt-1">Collected revenue</div>
              </CardContent>
            </Card>
          </div>
          
          <Card className="shadow-sm border-slate-100 rounded-2xl flex-1 flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between p-6 pb-0">
              <CardTitle className="text-sm font-bold text-slate-800">Customers Statistics</CardTitle>
              <select className="text-[10px] bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none text-slate-600">
                <option>Monthly</option>
              </select>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col items-center justify-center relative">
              <div className="h-[180px] w-[180px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={4}
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-6 mt-2 text-xs font-semibold text-slate-600 w-full justify-center">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#407BFF] rounded-sm"/> Societies: <span className="font-bold text-slate-800">{metrics.totalSocieties}</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#FF9F43] rounded-sm"/> Shops: <span className="font-bold text-slate-800">{metrics.totalShops}</span></span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders Table */}
        <Card className="lg:col-span-2 shadow-sm border-slate-100 rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between p-6">
            <CardTitle className="text-lg font-bold text-slate-800">Recent Orders</CardTitle>
            <Link href="/dashboard/billing" className="text-xs font-bold text-[#407BFF] hover:underline">View All &gt;</Link>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">Users</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3 text-center">Amount</th>
                  <th className="px-4 py-3 text-center rounded-r-lg">Status</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentOrders.map((order: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-[#407BFF] text-xs">
                        {order.tenantId?.name?.charAt(0) || 'U'}
                      </div>
                      <span className="font-semibold text-slate-700">{order.tenantId?.name || 'Unknown'}</span>
                    </td>
                    <td className="px-4 py-4 font-medium text-slate-500">{order.customInvoiceNumber || `#${order._id.substring(order._id.length - 7)}`}</td>
                    <td className="px-4 py-4 text-slate-500 truncate max-w-[150px]">{order.metadata?.planName || 'Subscription'}</td>
                    <td className="px-4 py-4 text-center font-semibold text-slate-700">₹{(order.amount/100).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-4 text-center">
                      <span className={`text-[10px] uppercase px-2.5 py-1 rounded-full font-bold
                        ${order.status === 'PAID' ? 'bg-emerald-100 text-emerald-600' 
                          : order.status === 'PENDING' ? 'bg-amber-100 text-amber-600'
                          : 'bg-red-100 text-red-600'}`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Transactions List */}
        <Card className="shadow-sm border-slate-100 rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between p-6">
            <CardTitle className="text-lg font-bold text-slate-800">Transactions</CardTitle>
            <select className="text-[10px] bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none text-slate-600">
              <option>This Month</option>
            </select>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            <div className="space-y-5">
              {metrics.recentOrders.slice(0, 5).map((order: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:border-blue-200 group-hover:text-blue-500 transition-colors">
                      <ReceiptText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-700">{order.tenantId?.name || 'Customer'}</div>
                      <div className="text-[10px] text-slate-400">{order.metadata?.paymentMethod || 'Razorpay / Cash'}</div>
                    </div>
                  </div>
                  <div className={`text-sm font-bold ${order.status === 'PAID' ? 'text-emerald-500' : 'text-slate-500'}`}>
                    {order.status === 'PAID' ? '+' : ''}₹{(order.amount/100).toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
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

/* ───────────── Resident / Shopkeeper: active unit summary ───────────── */
function MyUnitPanel({ role, tenant, unitLabel }: { role: string; tenant?: string; unitLabel: string | null }) {
  const [loading, setLoading] = useState(true);
  const [unitType, setUnitType] = useState<'FLAT' | 'SHOP' | null>(null);
  const [unit, setUnit] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/me/unit-summary');
        setUnitType(res.data.unitType);
        setUnit(res.data.unit);
      } catch (e) {
        console.error('Failed to load unit summary', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-24"><CircularProgress size={32} thickness={4} /></div>;

  if (!unit) {
    return <BasicContextCard role={role} tenant={tenant} unitLabel={unitLabel} />;
  }

  const isShop = unitType === 'SHOP';
  const societyName = unit.societyId?.name || '';
  const societyAddress = unit.societyId?.address || '';
  const residentCount = Array.isArray(unit.residents) ? unit.residents.length : 0;

  const rows: Array<{ icon: React.ReactNode; label: string; value: string }> = isShop
    ? [
        { icon: <MapPin className="w-4 h-4 text-[#0a5bd7]" />, label: 'Address', value: [unit.address, unit.city, unit.state, unit.pincode].filter(Boolean).join(', ') || '—' },
        { icon: <BadgeCheck className="w-4 h-4 text-emerald-500" />, label: 'Status', value: unit.status || '—' },
        { icon: <Store className="w-4 h-4 text-amber-500" />, label: 'Type', value: unit.storeType || unit.typeService || '—' },
        { icon: <Users className="w-4 h-4 text-[#0a5bd7]" />, label: 'Contact', value: unit.contactNumber || '—' },
      ]
    : [
        { icon: <Building className="w-4 h-4 text-[#0a5bd7]" />, label: 'Block', value: unit.blockName || unit.blockId?.name || '—' },
        { icon: <Home className="w-4 h-4 text-[#0a5bd7]" />, label: 'Society', value: societyName || '—' },
        { icon: <MapPin className="w-4 h-4 text-slate-400" />, label: 'Address', value: unit.fullAddress || societyAddress || '—' },
        { icon: <Ruler className="w-4 h-4 text-slate-400" />, label: 'Size', value: unit.size?.name || '—' },
        { icon: <BadgeCheck className="w-4 h-4 text-emerald-500" />, label: 'Status', value: (unit.status || '').replace(/_/g, ' ') || '—' },
        { icon: <Users className="w-4 h-4 text-[#0a5bd7]" />, label: 'Residents', value: String(residentCount) },
      ];

  return (
    <Card className="bg-white border-slate-200/60 shadow-sm">
      <CardHeader className="p-6 flex flex-row items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
          {isShop ? <Store className="w-7 h-7 text-[#0a5bd7]" /> : <Home className="w-7 h-7 text-[#0a5bd7]" />}
        </div>
        <div className="min-w-0">
          <CardTitle className="text-xl font-extrabold text-slate-800 truncate">
            {unitLabel || unit.name || unit.number || 'My Unit'}
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">
            {isShop ? 'Your shop' : societyName ? `Flat / Plot · ${societyName}` : 'Your unit'} · <span className="font-bold">{role.replace(/_/g, ' ')}</span>
          </p>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center shrink-0">{r.icon}</span>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{r.label}</div>
                <div className="text-sm font-bold text-slate-700 truncate">{r.value}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ───────────── Fallback (no unit resolved) ───────────── */
function BasicContextCard({ role, tenant, unitLabel }: { role: string; tenant?: string; unitLabel?: string | null }) {
  return (
    <Card className="bg-white border-slate-200/60 shadow-sm">
      <CardContent className="p-8 text-center space-y-2">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto"><Users className="w-7 h-7 text-[#0a5bd7]" /></div>
        <h3 className="text-lg font-extrabold text-slate-800">{unitLabel || 'Workspace ready'}</h3>
        <p className="text-sm text-slate-500">You are in the <span className="font-bold">{tenant}</span> workspace as <span className="font-bold">{role.replace(/_/g, ' ')}</span>. Use the sidebar to access your available modules.</p>
      </CardContent>
    </Card>
  );
}
