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
import { useToastConfirm } from '@/context/ToastConfirmContext';

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
    } catch { setAssignments([]); }
  };

  const add = async () => {
    setSaving(true);
    try {
      const res = await api.post('/staff', form);
      showToast(res.data?.message || 'Added', 'success');
      setAddOpen(false);
      setForm({ name: '', phone: '', designation: 'SECURITY_GUARD', employmentType: 'DIRECT' });
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not add them', 'error');
    } finally { setSaving(false); }
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

  if (loading) return <div className="flex justify-center py-24"><CircularProgress /></div>;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">Staff</h1>
          <p className="text-sm text-slate-600 mt-1">
            Who works here, and which wing each looks after.
          </p>
        </div>
        <Button variant="contained" startIcon={<Plus className="w-4 h-4" />}
          onClick={() => setAddOpen(true)} className="!rounded-xl !normal-case !font-bold shrink-0">
          Add someone
        </Button>
      </div>

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

      <div className="flex gap-2 items-center flex-wrap">
        <TextField size="small" placeholder="Name, phone, code…" value={q}
          onChange={e => setQ(e.target.value)} className="flex-1 min-w-56"
          slotProps={{ input: { className: '!rounded-xl', startAdornment: <Search className="w-4 h-4 text-slate-400 mr-2" /> } }} />
        <ToggleButtonGroup exclusive size="small" value={showLeft ? 'all' : 'active'}
          onChange={(_, v) => v && setShowLeft(v === 'all')}>
          <ToggleButton value="active" className="!rounded-l-xl !normal-case !text-xs !font-bold !px-3">Current</ToggleButton>
          <ToggleButton value="all" className="!rounded-r-xl !normal-case !text-xs !font-bold !px-3">Everyone</ToggleButton>
        </ToggleButtonGroup>
      </div>

      {/* --------------------------------------------------------- the list */}
      {shown.length === 0 ? (
        <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-10 text-center">
          <Users className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="mt-3 font-bold text-slate-700">Nobody here yet</p>
        </Paper>
      ) : (
        <div className="grid gap-2">
          {shown.map(s => (
            <Paper key={s._id} elevation={0}
              onClick={() => openDetail(s)}
              className={`rounded-2xl border p-3 flex items-center gap-3 cursor-pointer hover:border-slate-300 ${s.isActive ? 'border-slate-200/70' : 'border-slate-200/70 opacity-60'}`}>
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                <span className="text-xs font-black text-slate-500">{s.person.name.slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-slate-800 truncate">{s.person.name}</p>
                  {!s.isActive && <Chip size="small" label="Left" className="!bg-slate-200 !text-slate-600 !font-bold !text-[10px] !h-4" />}
                </div>
                <p className="text-xs text-slate-500">
                  {s.staffCode} · {pretty(s.designation)}
                  {s.vendorName && ` · ${s.vendorName}`}
                </p>
              </div>
              <span className="text-[10px] font-bold text-slate-400 shrink-0 hidden sm:block">
                {TYPE_LABEL[s.employmentType]}
              </span>
            </Paper>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------ add */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth="xs"
        slotProps={{ paper: { className: '!rounded-2xl' } }}>
        <DialogTitle className="!font-black !text-slate-900">Add someone</DialogTitle>
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
          <FormControl fullWidth size="small">
            <InputLabel>How they are engaged</InputLabel>
            <Select label="How they are engaged" value={form.employmentType}
              onChange={e => setForm({ ...form, employmentType: e.target.value, vendorId: '' })}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </Select>
          </FormControl>
          {form.employmentType === 'AGENCY' && (
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
            {saving ? 'Adding…' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ------------------------------------------------------- assignments */}
      <Dialog open={!!detailOf} onClose={() => setDetailOf(null)} fullWidth maxWidth="sm"
        slotProps={{ paper: { className: '!rounded-2xl' } }}>
        <DialogTitle className="!font-black !text-slate-900">
          {detailOf?.person.name}
          <span className="block text-xs font-normal text-slate-500 mt-0.5">
            {detailOf?.staffCode} · {detailOf && pretty(detailOf.designation)}
          </span>
        </DialogTitle>
        <DialogContent dividers className="space-y-4">
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
