'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import OtpVerifyField from '@/components/common/OtpVerifyField';
import BrandLoader from '@/components/common/BrandLoader';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, MenuItem, Select, FormControl, InputLabel, Switch, FormControlLabel,
  Card, CardContent, Typography, Grid, Chip, Tabs, Tab, Divider,
} from '@mui/material';
import {
  Home, ShieldCheck, Crown, CircleUser, Users, Activity, Mail, Phone, CalendarDays,
  MapPin, Ruler, UserPlus, FileText, KeyRound,
} from 'lucide-react';

interface Member {
  _id: string; name: string; email: string | null; phone: string | null;
  relationship: string; householdType: 'OWNER' | 'TENANT'; isOwner: boolean; isHead: boolean; isActive: boolean;
  loginStatus: 'LOGIN' | 'DATA_ONLY'; moveInDate: string | null;
  documents: { _id: string; residentId: string; label: string }[];
}
interface Tenure {
  _id: string; type: string; party: { name: string }; occupants: { name: string; relationship: string }[];
  startDate: string; endDate?: string | null; status: string; source: string;
  saleAmountPaise?: number; rentAmountPaise?: number; notes?: string;
}
interface Evt { _id: string; type: string; summary: string; createdAt: string; actor: { name: string }; }
interface MyFlat {
  flat: { _id: string; number: string; blockName: string; status: string; fullAddress?: string; size?: { name: string }; owner?: { name: string } | null };
  society: { name: string; address?: string; city?: string } | null;
  members: Member[];
  me: { role: string; isOwner: boolean; isHead: boolean; relationship: string | null; moveInDate: string | null; canManage: boolean; documents: { _id: string; residentId: string; label: string }[] };
  tenures: Tenure[];
  events: Evt[];
  tenancy: { party: { name: string }; startDate: string; endDate?: string | null; rentAmountPaise?: number; securityDepositPaise?: number } | null;
}

const money = (paise?: number) => (paise || paise === 0) ? `₹${(paise / 100).toLocaleString('en-IN')}` : '';
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Present';
const fmtDateTime = (d: string) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const cap = (s: string) => s ? s[0] + s.slice(1).toLowerCase() : s;
const today = () => new Date().toISOString().slice(0, 10);
const ALL_RELATIONS = ['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'RELATIVE', 'TENANT', 'STAFF', 'OTHER'];

const TENURE_TONE: Record<string, string> = {
  OWNERSHIP: 'bg-blue-100 text-blue-700', TENANCY: 'bg-amber-100 text-amber-700', OWNER_OCCUPANCY: 'bg-emerald-100 text-emerald-700',
};

export default function MyFlatPage() {
  const { showToast } = useToastConfirm();
  const [data, setData] = useState<MyFlat | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFlat, setNotFlat] = useState(false);
  const [tab, setTab] = useState<'household' | 'timeline'>('household');

  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const emptyAdd = { name: '', email: '', phone: '', relationship: 'SPOUSE', isHead: false, moveInDate: today() };
  const [add, setAdd] = useState(emptyAdd);
  const [emailToken, setEmailToken] = useState<string | null>(null);
  const [phoneToken, setPhoneToken] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/me/flat');
      setData(res.data);
    } catch (err: any) {
      if (err.response?.status === 400) setNotFlat(true);
      else showToast('Failed to load your flat', 'error');
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const closeAdd = () => { setAddOpen(false); setAdd(emptyAdd); setEmailToken(null); setPhoneToken(null); setSubmitting(false); };
  const submitAdd = async () => {
    if (!data) return;
    if (!add.name.trim()) return showToast('Name is required', 'error');
    if (add.email.trim() && !emailToken) return showToast('Verify the email, or clear it', 'error');
    if (add.phone.trim() && !phoneToken) return showToast('Verify the phone, or clear it', 'error');
    setSubmitting(true);
    try {
      await api.post(`/societies/flats/${data.flat._id}/household`, {
        name: add.name, relationship: add.relationship,
        email: add.email.trim() || undefined, phone: add.phone.trim() || undefined,
        isHead: add.isHead, moveInDate: add.moveInDate || undefined,
        emailToken: emailToken || undefined, phoneToken: phoneToken || undefined,
      });
      showToast('Member added', 'success'); closeAdd(); fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to add member', 'error');
    } finally { setSubmitting(false); }
  };

  const downloadDoc = async (residentId: string, docId: string) => {
    try { const res = await api.get(`/societies/household/${residentId}/documents/${docId}/download`); window.open(res.data.url, '_blank'); }
    catch { showToast('Failed to open document', 'error'); }
  };

  if (loading) return <BrandLoader variant="inline" label="Loading your flat…" />;
  if (notFlat || !data) return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-400"><Home className="w-7 h-7" /></div>
      <p className="text-slate-700 font-bold">No flat is linked to this session</p>
      <p className="text-slate-400 text-sm">Switch to a flat unit from the header, or contact your society admin.</p>
    </div>
  );

  const { flat, society, members, me, tenures, events, tenancy } = data;
  const active = members.filter((m) => m.isActive);
  const head = active.find((m) => m.isHead);
  const money2 = (p?: number) => (p || p === 0) ? `₹${(p / 100).toLocaleString('en-IN')}` : '—';
  const viewerIsTenant = me.role === 'RESIDENT_TENANT' || me.relationship === 'TENANT';

  const feed = [
    ...tenures.map((t) => ({ kind: 'tenure' as const, at: t.startDate, t })),
    ...events.map((e) => ({ kind: 'event' as const, at: e.createdAt, e })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#0a5bd7]/10 via-indigo-600/5 to-slate-100 p-6 md:p-7 border border-slate-200/60">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 bg-white/70 border border-slate-200/60 rounded-full px-3 py-1 w-fit">
              <Home className="w-4 h-4 text-[#0a5bd7]" />
              <span className="text-xs font-bold text-slate-700">My Flat</span>
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Flat {flat.number}</h1>
            <p className="text-sm text-slate-600">{flat.blockName} Block · {society?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Chip label={flat.status.replace('_', ' ')} color={flat.status === 'RENTED' ? 'warning' : flat.status === 'OWNER_OCCUPIED' ? 'success' : 'default'} />
            <Chip label={me.isOwner ? 'You are the owner' : `You: ${cap(me.relationship || 'Member')}`} sx={{ fontWeight: 700, bgcolor: me.isOwner ? '#dbeafe' : '#f1f5f9', color: me.isOwner ? '#1d4ed8' : '#475569' }} />
          </div>
        </div>
      </div>

      {tenancy && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center"><KeyRound className="w-5 h-5" /></div>
            <div>
              <p className="font-black text-slate-800">{viewerIsTenant ? 'Your tenancy' : `Rented to ${tenancy.party.name}`}</p>
              <p className="text-xs text-slate-500">Since {fmtDate(tenancy.startDate)}{tenancy.endDate ? ` · agreement till ${fmtDate(tenancy.endDate)}` : ''}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div><p className="text-[10px] text-slate-400 font-bold uppercase">Monthly rent</p><p className="font-bold text-slate-800">{money2(tenancy.rentAmountPaise)}</p></div>
            <div><p className="text-[10px] text-slate-400 font-bold uppercase">Deposit</p><p className="font-bold text-slate-800">{money2(tenancy.securityDepositPaise)}</p></div>
            <div><p className="text-[10px] text-slate-400 font-bold uppercase">Occupants</p><p className="font-bold text-slate-800">{active.filter((m) => m.householdType === 'TENANT').length}</p></div>
          </div>
        </div>
      )}

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={0} className="border border-slate-200/60 rounded-2xl">
            <CardContent className="space-y-4">
              <Typography variant="h6" className="font-bold text-slate-800">Details</Typography>
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="Address" value={flat.fullAddress || society?.address || '—'} />
              <InfoRow icon={<Ruler className="w-4 h-4" />} label="Size" value={flat.size?.name || '—'} />
              <InfoRow icon={<ShieldCheck className="w-4 h-4" />} label="Owner" value={flat.owner?.name || '—'} />
              <InfoRow icon={<Crown className="w-4 h-4" />} label="Head of household" value={head?.name || '—'} />
              <InfoRow icon={<CalendarDays className="w-4 h-4" />} label="Your move-in" value={fmtDate(me.moveInDate)} />
              <Divider />
              {me.documents.length > 0 ? (
                <div>
                  <Typography variant="caption" className="text-slate-400 font-bold uppercase tracking-wider">My documents</Typography>
                  <div className="mt-1.5 space-y-1.5">
                    {me.documents.map((d) => (
                      <button key={d._id} onClick={() => downloadDoc(d.residentId, d._id)} className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                        <FileText className="w-3.5 h-3.5" /> {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">No documents on file.</p>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tab value="household" label={`Household (${active.length})`} icon={<Users className="w-4 h-4" />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700, minHeight: 48 }} />
            <Tab value="timeline" label={`Timeline (${feed.length})`} icon={<Activity className="w-4 h-4" />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700, minHeight: 48 }} />
          </Tabs>

          {tab === 'household' && (
            <div className="space-y-3">
              {me.canManage && (
                <div className="flex justify-end">
                  <Button variant="contained" onClick={() => setAddOpen(true)} startIcon={<UserPlus className="w-4 h-4" />} sx={{ backgroundColor: '#0a5bd7', '&:hover': { backgroundColor: '#094cb0' } }}>Add Member</Button>
                </div>
              )}
              {active.map((m) => (
                <div key={m._id} className={`rounded-2xl border p-4 flex items-start gap-3 ${m.isHead ? 'border-violet-200 bg-violet-50/40' : 'border-slate-200/70 bg-white'}`}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${m.isOwner ? 'bg-blue-100 text-blue-700' : m.isHead ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
                    {m.isOwner ? <ShieldCheck className="w-5 h-5" /> : m.isHead ? <Crown className="w-5 h-5" /> : <CircleUser className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 truncate">{m.name}</span>
                      {m.isOwner && <Chip size="small" color="primary" label="Owner" sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />}
                      {m.isHead && <Chip size="small" label="Head" sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: '#ede9fe', color: '#6d28d9' }} />}
                      <Chip size="small" variant="outlined" label={cap(m.relationship)} sx={{ height: 18, fontSize: 10 }} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-slate-500">
                      {m.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {m.email}</span>}
                      {m.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {m.phone}</span>}
                      {m.moveInDate && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Since {fmtDate(m.moveInDate)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'timeline' && (
            <div className="space-y-3">
              {feed.length === 0 && <p className="text-sm text-slate-400 py-8 text-center">No history yet.</p>}
              {feed.map((item) => item.kind === 'tenure' ? (
                <div key={`t-${item.t._id}`} className={`rounded-2xl border p-4 ${item.t.status === 'ACTIVE' ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200/70'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${TENURE_TONE[item.t.type] || 'bg-slate-100 text-slate-600'}`}><Home className="w-4 h-4" /></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{item.t.party.name}</span>
                          {item.t.status === 'ACTIVE' && <Chip size="small" color="success" label="Current" sx={{ height: 18, fontSize: 10 }} />}
                        </div>
                        <span className="text-xs text-slate-500">{cap(item.t.type.replace('_', ' '))}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      {fmtDate(item.t.startDate)} — {fmtDate(item.t.endDate)}
                      {(item.t.saleAmountPaise || item.t.rentAmountPaise) ? <div className="font-bold text-slate-700 mt-0.5">{money(item.t.saleAmountPaise) || `${money(item.t.rentAmountPaise)}/mo`}</div> : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div key={`e-${item.e._id}`} className="flex items-start gap-3 px-1 py-1.5">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0"><Activity className="w-3.5 h-3.5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700 font-medium">{item.e.summary}</p>
                    <p className="text-[11px] text-slate-400">{fmtDateTime(item.e.createdAt)} · by {item.e.actor?.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Grid>
      </Grid>

      {/* Owner add-member */}
      <Dialog open={addOpen} onClose={closeAdd} maxWidth="sm" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold border-b border-slate-100">Add Household Member</DialogTitle>
        <DialogContent className="pt-6 space-y-4">
          <p className="text-xs text-slate-500 -mt-1">Leave email & phone empty for a <strong>data-only</strong> member (no login). Any contact you enter must be OTP-verified — they get passwordless login access.</p>
          <div className="flex gap-2">
            <FormControl fullWidth size="small"><InputLabel>Relationship</InputLabel>
              <Select value={add.relationship} label="Relationship" onChange={(e) => setAdd({ ...add, relationship: e.target.value })}>
                {ALL_RELATIONS.map((r) => <MenuItem key={r} value={r}>{cap(r)}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Move-in date" type="date" fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} value={add.moveInDate} onChange={(e) => setAdd({ ...add, moveInDate: e.target.value })} />
          </div>
          <TextField autoFocus label="Full name" fullWidth size="small" value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} />
          <div>
            <TextField label="Email (optional)" fullWidth size="small" type="email" value={add.email} onChange={(e) => { setAdd({ ...add, email: e.target.value }); setEmailToken(null); }} />
            {add.email.trim() && <OtpVerifyField channel="EMAIL" target={add.email} purpose="FLAT_REGISTRATION" onVerified={setEmailToken} onReset={() => setEmailToken(null)} />}
          </div>
          <div>
            <TextField label="Phone (optional)" fullWidth size="small" value={add.phone} onChange={(e) => { setAdd({ ...add, phone: e.target.value }); setPhoneToken(null); }} />
            {add.phone.trim() && <OtpVerifyField channel="PHONE" target={add.phone} purpose="FLAT_REGISTRATION" onVerified={setPhoneToken} onReset={() => setPhoneToken(null)} />}
          </div>
          <FormControlLabel control={<Switch checked={add.isHead} onChange={(e) => setAdd({ ...add, isHead: e.target.checked })} />} label="Set as head of household" />
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100">
          <Button onClick={closeAdd} className="text-slate-600">Cancel</Button>
          <Button onClick={submitAdd} variant="contained" disabled={submitting} sx={{ backgroundColor: '#0a5bd7' }}>{submitting ? <CircularProgress size={22} color="inherit" /> : 'Add Member'}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-400 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-slate-700 break-words">{value}</p>
      </div>
    </div>
  );
}
