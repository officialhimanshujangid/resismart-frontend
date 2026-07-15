'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { useAuth } from '@/context/AuthContext';
import OtpVerifyField from '@/components/common/OtpVerifyField';
import BrandLoader from '@/components/common/BrandLoader';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, CircularProgress, Tooltip, MenuItem, Select, FormControl, InputLabel,
  Card, CardContent, Typography, Grid, Chip, Tabs, Tab, Switch, FormControlLabel,
  Menu, Divider,
} from '@mui/material';
import FlatLifecycleManager, { FlatLifecycleManagerHandle } from '@/components/flats/FlatLifecycleManager';
import {
  ArrowLeft, UserPlus, Trash2, ShieldCheck, User, KeyRound, Home, UserCheck,
  Plus, DoorOpen, Store, LogIn, History, Crown, MoreVertical, Pencil, FileText,
  Upload, Phone, Mail, CalendarDays, CircleUser, Users, Activity,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Flat {
  _id: string; number: string; blockName: string; status: string;
  plotNumber?: string; fullAddress?: string;
  ownerUserId?: { _id: string; name: string; email: string; phone?: string };
}
interface Member {
  _id: string; userId: string | null; name: string; email: string | null; phone: string | null;
  relationship: string; householdType: 'OWNER' | 'TENANT'; isOwner: boolean; isHead: boolean; isActive: boolean;
  loginStatus: 'LOGIN' | 'DATA_ONLY';
  moveInDate: string | null; moveOutDate: string | null;
  documents: { _id: string; residentId: string; kind: string; label: string; uploadedAt: string }[];
  emailVerifiedAt: string | null; phoneVerifiedAt: string | null;
}
interface Tenancy {
  _id: string; party: { name: string }; startDate: string; endDate?: string | null;
  rentAmountPaise?: number; securityDepositPaise?: number;
  documents: { _id: string; kind: string; label: string; uploadedAt: string }[];
}
interface Occupant { name: string; relationship: string; userId?: string; }
interface Tenure {
  _id: string; type: 'OWNERSHIP' | 'TENANCY' | 'OWNER_OCCUPANCY';
  party: { name: string }; occupants: Occupant[];
  startDate: string; endDate?: string | null; status: 'ACTIVE' | 'ENDED'; source: string;
  saleAmountPaise?: number; rentAmountPaise?: number; securityDepositPaise?: number; notes?: string;
}
interface FlatEvt {
  _id: string; type: string; summary: string; createdAt: string;
  actor: { name: string }; subject?: { name?: string; relationship?: string };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const money = (paise?: number) => (paise || paise === 0) ? `₹${(paise / 100).toLocaleString('en-IN')}` : '';
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Present';
const fmtDateTime = (d: string) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const today = () => new Date().toISOString().slice(0, 10);
const plusMonths = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
const cap = (s: string) => s ? s[0] + s.slice(1).toLowerCase() : s;

const FAMILY_RELATIONS = ['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'RELATIVE', 'STAFF', 'OTHER'];
const ALL_RELATIONS = ['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'RELATIVE', 'TENANT', 'STAFF', 'OTHER'];

const TENURE_META: Record<string, { icon: React.ReactNode; tone: string; label: string }> = {
  OWNERSHIP: { icon: <Home className="w-4 h-4" />, tone: 'bg-blue-100 text-blue-700', label: 'Ownership' },
  TENANCY: { icon: <KeyRound className="w-4 h-4" />, tone: 'bg-amber-100 text-amber-700', label: 'Tenancy' },
  OWNER_OCCUPANCY: { icon: <UserCheck className="w-4 h-4" />, tone: 'bg-emerald-100 text-emerald-700', label: 'Owner occupied' },
};
const EVENT_TONE: Record<string, string> = {
  MEMBER_ADDED: 'bg-emerald-100 text-emerald-700', MEMBER_REMOVED: 'bg-rose-100 text-rose-700',
  MEMBER_UPDATED: 'bg-slate-100 text-slate-600', HEAD_CHANGED: 'bg-violet-100 text-violet-700',
  ACCESS_GRANTED: 'bg-blue-100 text-blue-700', CONTACT_UPDATED: 'bg-blue-100 text-blue-700',
  DOCUMENT_ADDED: 'bg-indigo-100 text-indigo-700', RENTED: 'bg-amber-100 text-amber-700',
  TENANCY_ENDED: 'bg-slate-100 text-slate-600', OWNER_CHANGED: 'bg-blue-100 text-blue-700',
  OWNER_MOVED_IN: 'bg-emerald-100 text-emerald-700', MARKED_VACANT: 'bg-slate-100 text-slate-600',
};

type DialogKind = null | 'add' | 'edit' | 'doc' | 'tenancyDoc' | 'history' | 'rent' | 'endTenancy';

export default function FlatDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast, confirm } = useToastConfirm();
  const { activeProfile } = useAuth();
  const flatId = params.flatId as string;

  const [flat, setFlat] = useState<Flat | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [timeline, setTimeline] = useState<Tenure[]>([]);
  const [events, setEvents] = useState<FlatEvt[]>([]);
  const [tenancy, setTenancy] = useState<Tenancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'household' | 'tenancy' | 'timeline'>('household');

  const lifecycleRef = useRef<FlatLifecycleManagerHandle>(null);

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [submitting, setSubmitting] = useState(false);

  // Row action menu
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const [menuFor, setMenuFor] = useState<Member | null>(null);

  // Add-member form
  const emptyAdd = { name: '', email: '', phone: '', relationship: 'SPOUSE', isHead: false, moveInDate: today(), householdType: 'OWNER' as 'OWNER' | 'TENANT' };
  const [add, setAdd] = useState(emptyAdd);
  const [addEmailToken, setAddEmailToken] = useState<string | null>(null);
  const [addPhoneToken, setAddPhoneToken] = useState<string | null>(null);

  // Tenancy document form
  const [tDocLabel, setTDocLabel] = useState('');
  const [tDocKind, setTDocKind] = useState('AGREEMENT');
  const [tDocFile, setTDocFile] = useState<File | null>(null);
  const tFileRef = useRef<HTMLInputElement>(null);

  // Edit-member form
  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [edit, setEdit] = useState({ relationship: '', isActive: true, moveInDate: '', addEmail: '', addPhone: '' });
  const [editEmailToken, setEditEmailToken] = useState<string | null>(null);
  const [editPhoneToken, setEditPhoneToken] = useState<string | null>(null);

  // Document form
  const [docTarget, setDocTarget] = useState<Member | null>(null);
  const [docLabel, setDocLabel] = useState('');
  const [docKind, setDocKind] = useState('ID_PROOF');
  const [docFile, setDocFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // lifecycle dialogs (history only)
  const [hist, setHist] = useState({ type: 'OWNERSHIP', partyName: '', startDate: '', endDate: '', saleAmount: '', rentAmount: '', notes: '' });
  const [actionDate, setActionDate] = useState(today());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [flatRes, hhRes, tlRes, evRes, tnRes] = await Promise.all([
        api.get(`/societies/flats/${flatId}`),
        api.get(`/societies/flats/${flatId}/household`),
        api.get(`/societies/flats/${flatId}/timeline`),
        api.get(`/societies/flats/${flatId}/events`),
        api.get(`/societies/flats/${flatId}/tenancy`),
      ]);
      setFlat(flatRes.data.flat);
      setMembers(hhRes.data.members || []);
      setTimeline(tlRes.data.timeline || []);
      setEvents(evRes.data.events || []);
      setTenancy(tnRes.data.tenancy || null);
    } catch {
      showToast('Failed to load flat details', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const closeDialog = () => {
    setDialog(null); setSubmitting(false);
    setAdd(emptyAdd); setAddEmailToken(null); setAddPhoneToken(null);
    setEditTarget(null); setEditEmailToken(null); setEditPhoneToken(null);
    setDocTarget(null); setDocLabel(''); setDocKind('ID_PROOF'); setDocFile(null);
    setTDocLabel(''); setTDocKind('AGREEMENT'); setTDocFile(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  };

  const openAddMember = (householdType: 'OWNER' | 'TENANT') => {
    setAdd({ ...emptyAdd, relationship: householdType === 'TENANT' ? 'SPOUSE' : 'SPOUSE', householdType });
    setAddEmailToken(null); setAddPhoneToken(null); setDialog('add');
  };

  const call = async (fn: () => Promise<any>, successMsg?: string) => {
    setSubmitting(true);
    try {
      const res = await fn();
      showToast(res?.data?.message || successMsg || 'Done', 'success');
      closeDialog();
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.response?.data?.errors?.[0]?.message || 'Action failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Household actions ─────────────────────────────────────────────────────
  const submitAdd = () => {
    if (!add.name.trim()) return showToast('Name is required', 'error');
    if (add.email.trim() && !addEmailToken) return showToast('Verify the email with an OTP, or clear it', 'error');
    if (add.phone.trim() && !addPhoneToken) return showToast('Verify the phone with an OTP, or clear it', 'error');
    call(() => api.post(`/societies/flats/${flatId}/household`, {
      name: add.name, relationship: add.relationship,
      email: add.email.trim() || undefined, phone: add.phone.trim() || undefined,
      isHead: add.isHead, moveInDate: add.moveInDate || undefined,
      householdType: add.householdType,
      emailToken: addEmailToken || undefined, phoneToken: addPhoneToken || undefined,
    }));
  };

  const openEdit = (m: Member) => {
    setEditTarget(m);
    setEdit({ relationship: m.relationship, isActive: m.isActive, moveInDate: m.moveInDate?.slice(0, 10) || '', addEmail: '', addPhone: '' });
    setEditEmailToken(null); setEditPhoneToken(null);
    setMenuEl(null); setDialog('edit');
  };
  const submitEdit = () => {
    if (!editTarget) return;
    if (edit.addEmail.trim() && !editEmailToken) return showToast('Verify the new email with an OTP, or clear it', 'error');
    if (edit.addPhone.trim() && !editPhoneToken) return showToast('Verify the new phone with an OTP, or clear it', 'error');
    call(() => api.put(`/societies/household/${editTarget._id}`, {
      relationship: edit.relationship, isActive: edit.isActive,
      moveInDate: edit.moveInDate || undefined,
      addEmail: edit.addEmail.trim() || undefined, addPhone: edit.addPhone.trim() || undefined,
      emailToken: editEmailToken || undefined, phoneToken: editPhoneToken || undefined,
    }));
  };

  const setAsHead = async (m: Member) => {
    setMenuEl(null);
    call(() => api.post(`/societies/household/${m._id}/set-head`), 'Head of household updated');
  };
  const removeMember = async (m: Member) => {
    setMenuEl(null);
    if (m.isOwner) return showToast('Use “Sell / Transfer” to change ownership.', 'warning');
    const ok = await confirm({ title: 'Remove member', message: `Remove ${m.name} from this flat? Their access will be revoked.`, confirmText: 'Remove', severity: 'error' });
    if (!ok) return;
    try { await api.delete(`/societies/household/${m._id}`); showToast('Member removed', 'success'); fetchData(); }
    catch (err: any) { showToast(err.response?.data?.error || 'Failed to remove', 'error'); }
  };

  const openDoc = (m: Member) => { setDocTarget(m); setMenuEl(null); setDialog('doc'); };
  const submitDoc = async () => {
    if (!docTarget) return;
    if (!docLabel.trim()) return showToast('Give the document a label', 'error');
    if (!docFile) return showToast('Choose a file to upload', 'error');
    setSubmitting(true);
    try {
      const fd = new FormData(); fd.append('file', docFile);
      const up = await api.post('/upload/document', fd);
      await api.post(`/societies/household/${docTarget._id}/documents`, { label: docLabel, kind: docKind, key: up.data.key, url: up.data.url });
      showToast('Document added', 'success'); closeDialog(); fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Upload failed', 'error');
    } finally { setSubmitting(false); }
  };
  const downloadDoc = async (residentId: string, docId: string) => {
    try { const res = await api.get(`/societies/household/${residentId}/documents/${docId}/download`); window.open(res.data.url, '_blank'); }
    catch { showToast('Failed to open document', 'error'); }
  };

  const submitTenancyDoc = async () => {
    if (!tDocLabel.trim()) return showToast('Give the document a label', 'error');
    if (!tDocFile) return showToast('Choose a file to upload', 'error');
    setSubmitting(true);
    try {
      const fd = new FormData(); fd.append('file', tDocFile);
      const up = await api.post('/upload/document', fd);
      await api.post(`/societies/flats/${flatId}/tenancy/documents`, { label: tDocLabel, kind: tDocKind, key: up.data.key, url: up.data.url });
      showToast('Tenancy document added', 'success'); closeDialog(); fetchData();
    } catch (err: any) { showToast(err.response?.data?.error || 'Upload failed', 'error'); }
    finally { setSubmitting(false); }
  };
  const downloadTenancyDoc = async (docId: string) => {
    try { const res = await api.get(`/societies/flats/${flatId}/tenancy/documents/${docId}/download`); window.open(res.data.url, '_blank'); }
    catch { showToast('Failed to open document', 'error'); }
  };

  // ── Lifecycle actions (history) ─────────────────────────────────────────────────────
  const submitHistory = () => {
    if (!hist.partyName.trim() || !hist.startDate) return showToast('Party name and start date are required', 'error');
    call(() => api.post(`/societies/flats/${flatId}/tenures`, {
      type: hist.type, partyName: hist.partyName, startDate: hist.startDate, endDate: hist.endDate || undefined,
      saleAmount: hist.saleAmount ? Number(hist.saleAmount) : undefined,
      rentAmount: hist.rentAmount ? Number(hist.rentAmount) : undefined,
      notes: hist.notes || undefined,
    }), 'Historical record added');
  };

  if (loading) return <BrandLoader variant="inline" label="Loading flat…" />;
  if (!flat) return <div className="text-center py-20 text-slate-500">Flat not found.</div>;

  const status = flat.status;
  const active = members.filter((m) => m.isActive);
  const inactive = members.filter((m) => !m.isActive);
  const ownerHousehold = active.filter((m) => m.householdType !== 'TENANT');
  const tenantHousehold = active.filter((m) => m.householdType === 'TENANT');
  const head = active.find((m) => m.isHead);
  const money2 = (p?: number) => (p || p === 0) ? `₹${(p / 100).toLocaleString('en-IN')}` : '—';

  const isAdmin = activeProfile?.role === 'SOCIETY_ADMIN' || activeProfile?.role === 'SOCIETY_COMMITTEE';
  const canManage = !isAdmin;
  const canSell = !isAdmin || !flat.ownerUserId;

  const actionBtn = (label: string, icon: React.ReactNode, onClick: () => void, color = 'primary') => (
    <Button variant="outlined" size="small" startIcon={icon} onClick={onClick} color={color as any} sx={{ textTransform: 'none', borderRadius: 2 }}>{label}</Button>
  );

  const MemberCard = (m: Member) => (
    <div className={`rounded-2xl border p-4 flex items-start gap-3 ${m.isHead ? 'border-violet-200 bg-violet-50/40' : m.isActive ? 'border-slate-200/70 bg-white' : 'border-slate-200/60 bg-slate-50/60 opacity-80'}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${m.isOwner ? 'bg-blue-100 text-blue-700' : m.isHead ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>
        {m.isOwner ? <ShieldCheck className="w-5 h-5" /> : m.isHead ? <Crown className="w-5 h-5" /> : <CircleUser className="w-5 h-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-800 truncate">{m.name}</span>
          {m.isOwner && <Chip size="small" color="primary" label="Owner" sx={{ height: 18, fontSize: 10, fontWeight: 700 }} />}
          {m.isHead && <Chip size="small" label="Head" icon={<Crown className="w-3 h-3" />} sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: '#ede9fe', color: '#6d28d9' }} />}
          <Chip size="small" variant="outlined" label={cap(m.relationship)} sx={{ height: 18, fontSize: 10 }} />
          {!m.isActive && <Chip size="small" label="Inactive" sx={{ height: 18, fontSize: 10, bgcolor: '#f1f5f9', color: '#64748b' }} />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-slate-500">
          {m.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {m.email}</span>}
          {m.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {m.phone}</span>}
          {m.moveInDate && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Since {fmtDate(m.moveInDate)}</span>}
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <Chip size="small" label={m.loginStatus === 'LOGIN' ? 'Login enabled' : 'No login (data only)'}
            sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: m.loginStatus === 'LOGIN' ? '#dcfce7' : '#f1f5f9', color: m.loginStatus === 'LOGIN' ? '#15803d' : '#64748b' }} />
          {m.documents.length > 0 && (
            <button onClick={() => downloadDoc(m.documents[0].residentId, m.documents[0]._id)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline">
              <FileText className="w-3 h-3" /> {m.documents.length} document{m.documents.length > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>
      {canManage && <IconButton size="small" onClick={(e) => { setMenuEl(e.currentTarget); setMenuFor(m); }}><MoreVertical className="w-4 h-4" /></IconButton>}
    </div>
  );

  // Merged, date-sorted activity feed (tenure period cards + point events).
  const feed = [
    ...timeline.map((t) => ({ kind: 'tenure' as const, at: t.startDate, t })),
    ...events.map((e) => ({ kind: 'event' as const, at: e.createdAt, e })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <IconButton onClick={() => router.push('/dashboard/flats')} className="bg-white shadow-sm border border-slate-200"><ArrowLeft className="w-5 h-5 text-slate-700" /></IconButton>
        <div className="flex-1">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Flat {flat.number}</h1>
          <p className="text-sm text-slate-500">{flat.blockName} Block</p>
        </div>
        <Chip label={status.replace('_', ' ')} color={status === 'RENTED' ? 'warning' : status === 'OWNER_OCCUPIED' ? 'success' : 'default'} />
      </div>

      {/* Lifecycle actions */}
      <div className="flex flex-wrap gap-2">
        <FlatLifecycleManager ref={lifecycleRef} flatId={flat._id} flatStatus={status} onComplete={fetchData} canManage={canManage} canSell={canSell} variant="button" />
      </div>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={0} className="border border-slate-200/60 rounded-2xl h-full">
            <CardContent className="space-y-4">
              <Typography variant="h6" className="font-bold text-slate-800">Flat Details</Typography>
              <div>
                <Typography variant="caption" className="text-slate-400 font-bold uppercase tracking-wider">Address</Typography>
                <Typography variant="body2" className="mt-1 font-medium">{flat.fullAddress || '-'}</Typography>
              </div>
              <div>
                <Typography variant="caption" className="text-slate-400 font-bold uppercase tracking-wider">Primary Owner</Typography>
                <Typography variant="body2" className="mt-1 font-semibold">{flat.ownerUserId?.name || 'Vacant'}</Typography>
                {flat.ownerUserId && <Typography variant="caption" className="text-slate-500">{flat.ownerUserId.email}</Typography>}
              </div>
              <div>
                <Typography variant="caption" className="text-slate-400 font-bold uppercase tracking-wider">Head of Household</Typography>
                <Typography variant="body2" className="mt-1 font-semibold">{head?.name || '—'}</Typography>
              </div>
              <Divider />
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Active members</span>
                <span className="font-bold text-slate-800">{active.length}</span>
              </div>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tab value="household" label={`Household (${active.length})`} icon={<Users className="w-4 h-4" />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700, minHeight: 48 }} />
            <Tab value="tenancy" label={`Tenancy${tenancy ? ' •' : ''}`} icon={<KeyRound className="w-4 h-4" />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700, minHeight: 48 }} />
            <Tab value="timeline" label={`Timeline (${feed.length})`} icon={<Activity className="w-4 h-4" />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700, minHeight: 48 }} />
          </Tabs>

          {tab === 'household' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Owner household ({ownerHousehold.length})</p>
                {canManage && <Button variant="contained" size="small" onClick={() => openAddMember('OWNER')} startIcon={<UserPlus className="w-4 h-4" />} sx={{ backgroundColor: '#0a5bd7', '&:hover': { backgroundColor: '#094cb0' } }}>Add Member</Button>}
              </div>
              {ownerHousehold.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">No owner-household members.</p>}
              {ownerHousehold.map((m) => <div key={m._id}>{MemberCard(m)}</div>)}

              {tenantHousehold.length > 0 && (
                <>
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider pt-3 flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> Current tenant household ({tenantHousehold.length})</p>
                  {tenantHousehold.map((m) => <div key={m._id}>{MemberCard(m)}</div>)}
                </>
              )}
              {active.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-14 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-400"><Users className="w-6 h-6" /></div>
                  <div>
                    <p className="text-slate-700 font-bold text-sm">No household members yet</p>
                    <p className="text-slate-400 text-xs">Add family members or rent the flat out to a tenant.</p>
                  </div>
                </div>
              )}
              {inactive.length > 0 && (
                <>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider pt-3">Past / moved out ({inactive.length})</p>
                  {inactive.map((m) => <div key={m._id}>{MemberCard(m)}</div>)}
                </>
              )}
            </div>
          )}

          {tab === 'tenancy' && (
            <div className="space-y-4">
              {!tenancy ? (
                <div className="flex flex-col items-center gap-3 py-14 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-400"><KeyRound className="w-6 h-6" /></div>
                  <div>
                    <p className="text-slate-700 font-bold text-sm">This flat is not rented</p>
                    <p className="text-slate-400 text-xs">Use “Rent Out” to move a tenant in. The owner household stays as owner of record.</p>
                  </div>
                  {canManage && status !== 'RENTED' && <Button variant="contained" startIcon={<KeyRound className="w-4 h-4" />} onClick={() => lifecycleRef.current?.openAction('rent')} sx={{ backgroundColor: '#0a5bd7', mt: 1 }}>Rent Out</Button>}
                </div>
              ) : (
                <>
                  {/* Agreement summary */}
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center"><KeyRound className="w-5 h-5" /></div>
                          <div>
                            <p className="font-black text-slate-800">{tenancy.party.name}</p>
                            <p className="text-xs text-slate-500">Current tenant · since {fmtDate(tenancy.startDate)}</p>
                          </div>
                        </div>
                      </div>
                      {canManage && <Button size="small" variant="outlined" color="warning" startIcon={<DoorOpen className="w-4 h-4" />} onClick={() => lifecycleRef.current?.openAction('endTenancy')} sx={{ textTransform: 'none' }}>End Tenancy</Button>}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                      <div><p className="text-[10px] text-slate-400 font-bold uppercase">Monthly rent</p><p className="font-bold text-slate-800">{money2(tenancy.rentAmountPaise)}</p></div>
                      <div><p className="text-[10px] text-slate-400 font-bold uppercase">Deposit</p><p className="font-bold text-slate-800">{money2(tenancy.securityDepositPaise)}</p></div>
                      <div><p className="text-[10px] text-slate-400 font-bold uppercase">Agreement till</p><p className="font-bold text-slate-800">{fmtDate(tenancy.endDate)}</p></div>
                      <div><p className="text-[10px] text-slate-400 font-bold uppercase">Household</p><p className="font-bold text-slate-800">{tenantHousehold.length} member{tenantHousehold.length !== 1 ? 's' : ''}</p></div>
                    </div>
                  </div>

                  {/* Tenancy documents */}
                  <div className="rounded-2xl border border-slate-200/70 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tenancy documents</p>
                      {canManage && <Button size="small" startIcon={<Upload className="w-4 h-4" />} onClick={() => setDialog('tenancyDoc')} sx={{ textTransform: 'none' }}>Upload</Button>}
                    </div>
                    {tenancy.documents.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">No documents yet — add the rental agreement, tenant KYC, or police verification.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {tenancy.documents.map((d) => (
                          <button key={d._id} onClick={() => downloadTenancyDoc(d._id)} className="flex items-center gap-2 text-sm text-indigo-600 hover:underline">
                            <FileText className="w-3.5 h-3.5" /> {d.label} <span className="text-[10px] text-slate-400">· {d.kind.replace(/_/g, ' ').toLowerCase()}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tenant household */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tenant household</p>
                      {canManage && <Button size="small" variant="outlined" startIcon={<UserPlus className="w-4 h-4" />} onClick={() => openAddMember('TENANT')} sx={{ textTransform: 'none' }}>Add tenant member</Button>}
                    </div>
                    <div className="space-y-2">
                      {tenantHousehold.map((m) => <div key={m._id}>{MemberCard(m)}</div>)}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'timeline' && (
            <div className="space-y-3">
              {feed.length === 0 && <p className="text-sm text-slate-400 py-8 text-center">No history yet.</p>}
              {feed.map((item) => item.kind === 'tenure' ? (
                <div key={`t-${item.t._id}`} className={`rounded-2xl border p-4 ${item.t.status === 'ACTIVE' ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200/70'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${TENURE_META[item.t.type].tone}`}>{TENURE_META[item.t.type].icon}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{item.t.party.name}</span>
                          {item.t.status === 'ACTIVE' && <Chip size="small" color="success" label="Current" sx={{ height: 18, fontSize: 10 }} />}
                          {item.t.source === 'MIGRATION' && <Chip size="small" variant="outlined" label="Historical" sx={{ height: 18, fontSize: 10 }} />}
                        </div>
                        <span className="text-xs text-slate-500">{TENURE_META[item.t.type].label}</span>
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      {fmtDate(item.t.startDate)} — {fmtDate(item.t.endDate)}
                      {(item.t.saleAmountPaise || item.t.rentAmountPaise) ? (
                        <div className="font-bold text-slate-700 mt-0.5">{money(item.t.saleAmountPaise) || `${money(item.t.rentAmountPaise)}/mo`}</div>
                      ) : null}
                    </div>
                  </div>
                  {item.t.occupants?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pl-11">
                      {item.t.occupants.map((o, i) => <span key={i} className="text-[11px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{o.name} · {o.relationship.toLowerCase()}</span>)}
                    </div>
                  )}
                  {item.t.notes && <p className="text-xs text-slate-400 mt-2 pl-11 italic">{item.t.notes}</p>}
                </div>
              ) : (
                <div key={`e-${item.e._id}`} className="flex items-start gap-3 px-1 py-1.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${EVENT_TONE[item.e.type] || 'bg-slate-100 text-slate-500'}`}>
                    <Activity className="w-3.5 h-3.5" />
                  </div>
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

      {/* Row action menu */}
      <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
        {menuFor && !menuFor.isHead && menuFor.isActive && <MenuItem onClick={() => setAsHead(menuFor)}><Crown className="w-4 h-4 mr-2 text-violet-600" /> Set as head</MenuItem>}
        {menuFor && <MenuItem onClick={() => openEdit(menuFor)}><Pencil className="w-4 h-4 mr-2 text-slate-600" /> Edit</MenuItem>}
        {menuFor && <MenuItem onClick={() => openDoc(menuFor)}><Upload className="w-4 h-4 mr-2 text-indigo-600" /> Add document</MenuItem>}
        {menuFor && !menuFor.isOwner && <MenuItem onClick={() => removeMember(menuFor)} sx={{ color: '#e11d48' }}><Trash2 className="w-4 h-4 mr-2" /> Remove</MenuItem>}
      </Menu>

      {/* Add member */}
      <Dialog open={dialog === 'add'} onClose={closeDialog} maxWidth="sm" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold border-b border-slate-100">Add {add.householdType === 'TENANT' ? 'Tenant Household' : 'Household'} Member</DialogTitle>
        <DialogContent className="pt-6 space-y-4">
          {add.householdType === 'TENANT' && <div className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 -mt-1">Adding to the current tenant household</div>}
          <p className="text-xs text-slate-500">Leave email & phone empty to add a <strong>data-only</strong> member (no login). Any contact you enter must be OTP-verified — the person gets passwordless login access.</p>
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
            <TextField label="Email (optional)" fullWidth size="small" type="email" value={add.email} onChange={(e) => { setAdd({ ...add, email: e.target.value }); setAddEmailToken(null); }} />
            {add.email.trim() && <OtpVerifyField channel="EMAIL" target={add.email} purpose="FLAT_REGISTRATION" onVerified={setAddEmailToken} onReset={() => setAddEmailToken(null)} />}
          </div>
          <div>
            <TextField label="Phone (optional)" fullWidth size="small" value={add.phone} onChange={(e) => { setAdd({ ...add, phone: e.target.value }); setAddPhoneToken(null); }} />
            {add.phone.trim() && <OtpVerifyField channel="PHONE" target={add.phone} purpose="FLAT_REGISTRATION" onVerified={setAddPhoneToken} onReset={() => setAddPhoneToken(null)} />}
          </div>
          <FormControlLabel control={<Switch checked={add.isHead} onChange={(e) => setAdd({ ...add, isHead: e.target.checked })} />} label="Set as head of household" />
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100">
          <Button onClick={closeDialog} className="text-slate-600">Cancel</Button>
          <Button onClick={submitAdd} variant="contained" disabled={submitting} sx={{ backgroundColor: '#0a5bd7' }}>{submitting ? <CircularProgress size={22} color="inherit" /> : 'Add Member'}</Button>
        </DialogActions>
      </Dialog>

      {/* Edit member */}
      <Dialog open={dialog === 'edit'} onClose={closeDialog} maxWidth="sm" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold border-b border-slate-100">Edit {editTarget?.name}</DialogTitle>
        <DialogContent className="pt-6 space-y-4">
          <div className="flex gap-2">
            <FormControl fullWidth size="small"><InputLabel>Relationship</InputLabel>
              <Select value={edit.relationship} label="Relationship" onChange={(e) => setEdit({ ...edit, relationship: e.target.value })}>
                {(editTarget?.isOwner ? ['OWNER'] : ALL_RELATIONS).map((r) => <MenuItem key={r} value={r}>{cap(r)}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label="Move-in date" type="date" fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} value={edit.moveInDate} onChange={(e) => setEdit({ ...edit, moveInDate: e.target.value })} />
          </div>
          {!editTarget?.isOwner && (
            <FormControlLabel control={<Switch checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} />} label={edit.isActive ? 'Active' : 'Inactive (moved out)'} />
          )}
          {editTarget?.loginStatus === 'DATA_ONLY' && (
            <div className="rounded-xl bg-blue-50/60 border border-blue-100 p-3 space-y-3">
              <p className="text-xs font-semibold text-blue-800">This member has no login. Add a verified contact to grant passwordless access.</p>
              <div>
                <TextField label="Add email" fullWidth size="small" type="email" value={edit.addEmail} onChange={(e) => { setEdit({ ...edit, addEmail: e.target.value }); setEditEmailToken(null); }} />
                {edit.addEmail.trim() && <OtpVerifyField channel="EMAIL" target={edit.addEmail} purpose="FLAT_REGISTRATION" onVerified={setEditEmailToken} onReset={() => setEditEmailToken(null)} />}
              </div>
              <div>
                <TextField label="Add phone" fullWidth size="small" value={edit.addPhone} onChange={(e) => { setEdit({ ...edit, addPhone: e.target.value }); setEditPhoneToken(null); }} />
                {edit.addPhone.trim() && <OtpVerifyField channel="PHONE" target={edit.addPhone} purpose="FLAT_REGISTRATION" onVerified={setEditPhoneToken} onReset={() => setEditPhoneToken(null)} />}
              </div>
            </div>
          )}
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100">
          <Button onClick={closeDialog} className="text-slate-600">Cancel</Button>
          <Button onClick={submitEdit} variant="contained" disabled={submitting} sx={{ backgroundColor: '#0a5bd7' }}>{submitting ? <CircularProgress size={22} color="inherit" /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      {/* Add document */}
      <Dialog open={dialog === 'doc'} onClose={closeDialog} maxWidth="xs" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold border-b border-slate-100">Add document — {docTarget?.name}</DialogTitle>
        <DialogContent className="pt-6 space-y-4">
          <FormControl fullWidth size="small"><InputLabel>Type</InputLabel>
            <Select value={docKind} label="Type" onChange={(e) => setDocKind(e.target.value)}>
              {['ID_PROOF', 'AGREEMENT', 'POLICE_VERIFICATION', 'OTHER'].map((k) => <MenuItem key={k} value={k}>{k.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Label" fullWidth size="small" value={docLabel} onChange={(e) => setDocLabel(e.target.value)} placeholder="e.g. Aadhaar card" />
          <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
          <Button variant="outlined" fullWidth startIcon={<Upload className="w-4 h-4" />} onClick={() => fileRef.current?.click()} sx={{ textTransform: 'none' }}>
            {docFile ? docFile.name : 'Choose PDF or image'}
          </Button>
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100">
          <Button onClick={closeDialog} className="text-slate-600">Cancel</Button>
          <Button onClick={submitDoc} variant="contained" disabled={submitting} sx={{ backgroundColor: '#0a5bd7' }}>{submitting ? <CircularProgress size={22} color="inherit" /> : 'Upload'}</Button>
        </DialogActions>
      </Dialog>

      {/* Tenancy document */}
      <Dialog open={dialog === 'tenancyDoc'} onClose={closeDialog} maxWidth="xs" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold border-b border-slate-100">Add tenancy document</DialogTitle>
        <DialogContent className="pt-6 space-y-4">
          <FormControl fullWidth size="small"><InputLabel>Type</InputLabel>
            <Select value={tDocKind} label="Type" onChange={(e) => setTDocKind(e.target.value)}>
              {['AGREEMENT', 'POLICE_VERIFICATION', 'TENANT_KYC', 'OTHER'].map((k) => <MenuItem key={k} value={k}>{k.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Label" fullWidth size="small" value={tDocLabel} onChange={(e) => setTDocLabel(e.target.value)} placeholder="e.g. Registered rental agreement" />
          <input ref={tFileRef} type="file" accept="application/pdf,image/*" hidden onChange={(e) => setTDocFile(e.target.files?.[0] || null)} />
          <Button variant="outlined" fullWidth startIcon={<Upload className="w-4 h-4" />} onClick={() => tFileRef.current?.click()} sx={{ textTransform: 'none' }}>
            {tDocFile ? tDocFile.name : 'Choose PDF or image'}
          </Button>
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100">
          <Button onClick={closeDialog} className="text-slate-600">Cancel</Button>
          <Button onClick={submitTenancyDoc} variant="contained" disabled={submitting} sx={{ backgroundColor: '#0a5bd7' }}>{submitting ? <CircularProgress size={22} color="inherit" /> : 'Upload'}</Button>
        </DialogActions>
      </Dialog>

      {/* Add historical record */}
      <Dialog open={dialog === 'history'} onClose={closeDialog} maxWidth="sm" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold border-b border-slate-100">Add Historical Record</DialogTitle>
        <DialogContent className="pt-6 space-y-4">
          <p className="text-xs text-slate-500 -mt-1">Record a past ownership or tenancy period. This only fills in the timeline — it does not change current access.</p>
          <div className="flex gap-2">
            <FormControl fullWidth size="small"><InputLabel>Type</InputLabel>
              <Select value={hist.type} label="Type" onChange={(e) => setHist({ ...hist, type: e.target.value })}>
                <MenuItem value="OWNERSHIP">Ownership</MenuItem>
                <MenuItem value="TENANCY">Tenancy</MenuItem>
                <MenuItem value="OWNER_OCCUPANCY">Owner occupancy</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Party Name" fullWidth size="small" value={hist.partyName} onChange={(e) => setHist({ ...hist, partyName: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <TextField label="Start" type="date" fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} value={hist.startDate} onChange={(e) => setHist({ ...hist, startDate: e.target.value })} />
            <TextField label="End" type="date" fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} value={hist.endDate} onChange={(e) => setHist({ ...hist, endDate: e.target.value })} />
          </div>
          <div className="flex gap-2">
            {hist.type === 'OWNERSHIP'
              ? <TextField label="Sale Amount (₹)" type="number" fullWidth size="small" value={hist.saleAmount} onChange={(e) => setHist({ ...hist, saleAmount: e.target.value })} />
              : <TextField label="Monthly Rent (₹)" type="number" fullWidth size="small" value={hist.rentAmount} onChange={(e) => setHist({ ...hist, rentAmount: e.target.value })} />}
          </div>
          <TextField label="Notes" fullWidth size="small" multiline minRows={2} value={hist.notes} onChange={(e) => setHist({ ...hist, notes: e.target.value })} />
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100">
          <Button onClick={closeDialog} className="text-slate-600">Cancel</Button>
          <Button onClick={submitHistory} variant="contained" disabled={submitting} sx={{ backgroundColor: '#0a5bd7' }}>{submitting ? <CircularProgress size={22} color="inherit" /> : 'Add Record'}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
