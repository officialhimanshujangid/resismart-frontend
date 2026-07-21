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
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import PageHeader from '@/components/common/PageHeader';

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
  person: { name: string; phone: string; email?: string };
  designation: string;
  employmentType: 'DIRECT' | 'AGENCY' | 'CONTRACT';
  vendorName?: string;
  isActive: boolean;
  joinedOn: string;
  leftOn?: string;
  accessRoleId?: string;
  userId?: string;
  verification?: { policeVerifiedOn?: string; expiresOn?: string };
}
interface Assignment {
  _id: string; staffName: string; scope: string;
  blockId?: string; blockName?: string; categories: string[];
  rank: 'PRIMARY' | 'BACKUP'; isActive: boolean;
}
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
      setAssignments(res.data?.data?.assignments || []);
      // The list row does not carry userId; the full record does. Refresh from
      // it so the login section knows whether they can already sign in.
      if (res.data?.data?.staff) setDetailOf(res.data.data.staff);
    } catch { setAssignments([]); }
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
      if (form._id) {
        const { _id, employmentType, vendorId, ...editable } = form;
        const res = await api.put(`/staff/${_id}`, editable);
        showToast(res.data?.message || 'Saved', 'success');
      } else {
        const res = await api.post('/staff', form);
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
      verification: { expiresOn: s.verification?.expiresOn ? s.verification.expiresOn.slice(0, 10) : '' },
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
              {!s.isActive && <Chip size="small" label="Left" className="!bg-slate-200 !text-slate-600 !font-bold !text-[10px] !h-4" />}
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
        ? <Chip size="small" label="Has one" className="!bg-emerald-50 !text-emerald-700 !font-bold !text-[10px]" />
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

  if (loading) return <div className="flex justify-center py-24"><CircularProgress /></div>;

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
              onClick={() => router.push('/dashboard/staff/coverage')}
              className="!rounded-xl !normal-case !font-bold">Who covers what</Button>
            <Button variant="contained" startIcon={<Plus className="w-4 h-4" />}
              onClick={() => setAddOpen(true)} className="!rounded-xl !normal-case !font-bold">
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
                    className="!bg-white !border !border-amber-300 !text-amber-900 !font-semibold !text-[11px]" />
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
              slotProps={{ input: { className: '!rounded-xl', startAdornment: <Search className="w-4 h-4 text-slate-400 mr-2" /> } }} />
            <ToggleButtonGroup exclusive size="small" value={showLeft ? 'all' : 'active'}
              onChange={(_, v) => v && setShowLeft(v === 'all')}>
              <ToggleButton value="active" className="!rounded-l-xl !normal-case !text-xs !font-bold !px-3">Current</ToggleButton>
              <ToggleButton value="all" className="!rounded-r-xl !normal-case !text-xs !font-bold !px-3">Everyone</ToggleButton>
            </ToggleButtonGroup>
          </>
        }
      />

      {/* ------------------------------------------------------------ add */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs"
        slotProps={{ paper: { className: '!rounded-2xl' } }}>
        <DialogTitle className="!font-black !text-slate-900">
          {form._id ? `Edit ${form.name}` : 'Add someone'}
        </DialogTitle>
        <DialogContent dividers className="space-y-3">
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
          <TextField fullWidth size="small" type="date" label="Police verification expires"
            value={form.verification?.expiresOn || ''}
            onChange={e => setForm({ ...form, verification: { ...form.verification, expiresOn: e.target.value } })}
            slotProps={{ inputLabel: { shrink: true } }}
            helperText="Optional, but a verification with no end date cannot be chased." />
        </DialogContent>
        <DialogActions className="!px-6 !py-3">
          <Button onClick={() => setAddOpen(false)} className="!normal-case !font-bold">Cancel</Button>
          <Button variant="contained" onClick={add} disabled={saving || !form.name || !form.phone}
            className="!rounded-xl !normal-case !font-bold">
            {saving ? 'Saving…' : form._id ? 'Save' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ------------------------------------------------------- assignments */}
      <Dialog open={!!detailOf} onClose={() => setDetailOf(null)} fullWidth maxWidth="sm"
        slotProps={{ paper: { className: '!rounded-2xl' } }}>
        <DialogTitle className="!font-black !text-slate-900 flex items-start justify-between gap-3">
          <span>
            {detailOf?.person.name}
            <span className="block text-xs font-normal text-slate-500 mt-0.5">
              {detailOf?.staffCode} · {detailOf && pretty(detailOf.designation)} · {detailOf?.person.phone}
            </span>
          </span>
          {detailOf?.isActive && (
            <Button size="small" variant="outlined" onClick={() => openEdit(detailOf)}
              className="!rounded-xl !normal-case !font-bold !text-xs shrink-0">Edit details</Button>
          )}
        </DialogTitle>
        <DialogContent dividers className="space-y-4">
          {/* Login — the thing that makes their access role and notifications
              actually work. Without it, a role is set and never takes effect. */}
          {detailOf?.isActive && (
            <div className="rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3">
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
              {!detailOf?.userId && (
                <Button size="small" variant="outlined" onClick={() => giveLogin(detailOf!)}
                  className="!rounded-xl !normal-case !font-bold !text-xs shrink-0">
                  Give login
                </Button>
              )}
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
                          className={`!ml-1.5 !h-4 !text-[9px] !font-bold ${a.rank === 'PRIMARY' ? '!bg-indigo-50 !text-indigo-700' : '!bg-slate-100 !text-slate-500'}`} />
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
                  <Select value={assignForm.scope} className="!rounded-xl"
                    onChange={e => setAssignForm({ ...assignForm, scope: e.target.value, blockId: '' })}>
                    <MenuItem value="BLOCK">One wing</MenuItem>
                    <MenuItem value="SOCIETY">Everywhere</MenuItem>
                  </Select>
                </FormControl>
                {assignForm.scope === 'BLOCK' && (
                  <FormControl size="small" className="flex-1">
                    <Select displayEmpty value={assignForm.blockId} className="!rounded-xl"
                      onChange={e => setAssignForm({ ...assignForm, blockId: e.target.value })}>
                      <MenuItem value="" disabled><em className="text-slate-400">Which wing</em></MenuItem>
                      {look?.blocks.map(b => <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                )}
                <FormControl size="small" className="w-28">
                  <Select value={assignForm.rank} className="!rounded-xl"
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
                      className={`!font-bold !text-[11px] !cursor-pointer ${on ? '!bg-indigo-600 !text-white' : '!bg-white !border !border-slate-200 !text-slate-500'}`} />
                  );
                })}
              </div>
              <Button size="small" variant="outlined" fullWidth onClick={addAssignment}
                disabled={!assignForm.categories.length || (assignForm.scope === 'BLOCK' && !assignForm.blockId)}
                className="!rounded-xl !normal-case !font-bold !text-xs">
                Add
              </Button>
            </div>
          )}

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-600 leading-relaxed">
              There is no salary here on purpose — we do not compute anyone&apos;s wages.
              Record what you paid them through <strong>Expenses</strong>, tagging the line
              with their name.
            </p>
          </div>
        </DialogContent>
        <DialogActions className="!px-6 !py-3 !justify-between">
          {detailOf?.isActive ? (
            <Button color="error" startIcon={<UserMinus className="w-4 h-4" />}
              onClick={() => detailOf && end(detailOf)} className="!normal-case !font-bold">
              They have left
            </Button>
          ) : <span />}
          <Button onClick={() => setDetailOf(null)} className="!normal-case !font-bold">Close</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
