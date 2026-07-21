'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, TextField, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, Chip, Autocomplete, ToggleButton,
  ToggleButtonGroup, IconButton, InputLabel,
} from '@mui/material';
import {
  Plus, Users, Search, ShieldAlert, Building2, Trash2, UserMinus, Info, Wrench,
  FileText, Upload, Download, Camera, CalendarClock, CalendarOff, KeyRound, RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import PageHeader from '@/components/common/PageHeader';
import PageSkeleton from '@/components/common/PageSkeleton';

/**
 * The society's own staff.
 *
 * Two things this screen is built around:
 *
 * 1. **No payroll.** There is no salary field anywhere, because we do not
 *    compute anyone's wages. What it does carry is the roll — which is what
 *    lets somebody say "you billed for four guards and three are on the list".
 *
 * 2. **Assignments, not just a list.** Who covers which wing for which kind of
 *    work is the thing complaints route on, and it is the one part of this no
 *    competitor models at all.
 */

interface Staff {
  _id: string;
  staffCode: string;
  person: { name: string; phone: string; email?: string; hasPhoto?: boolean };
  designation: string;
  employmentType: 'DIRECT' | 'AGENCY' | 'CONTRACT';
  vendorName?: string;
  isActive: boolean;
  joinedOn: string;
  leftOn?: string;
  accessRoleId?: string;
  userId?: string;
  verification?: { policeVerifiedOn?: string; expiresOn?: string; verifiedBy?: string; hasDocument?: boolean };
  emergencyContact?: { name?: string; phone?: string; relation?: string };
  /** Earlier stretches of employment, kept when somebody is taken back on. */
  spells?: { joinedOn: string; leftOn: string; endedByName?: string }[];
  documents?: StaffDoc[];
}
interface Assignment {
  _id: string; staffName: string; scope: string;
  blockId?: string; blockName?: string; categories: string[];
  rank: 'PRIMARY' | 'BACKUP'; isActive: boolean;
}
/** No S3 key ever reaches the browser — downloads go through a signed URL. */
interface StaffDoc { _id: string; name: string; uploadedAt: string; uploadedByName: string }
interface Shift { _id: string; weekday: number; from: string; to: string }
interface Leave { _id: string; from: string; to: string; kind: string; reason?: string }
interface Lookups {
  blocks: { _id: string; name: string }[];
  vendors: { _id: string; name: string }[];
  roles: { _id: string; name: string }[];
  designations: string[];
  categories: string[];
}
interface Headcount { vendorId: string; vendorName: string; active: number; leftThisMonth: number }

const pretty = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());
const TYPE_LABEL: Record<string, string> = {
  DIRECT: 'Employed by us', AGENCY: 'Through an agency', CONTRACT: 'On contract',
};
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Appendix A rule 2 — never show the stored value. */
const LEAVE_LABEL: Record<string, string> = {
  LEAVE: 'On leave', SICK: 'Unwell', WEEKLY_OFF: 'Weekly off', OTHER: 'Away',
};
const onDate = (s?: string) => (s ? new Date(s).toLocaleDateString('en-IN') : '');
/** The theme covers Button, Chip, Dialog and the inputs; ToggleButton it does not. */
const TOGGLE_SX = { borderRadius: '12px', textTransform: 'none', fontSize: 12, fontWeight: 700, px: 1.5 } as const;

export default function StaffPage() {
  const { showToast, confirm } = useToastConfirm();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [look, setLook] = useState<Lookups | null>(null);
  const [alerts, setAlerts] = useState<{ expiring: any[]; headcount: Headcount[] }>({ expiring: [], headcount: [] });
  const [q, setQ] = useState('');
  const [showLeft, setShowLeft] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({ name: '', phone: '', designation: 'SECURITY_GUARD', employmentType: 'DIRECT' });

  const [detailOf, setDetailOf] = useState<Staff | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignForm, setAssignForm] = useState<any>({ scope: 'BLOCK', blockId: '', categories: [], rank: 'PRIMARY' });

  // Everything the drawer needs beyond the record itself. All of this existed
  // on the model and had no screen at all until now.
  const [docs, setDocs] = useState<StaffDoc[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [leave, setLeave] = useState<Leave[]>([]);
  const [onDutyNow, setOnDutyNow] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [shiftForm, setShiftForm] = useState({ weekday: 1, from: '09:00', to: '18:00' });
  const [leaveForm, setLeaveForm] = useState({ from: '', to: '', kind: 'LEAVE', reason: '' });

  const load = async () => {
    try {
      const [s, a] = await Promise.all([
        api.get(`/staff?active=${showLeft ? 'all' : 'true'}`),
        api.get('/staff/alerts').catch(() => ({ data: { data: { expiring: [], headcount: [] } } })),
      ]);
      setStaff(s.data?.data?.staff || []);
      setLook({
        blocks: s.data?.data?.blocks || [], vendors: s.data?.data?.vendors || [],
        roles: s.data?.data?.roles || [], designations: s.data?.data?.designations || [],
        categories: s.data?.data?.categories || [],
      });
      setAlerts(a.data?.data || { expiring: [], headcount: [] });
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not load staff', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [showLeft]);

  const openDetail = async (s: Staff) => {
    setDetailOf(s);
    try {
      const res = await api.get(`/staff/${s._id}`);
      const d = res.data?.data || {};
      setAssignments(d.assignments || []);
      setShifts(d.shifts || []);
      setLeave(d.leave || []);
      setDocs(d.staff?.documents || []);
      setOnDutyNow(typeof d.onDutyNow === 'boolean' ? d.onDutyNow : null);
      // The list row does not carry userId; the full record does. Refresh from
      // it so the login section knows whether they can already sign in.
      if (d.staff) setDetailOf(d.staff);
    } catch {
      setAssignments([]); setShifts([]); setLeave([]); setDocs([]); setOnDutyNow(null);
    }
  };

  /**
   * Add or edit — one dialog, because they are the same form.
   *
   * `PUT /staff/:id` shipped complete with no caller anywhere, so a phone
   * number typed wrong on the day somebody joined stayed wrong forever, and a
   * police verification could never be renewed. The presence of `_id` decides
   * which verb goes out; the update schema takes a subset of the create one, so
   * the extra keys are sent only on create.
   */
  const add = async () => {
    setSaving(true);
    try {
      /**
       * Drop the empty boxes before sending.
       *
       * The server validates dates with `new Date(v)`, and `new Date('')` is
       * not a date — so an untouched "Police check expires" field made the
       * whole save fail with a message about a field the person never filled
       * in. Blank means "not answered", which is different from "answered with
       * nothing" and must not reach the wire at all.
       */
      const clean = (o: any) => {
        const out: any = {};
        for (const [k, v] of Object.entries(o || {})) if (v !== '' && v !== undefined && v !== null) out[k] = v;
        return Object.keys(out).length ? out : undefined;
      };
      const payload = {
        ...form,
        verification: clean(form.verification),
        emergencyContact: clean(form.emergencyContact),
      };
      if (payload.verification === undefined) delete payload.verification;
      if (payload.emergencyContact === undefined) delete payload.emergencyContact;
      // "No login" is an empty select, which is not an id. On an edit that
      // means "take the role away" and is sent as null; on a create it simply
      // is not sent.
      if (payload.accessRoleId === '') {
        if (form._id) payload.accessRoleId = null; else delete payload.accessRoleId;
      }
      if (payload.vendorId === '') delete payload.vendorId;

      if (form._id) {
        const { _id, employmentType, vendorId, ...editable } = payload;
        const res = await api.put(`/staff/${_id}`, editable);
        showToast(res.data?.message || 'Saved', 'success');
      } else {
        const res = await api.post('/staff', payload);
        showToast(res.data?.message || 'Added', 'success');
      }
      setAddOpen(false);
      setForm({ name: '', phone: '', designation: 'SECURITY_GUARD', employmentType: 'DIRECT' });
      await load();
      if (detailOf) setDetailOf(null);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not save that', 'error');
    } finally { setSaving(false); }
  };

  const openEdit = (s: Staff) => {
    setForm({
      _id: s._id,
      name: s.person.name, phone: s.person.phone, email: s.person.email || '',
      designation: s.designation,
      employmentType: s.employmentType,
      accessRoleId: s.accessRoleId || '',
      verification: {
        expiresOn: s.verification?.expiresOn ? s.verification.expiresOn.slice(0, 10) : '',
        policeVerifiedOn: s.verification?.policeVerifiedOn ? s.verification.policeVerifiedOn.slice(0, 10) : '',
        verifiedBy: s.verification?.verifiedBy || '',
      },
      emergencyContact: {
        name: s.emergencyContact?.name || '',
        phone: s.emergencyContact?.phone || '',
        relation: s.emergencyContact?.relation || '',
      },
    });
    setAddOpen(true);
  };

  const end = async (s: Staff) => {
    const yes = await confirm({
      title: `${s.person.name} has left?`,
      message: 'Their record stays — their name is on months of history — but they stop being sent work from today.',
      confirmText: 'They have left', severity: 'warning',
    });
    if (!yes) return;
    try {
      await api.post(`/staff/${s._id}/end`, {});
      showToast(`${s.person.name} marked as left`, 'success');
      setDetailOf(null);
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not do that', 'error');
    }
  };

  const giveLogin = async (s: Staff) => {
    const yes = await confirm({
      title: `Give ${s.person.name} a login?`,
      message: 'They will be able to sign in to see their assigned work and be notified. A one-time password is shown next — write it down, it is not stored.',
      confirmText: 'Create login',
    });
    if (!yes) return;
    try {
      const res = await api.post(`/staff/${s._id}/login`, {});
      // The password is shown once, in the toast, because there is no SMS to
      // send it through. Kept up long enough to write down.
      showToast(res.data?.message || 'Login created', 'success');
      setDetailOf(res.data?.data?.staff || detailOf);
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not create that login', 'error');
    }
  };

  /**
   * Bring somebody back onto the roll.
   *
   * A separate action from "Add someone" on purpose. Adding them again would
   * mint a second `SF/xxxx`, split their complaint history across two codes and
   * count them twice against the agency's bill — which is the one number this
   * whole module exists to get right.
   */
  const rehire = async (s: Staff) => {
    const yes = await confirm({
      title: `${s.person.name} is back?`,
      message: 'Their old record is reopened, so their staff number, their papers and their police check come back with them. Nothing is created twice.',
      confirmText: 'They are back',
    });
    if (!yes) return;
    try {
      const res = await api.post(`/staff/${s._id}/reinstate`, {});
      showToast(res.data?.message || 'Back on the roll', 'success');
      setDetailOf(null);
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not bring them back', 'error');
    }
  };

  const revokeLogin = async (s: Staff) => {
    const yes = await confirm({
      title: `Stop ${s.person.name} signing in?`,
      message: 'They stay on the roll and keep their work — they simply cannot sign in, and their phone stops receiving this society\'s alerts. You can give them a login again later.',
      confirmText: 'Take the login away', severity: 'warning',
    });
    if (!yes) return;
    try {
      const res = await api.post(`/staff/${s._id}/login/revoke`, {});
      showToast(res.data?.message || 'Login taken away', 'success');
      await openDetail(s);
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not take that login away', 'error');
    }
  };

  const resetPassword = async (s: Staff) => {
    const yes = await confirm({
      title: `New password for ${s.person.name}?`,
      message: 'Their old password stops working straight away. The new one is shown once — write it down before closing the message.',
      confirmText: 'Reset it',
    });
    if (!yes) return;
    try {
      const res = await api.post(`/staff/${s._id}/login/reset`, {});
      // Shown once, in the toast, for the same reason the first password is:
      // there is no SMS gateway to send it through.
      showToast(res.data?.message || 'Password reset', 'success');
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not reset that password', 'error');
    }
  };

  /**
   * Papers.
   *
   * Two steps, exactly as flat documents do it: the bytes go to the shared
   * private uploader, and only the reference it hands back is attached to the
   * person. A failed attach therefore never leaves a record pointing at a file
   * that was never stored.
   */
  const uploadDoc = async (file: File) => {
    if (!detailOf) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await api.post('/upload/staff-document', fd);
      await api.post(`/staff/${detailOf._id}/documents`, { name: file.name, key: up.data.key, url: up.data.url });
      showToast('Document filed', 'success');
      await openDetail(detailOf);
    } catch (e: any) {
      showToast(e.response?.data?.message || e.response?.data?.error || 'Could not file that document', 'error');
    } finally { setBusy(false); }
  };

  const openSigned = async (url: string, whatFailed: string) => {
    try {
      const res = await api.get(url);
      if (res.data?.data?.url) window.open(res.data.data.url, '_blank');
      else showToast(whatFailed, 'error');
    } catch (e: any) {
      showToast(e.response?.data?.message || whatFailed, 'error');
    }
  };

  const removeDoc = async (d: StaffDoc) => {
    if (!detailOf) return;
    const yes = await confirm({
      title: `Remove ${d.name}?`,
      message: 'It stops being listed against this person. Keep a copy elsewhere if it is the only one.',
      confirmText: 'Remove', severity: 'warning',
    });
    if (!yes) return;
    try {
      await api.delete(`/staff/${detailOf._id}/documents/${d._id}`);
      await openDetail(detailOf);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not remove that document', 'error');
    }
  };

  /**
   * The scan behind the police verification.
   *
   * `verification.documentKey` was writable and readable by nothing, so the
   * date on the record had no paper behind it — a tick with nothing to show,
   * which reads as an answer and stops the committee asking.
   */
  const uploadVerification = async (file: File) => {
    if (!detailOf) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await api.post('/upload/staff-document', fd);
      await api.put(`/staff/${detailOf._id}`, { verification: { documentKey: up.data.key } });
      showToast('Police verification filed', 'success');
      await openDetail(detailOf);
    } catch (e: any) {
      showToast(e.response?.data?.message || e.response?.data?.error || 'Could not file that', 'error');
    } finally { setBusy(false); }
  };

  const uploadPhoto = async (file: File) => {
    if (!detailOf) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await api.post('/upload/staff-photo', fd);
      await api.put(`/staff/${detailOf._id}`, { photoKey: up.data.key });
      showToast('Photograph saved', 'success');
      await openDetail(detailOf);
    } catch (e: any) {
      showToast(e.response?.data?.message || e.response?.data?.error || 'Could not save that photograph', 'error');
    } finally { setBusy(false); }
  };

  // --------------------------------------------------------- rota and leave
  const addShift = async () => {
    if (!detailOf) return;
    try {
      await api.post(`/staff/${detailOf._id}/shifts`, shiftForm);
      await openDetail(detailOf);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not save those hours', 'error');
    }
  };

  const removeShiftRow = async (id: string) => {
    if (!detailOf) return;
    try {
      await api.delete(`/staff/shifts/${id}`);
      await openDetail(detailOf);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not remove those hours', 'error');
    }
  };

  const addLeave = async () => {
    if (!detailOf) return;
    try {
      await api.post(`/staff/${detailOf._id}/leave`, leaveForm);
      setLeaveForm({ from: '', to: '', kind: 'LEAVE', reason: '' });
      await openDetail(detailOf);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not record that', 'error');
    }
  };

  const cancelLeave = async (id: string) => {
    if (!detailOf) return;
    try {
      await api.delete(`/staff/leave/${id}`);
      await openDetail(detailOf);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not cancel that', 'error');
    }
  };

  const addAssignment = async () => {
    if (!detailOf) return;
    try {
      await api.post('/staff/assignments', { ...assignForm, staffId: detailOf._id });
      showToast('Assignment saved', 'success');
      setAssignForm({ scope: 'BLOCK', blockId: '', categories: [], rank: 'PRIMARY' });
      await openDetail(detailOf);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not save that', 'error');
    }
  };

  const removeAssignment = async (id: string) => {
    if (!detailOf) return;
    try {
      await api.delete(`/staff/assignments/${id}`);
      await openDetail(detailOf);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not remove that', 'error');
    }
  };

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return staff;
    return staff.filter(s =>
      s.person.name.toLowerCase().includes(t) ||
      s.person.phone.includes(t) ||
      s.staffCode.toLowerCase().includes(t));
  }, [staff, q]);

  const staffColumns: ColumnDef<Staff>[] = [
    {
      id: 'name', label: 'Name', alwaysVisible: true,
      sortValue: s => s.person.name,
      exportValue: s => s.person.name,
      render: s => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.isActive ? 'bg-slate-100' : 'bg-slate-50'}`}>
            <span className="text-xs font-black text-slate-500">{s.person.name.slice(0, 2).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className={`font-bold truncate ${s.isActive ? 'text-slate-800' : 'text-slate-400'}`}>{s.person.name}</p>
              {/* Colour through `sx`, not Tailwind: Emotion injects MUI's own
                  styles after Tailwind's layer, so a class here loses and comes
                  back as `!important`. Same rule StatusChip documents. */}
              {!s.isActive && <Chip size="small" label="Left" sx={{ bgcolor: '#e2e8f0', color: '#475569', height: 18, fontSize: 10 }} />}
            </div>
            <p className="text-[11px] text-slate-400 font-mono">{s.staffCode}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'designation', label: 'Job',
      sortValue: s => pretty(s.designation),
      exportValue: s => pretty(s.designation),
      render: s => <span className="text-sm text-slate-700">{pretty(s.designation)}</span>,
    },
    {
      id: 'phone', label: 'Phone',
      sortValue: s => s.person.phone,
      exportValue: s => s.person.phone,
      render: s => <span className="text-sm text-slate-600 tabular-nums">{s.person.phone}</span>,
    },
    {
      id: 'type', label: 'Employed',
      sortValue: s => TYPE_LABEL[s.employmentType] || s.employmentType,
      exportValue: s => `${TYPE_LABEL[s.employmentType]}${s.vendorName ? ` (${s.vendorName})` : ''}`,
      render: s => (
        <div className="min-w-0">
          <p className="text-sm text-slate-600">{TYPE_LABEL[s.employmentType]}</p>
          {s.vendorName && <p className="text-[11px] text-slate-400 truncate">{s.vendorName}</p>}
        </div>
      ),
    },
    {
      id: 'login', label: 'Login', align: 'center',
      sortValue: s => (s.userId ? 'Yes' : 'No'),
      exportValue: s => (s.userId ? 'Yes' : 'No'),
      render: s => s.userId
        ? <Chip size="small" label="Has one" sx={{ bgcolor: '#ecfdf5', color: '#047857', fontSize: 10 }} />
        : <span className="text-[11px] text-slate-300">—</span>,
    },
    {
      id: 'verified', label: 'Police check', defaultHidden: true,
      // The date, not a tick: a verification that lapsed two years ago reads
      // exactly like one that never happened, and sorting on it is how a
      // committee finds the lapsed ones.
      sortValue: s => s.verification?.expiresOn || '',
      exportValue: s => s.verification?.expiresOn
        ? new Date(s.verification.expiresOn).toLocaleDateString('en-IN') : 'not done',
      render: s => s.verification?.expiresOn
        ? <span className={`text-[11px] font-semibold ${new Date(s.verification.expiresOn) < new Date() ? 'text-rose-600' : 'text-slate-500'}`}>
            till {new Date(s.verification.expiresOn).toLocaleDateString('en-IN')}
          </span>
        : <span className="text-[11px] text-slate-300">not done</span>,
    },
    {
      id: 'joined', label: 'Joined', defaultHidden: true,
      sortValue: s => s.joinedOn || '',
      exportValue: s => s.joinedOn ? new Date(s.joinedOn).toLocaleDateString('en-IN') : '',
      render: s => (
        <span className="text-[11px] text-slate-500">
          {s.joinedOn ? new Date(s.joinedOn).toLocaleDateString('en-IN') : '—'}
        </span>
      ),
    },
  ];

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        breadcrumb="Operations · Staff"
        title="Staff"
        icon={<Users className="w-4.5 h-4.5" />}
        subtitle="Who works here, and which wing each looks after. No salaries are held — this is the roll, which is what lets you say the agency billed for four guards and three are on the list."
        actions={
          <>
            <Button variant="outlined" startIcon={<Wrench className="w-4 h-4" />}
              onClick={() => router.push('/dashboard/staff/coverage')}>Who covers what</Button>
            <Button variant="contained" startIcon={<Plus className="w-4 h-4" />}
              onClick={() => setAddOpen(true)}>
              Add someone
            </Button>
          </>
        }
      />

      {/* -------------------------------------------------- the agency check */}
      {alerts.headcount.length > 0 && (
        <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-slate-500" />
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
              On the roll, by agency
            </span>
          </div>
          <div className="grid gap-2">
            {alerts.headcount.map(h => (
              <div key={h.vendorId} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 font-medium">{h.vendorName}</span>
                <span className="text-slate-600">
                  <strong>{h.active}</strong> on site
                  {h.leftThisMonth > 0 && <span className="text-amber-700"> · {h.leftThisMonth} left this month</span>}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed">
            Check this against the agency&apos;s bill before you pay it. This is the one number
            nothing else in the system can tell you.
          </p>
        </Paper>
      )}

      {alerts.expiring.length > 0 && (
        <Paper elevation={0} className="rounded-2xl border border-amber-300 bg-amber-50/60 p-4">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-slate-800 text-sm">Police verification running out</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {alerts.expiring.map((s: any) => (
                  <Chip key={s._id} size="small"
                    label={`${s.person.name} · ${new Date(s.verification.expiresOn).toLocaleDateString('en-IN')}`}
                    sx={{ bgcolor: '#fff', border: '1px solid #fcd34d', color: '#78350f', fontSize: 11 }} />
                ))}
              </div>
              <p className="text-[11px] text-amber-800 mt-2">
                A verification that lapsed two years ago reads exactly like one that never happened.
              </p>
            </div>
          </div>
        </Paper>
      )}

      {/* --------------------------------------------------------- the list */}
      <DataTable
        columns={staffColumns}
        data={shown}
        keyExtractor={s => s._id}
        onRowClick={openDetail}
        exportFileName="staff-roll"
        columnToggle
        emptyTitle="Nobody here yet"
        emptyText="Add the people who work here — guards, cleaners, the plumber you call — so complaints can reach them."
        emptyIcon={<Users className="w-6 h-6" />}
        toolbar={
          <>
            <TextField size="small" placeholder="Name, phone, code…" value={q}
              onChange={e => setQ(e.target.value)} className="min-w-[240px]"
              slotProps={{ input: { startAdornment: <Search className="w-4 h-4 text-slate-400 mr-2" /> } }} />
            <ToggleButtonGroup exclusive size="small" value={showLeft ? 'all' : 'active'}
              onChange={(_, v) => v && setShowLeft(v === 'all')}>
              {/* MUI leaves ToggleButton uppercase and square-cornered, and the
                  theme has no override for it — so the shape is stated in the
                  component's own system rather than shouted at from Tailwind. */}
              <ToggleButton value="active" sx={TOGGLE_SX}>Current</ToggleButton>
              <ToggleButton value="all" sx={TOGGLE_SX}>Everyone</ToggleButton>
            </ToggleButtonGroup>
          </>
        }
      />

      {/* ------------------------------------------------------------ add */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs"
      >
        <DialogTitle className="font-black text-slate-900">
          {form._id ? `Edit ${form.name}` : 'Add someone'}
        </DialogTitle>
        <DialogContent dividers className="flex flex-col gap-4 pt-2">
          <TextField autoFocus fullWidth size="small" label="Name" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} />
          <TextField fullWidth size="small" label="Phone" value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })} />
          <FormControl fullWidth size="small">
            <InputLabel>Job</InputLabel>
            <Select label="Job" value={form.designation}
              onChange={e => setForm({ ...form, designation: e.target.value })}>
              {look?.designations.map(d => <MenuItem key={d} value={d}>{pretty(d)}</MenuItem>)}
            </Select>
          </FormControl>
          {/* How somebody is engaged, and through which agency, is not editable
              once they are on the roll: it is what the agency headcount check
              counts, and quietly moving a person between agencies would rewrite
              last month's bill comparison. End their employment and add them
              afresh instead. */}
          <FormControl fullWidth size="small" disabled={!!form._id}>
            <InputLabel>How they are engaged</InputLabel>
            <Select label="How they are engaged" value={form.employmentType}
              onChange={e => setForm({ ...form, employmentType: e.target.value, vendorId: '' })}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </Select>
          </FormControl>
          {form.employmentType === 'AGENCY' && !form._id && (
            <FormControl fullWidth size="small">
              <InputLabel>Which agency</InputLabel>
              <Select label="Which agency" value={form.vendorId || ''}
                onChange={e => setForm({ ...form, vendorId: e.target.value })}>
                {look?.vendors.map(v => <MenuItem key={v._id} value={v._id}>{v.name}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          <FormControl fullWidth size="small">
            <InputLabel>Access (optional)</InputLabel>
            <Select label="Access (optional)" value={form.accessRoleId || ''}
              onChange={e => setForm({ ...form, accessRoleId: e.target.value })}>
              <MenuItem value=""><em className="text-slate-400">No login</em></MenuItem>
              {look?.roles.map(r => <MenuItem key={r._id} value={r._id}>{r.name}</MenuItem>)}
            </Select>
          </FormControl>
          <div className="flex gap-3">
            <TextField fullWidth size="small" type="date" label="Police check done on"
              value={form.verification?.policeVerifiedOn || ''}
              onChange={e => setForm({ ...form, verification: { ...form.verification, policeVerifiedOn: e.target.value } })}
              slotProps={{ inputLabel: { shrink: true } }} />
            <TextField fullWidth size="small" type="date" label="Police check expires"
              value={form.verification?.expiresOn || ''}
              onChange={e => setForm({ ...form, verification: { ...form.verification, expiresOn: e.target.value } })}
              slotProps={{ inputLabel: { shrink: true } }} />
          </div>
          <TextField fullWidth size="small" label="Police check done by"
            value={form.verification?.verifiedBy || ''}
            onChange={e => setForm({ ...form, verification: { ...form.verification, verifiedBy: e.target.value } })}
            helperText="The station or agency. An end date with nobody's name behind it cannot be chased." />

          {/* Emergency contact. Declared on the record from the start and
              writable by nothing — so when somebody collapsed on shift there
              was a field for who to call and never anybody in it. */}
          <div className="flex gap-3">
            <TextField fullWidth size="small" label="In an emergency, call"
              value={form.emergencyContact?.name || ''}
              onChange={e => setForm({ ...form, emergencyContact: { ...form.emergencyContact, name: e.target.value } })} />
            <TextField fullWidth size="small" label="Their number"
              value={form.emergencyContact?.phone || ''}
              onChange={e => setForm({ ...form, emergencyContact: { ...form.emergencyContact, phone: e.target.value } })} />
          </div>
          <TextField fullWidth size="small" label="Who they are to them"
            value={form.emergencyContact?.relation || ''}
            onChange={e => setForm({ ...form, emergencyContact: { ...form.emergencyContact, relation: e.target.value } })}
            helperText="Wife, brother, son — whatever a person would actually say." />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={add} disabled={saving || !form.name || !form.phone}>
            {saving ? 'Saving…' : form._id ? 'Save' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ------------------------------------------------------- assignments */}
      <Dialog open={!!detailOf} onClose={() => setDetailOf(null)} fullWidth maxWidth="sm"
      >
        <DialogTitle className="font-black text-slate-900 flex items-start justify-between gap-3">
          <span>
            {detailOf?.person.name}
            <span className="block text-xs font-normal text-slate-500 mt-0.5">
              {detailOf?.staffCode} · {detailOf && pretty(detailOf.designation)} · {detailOf?.person.phone}
            </span>
          </span>
          {detailOf?.isActive && (
            <Button size="small" variant="outlined" onClick={() => openEdit(detailOf)}
              sx={{ flexShrink: 0 }}>Edit details</Button>
          )}
        </DialogTitle>
        <DialogContent dividers className="flex flex-col gap-4 pt-2">
          {/* -------------------------------------------------- they have left */}
          {detailOf && !detailOf.isActive && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-700">
                  Left on {onDate(detailOf.leftOn)}
                </p>
                <p className="text-[11px] text-slate-500">
                  If they come back, reopen this record — adding them again would give them a
                  second staff number and count them twice against the agency&apos;s bill.
                </p>
              </div>
              <Button size="small" variant="outlined" startIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => rehire(detailOf)} sx={{ flexShrink: 0 }}>
                They are back
              </Button>
            </div>
          )}

          {/* Earlier stretches — the history a second record would have split. */}
          {!!detailOf?.spells?.length && (
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                Earlier with us
              </p>
              <div className="grid gap-0.5">
                {detailOf.spells.map((sp, i) => (
                  <p key={i} className="text-[11px] text-slate-600">
                    {onDate(sp.joinedOn)} to {onDate(sp.leftOn)}
                    {sp.endedByName ? ` · recorded by ${sp.endedByName}` : ''}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Login — the thing that makes their access role and notifications
              actually work. Without it, a role is set and never takes effect. */}
          {detailOf?.isActive && (
            <div className="rounded-xl border border-slate-200 p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-700">
                  {detailOf?.userId ? 'Can sign in' : 'No login yet'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {detailOf?.userId
                    ? 'Their access role and notifications are live.'
                    : 'Without a login their access role does nothing and they get no alerts.'}
                </p>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                {!detailOf?.userId ? (
                  <Button size="small" variant="outlined" onClick={() => giveLogin(detailOf!)}>
                    Give login
                  </Button>
                ) : (
                  <>
                    {/* Neither of these ends employment. Somebody under
                        investigation should lose their login and keep their
                        job; somebody who lost the slip of paper should get a
                        new password, not a new staff record. */}
                    <Button size="small" variant="outlined" startIcon={<KeyRound className="w-3.5 h-3.5" />}
                      onClick={() => resetPassword(detailOf)}>
                      New password
                    </Button>
                    <Button size="small" variant="outlined" color="error"
                      onClick={() => revokeLogin(detailOf)}>
                      Stop them signing in
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ------------------------------------------------- police check */}
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Police check
              </span>
            </div>
            <p className="text-xs text-slate-700">
              {detailOf?.verification?.expiresOn
                ? <>Good until <strong>{onDate(detailOf.verification.expiresOn)}</strong>
                  {detailOf.verification.verifiedBy ? ` · done by ${detailOf.verification.verifiedBy}` : ''}</>
                : 'No date recorded. Use “Edit details” to add one.'}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {detailOf?.verification?.hasDocument ? (
                <Button size="small" variant="outlined" startIcon={<Download className="w-3.5 h-3.5" />}
                  onClick={() => openSigned(`/staff/${detailOf._id}/verification/download`, 'Could not open that scan')}>
                  See the scan
                </Button>
              ) : (
                <span className="text-[11px] text-amber-700">
                  No scan filed — a date with no paper behind it reads as an answer when it is not.
                </span>
              )}
              {detailOf?.isActive && (
                <Button size="small" component="label" variant="text" disabled={busy}
                  startIcon={<Upload className="w-3.5 h-3.5" />}>
                  {detailOf?.verification?.hasDocument ? 'Replace scan' : 'Attach scan'}
                  <input hidden type="file" accept="application/pdf,image/*"
                    onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadVerification(f); }} />
                </Button>
              )}
            </div>
          </div>

          {/* --------------------------------------------- photo and papers */}
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Papers and photograph
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              {detailOf?.person?.hasPhoto ? (
                <Button size="small" variant="outlined" startIcon={<Camera className="w-3.5 h-3.5" />}
                  onClick={() => openSigned(`/staff/${detailOf._id}/photo`, 'Could not open that photograph')}>
                  See photograph
                </Button>
              ) : (
                <span className="text-[11px] text-slate-500">No photograph yet.</span>
              )}
              {detailOf?.isActive && (
                <Button size="small" component="label" variant="text" disabled={busy}
                  startIcon={<Upload className="w-3.5 h-3.5" />}>
                  {detailOf?.person?.hasPhoto ? 'Replace photograph' : 'Add photograph'}
                  <input hidden type="file" accept="image/*"
                    onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadPhoto(f); }} />
                </Button>
              )}
            </div>

            {docs.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">
                Nothing filed yet — ID proof, the agency&apos;s letter, a contract.
              </p>
            ) : (
              <div className="grid gap-1.5">
                {docs.map(d => (
                  <div key={d._id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 font-medium truncate">{d.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {onDate(d.uploadedAt)} · {d.uploadedByName}
                      </p>
                    </div>
                    <IconButton size="small" title="Open"
                      onClick={() => openSigned(`/staff/${detailOf!._id}/documents/${d._id}/download`, 'Could not open that document')}>
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                    </IconButton>
                    {detailOf?.isActive && (
                      <IconButton size="small" title="Remove" onClick={() => removeDoc(d)}>
                        <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                      </IconButton>
                    )}
                  </div>
                ))}
              </div>
            )}

            {detailOf?.isActive && (
              <Button size="small" component="label" variant="outlined" fullWidth disabled={busy}
                startIcon={<Upload className="w-3.5 h-3.5" />} sx={{ mt: 1.5 }}>
                {busy ? 'Uploading…' : 'File a document'}
                <input hidden type="file" accept="application/pdf,image/*"
                  onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadDoc(f); }} />
              </Button>
            )}
          </div>

          {/* ----------------------------------------- emergency contact */}
          {detailOf?.emergencyContact?.name && (
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                Who to call in an emergency
              </p>
              <p className="text-sm text-slate-700">
                {detailOf.emergencyContact.name}
                {detailOf.emergencyContact.relation ? ` (${detailOf.emergencyContact.relation})` : ''}
                {detailOf.emergencyContact.phone ? ` · ${detailOf.emergencyContact.phone}` : ''}
              </p>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Covers</span>
            </div>
            {assignments.filter(a => a.isActive).length === 0 ? (
              <p className="text-xs text-slate-500 italic">Nothing yet — they will not be sent any work.</p>
            ) : (
              <div className="grid gap-1.5">
                {assignments.filter(a => a.isActive).map(a => (
                  <div key={a._id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 font-medium">
                        {a.scope === 'SOCIETY' ? 'Whole society' : a.blockName}
                        <Chip size="small" label={a.rank === 'PRIMARY' ? 'first' : 'backup'}
                          sx={{
                            ml: 1, height: 18, fontSize: 10,
                            ...(a.rank === 'PRIMARY'
                              ? { bgcolor: '#eef2ff', color: '#4338ca' }
                              : { bgcolor: '#f1f5f9', color: '#64748b' }),
                          }} />
                      </p>
                      <p className="text-[11px] text-slate-500">{a.categories.map(pretty).join(', ')}</p>
                    </div>
                    <IconButton size="small" onClick={() => removeAssignment(a._id)}>
                      <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                    </IconButton>
                  </div>
                ))}
              </div>
            )}
          </div>

          {detailOf?.isActive && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2.5">
              <p className="text-xs font-bold text-slate-600">Give them something to cover</p>
              <div className="flex gap-2">
                <FormControl size="small" className="w-32">
                  <Select value={assignForm.scope}
                    onChange={e => setAssignForm({ ...assignForm, scope: e.target.value, blockId: '' })}>
                    <MenuItem value="BLOCK">One wing</MenuItem>
                    <MenuItem value="SOCIETY">Everywhere</MenuItem>
                  </Select>
                </FormControl>
                {assignForm.scope === 'BLOCK' && (
                  <FormControl size="small" className="flex-1">
                    <Select displayEmpty value={assignForm.blockId}
                      onChange={e => setAssignForm({ ...assignForm, blockId: e.target.value })}>
                      <MenuItem value="" disabled><em className="text-slate-400">Which wing</em></MenuItem>
                      {look?.blocks.map(b => <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                )}
                <FormControl size="small" className="w-28">
                  <Select value={assignForm.rank}
                    onChange={e => setAssignForm({ ...assignForm, rank: e.target.value })}>
                    <MenuItem value="PRIMARY">First</MenuItem>
                    <MenuItem value="BACKUP">Backup</MenuItem>
                  </Select>
                </FormControl>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {look?.categories.map(c => {
                  const on = assignForm.categories.includes(c);
                  return (
                    <Chip key={c} size="small" label={pretty(c)}
                      onClick={() => setAssignForm({
                        ...assignForm,
                        categories: on ? assignForm.categories.filter((x: string) => x !== c) : [...assignForm.categories, c],
                      })}
                      sx={{
                        cursor: 'pointer', fontSize: 11,
                        ...(on
                          ? { bgcolor: '#4f46e5', color: '#fff' }
                          : { bgcolor: '#fff', border: '1px solid #e2e8f0', color: '#64748b' }),
                      }} />
                  );
                })}
              </div>
              <Button size="small" variant="outlined" fullWidth onClick={addAssignment}
                disabled={!assignForm.categories.length || (assignForm.scope === 'BLOCK' && !assignForm.blockId)}
              >
                Add
              </Button>
            </div>
          )}

          {/* ---------------------------------------------------- the rota */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Hours they work
                </span>
              </div>
              {onDutyNow !== null && detailOf?.isActive && (
                <Chip size="small" label={onDutyNow ? 'On duty now' : 'Not on duty now'}
                  sx={onDutyNow
                    ? { bgcolor: '#ecfdf5', color: '#047857', fontWeight: 700, fontSize: 10, height: 20 }
                    : { bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 700, fontSize: 10, height: 20 }} />
              )}
            </div>

            {shifts.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No hours set. Work can reach them at any time — which is the right default until
                somebody builds the rota.
              </p>
            ) : (
              <div className="grid gap-1.5">
                {shifts.map(s => (
                  <div key={s._id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 font-medium">{DAYS[s.weekday]}</p>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {s.from}–{s.to}{s.to <= s.from ? ' (through the night)' : ''}
                      </p>
                    </div>
                    {detailOf?.isActive && (
                      <IconButton size="small" onClick={() => removeShiftRow(s._id)}>
                        <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                      </IconButton>
                    )}
                  </div>
                ))}
              </div>
            )}

            {detailOf?.isActive && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mt-2 space-y-2">
                <div className="flex gap-2">
                  <FormControl size="small" className="flex-1">
                    <Select value={shiftForm.weekday}
                      onChange={e => setShiftForm({ ...shiftForm, weekday: Number(e.target.value) })}>
                      {DAYS.map((d, i) => <MenuItem key={d} value={i}>{d}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <TextField size="small" type="time" value={shiftForm.from} className="w-28"
                    onChange={e => setShiftForm({ ...shiftForm, from: e.target.value })} />
                  <TextField size="small" type="time" value={shiftForm.to} className="w-28"
                    onChange={e => setShiftForm({ ...shiftForm, to: e.target.value })} />
                </div>
                <Button size="small" variant="outlined" fullWidth onClick={addShift}>Add these hours</Button>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  An end time earlier than the start means the shift runs through the night —
                  22:00 to 06:00 is a normal guard shift and is understood as one.
                </p>
              </div>
            )}
          </div>

          {/* -------------------------------------------------- days away */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CalendarOff className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Days away
              </span>
            </div>

            {leave.length === 0 ? (
              <p className="text-xs text-slate-500 italic">Nothing recorded.</p>
            ) : (
              <div className="grid gap-1.5">
                {leave.map(l => (
                  <div key={l._id} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 font-medium">
                        {onDate(l.from)} to {onDate(l.to)}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {LEAVE_LABEL[l.kind] || 'Away'}{l.reason ? ` · ${l.reason}` : ''}
                      </p>
                    </div>
                    {detailOf?.isActive && (
                      <IconButton size="small" onClick={() => cancelLeave(l._id)}>
                        <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                      </IconButton>
                    )}
                  </div>
                ))}
              </div>
            )}

            {detailOf?.isActive && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mt-2 space-y-2">
                <div className="flex gap-2">
                  <TextField size="small" type="date" label="First day" className="flex-1"
                    value={leaveForm.from} onChange={e => setLeaveForm({ ...leaveForm, from: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField size="small" type="date" label="Last day" className="flex-1"
                    value={leaveForm.to} onChange={e => setLeaveForm({ ...leaveForm, to: e.target.value })}
                    slotProps={{ inputLabel: { shrink: true } }} />
                </div>
                <FormControl size="small" fullWidth>
                  <Select value={leaveForm.kind}
                    onChange={e => setLeaveForm({ ...leaveForm, kind: e.target.value })}>
                    {Object.entries(LEAVE_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
                <Button size="small" variant="outlined" fullWidth onClick={addLeave}
                  disabled={!leaveForm.from || !leaveForm.to}>
                  Record it
                </Button>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  While they are away, work goes to the backup instead of sitting in their name.
                  Nothing here is an attendance register — this only records what the office
                  already knows in advance.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-600 leading-relaxed">
              There is no salary here on purpose — we do not compute anyone&apos;s wages.
              Record what you paid them through <strong>Expenses</strong>, tagging the line
              with their name.
            </p>
          </div>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          {detailOf?.isActive ? (
            <Button color="error" startIcon={<UserMinus className="w-4 h-4" />}
              onClick={() => detailOf && end(detailOf)}>
              They have left
            </Button>
          ) : <span />}
          <Button onClick={() => setDetailOf(null)} color="inherit">Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
