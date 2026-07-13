'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import BrandLoader from '@/components/common/BrandLoader';
import ModuleScope from '@/components/common/ModuleScope';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, MenuItem, Select, FormControl, InputLabel, Chip, Tabs, Tab,
  IconButton, Menu, Switch, FormControlLabel, Divider,
} from '@mui/material';
import {
  Landmark, Plus, Crown, UserPlus, MoreVertical, Pencil, Trash2, CalendarDays,
  ShieldCheck, Settings2, History as HistoryIcon, Users,
} from 'lucide-react';

interface Designation { _id: string; key: string; label: string; rank: number; isOfficeBearer: boolean; isSystem: boolean; active: boolean; }
interface Member {
  _id: string; userId: string; memberSnapshot: { name: string; flatLabel?: string };
  designationKey: string; designationLabel: string; isOfficeBearer: boolean;
  appointment: string; status: string; startDate: string; endDate?: string | null;
}
interface Committee { _id: string; name: string; termStartDate: string; termEndDate?: string | null; electionDate?: string | null; status: string; }
interface Eligible { userId: string; name: string; flatLabel: string; relationship: string; isOwner: boolean; }

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const today = () => new Date().toISOString().slice(0, 10);
const cap = (s: string) => s ? s[0] + s.slice(1).toLowerCase() : s;

type DialogKind = null | 'start' | 'addMember' | 'editMember' | 'designations';

export default function CommitteePage() {
  const { activeProfile } = useAuth();
  const { showToast, confirm } = useToastConfirm();
  const canManage = activeProfile?.role === 'SOCIETY_ADMIN';

  const [committee, setCommittee] = useState<Committee | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [eligible, setEligible] = useState<Eligible[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'current' | 'history'>('current');

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [submitting, setSubmitting] = useState(false);
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const [menuFor, setMenuFor] = useState<Member | null>(null);

  const [start, setStart] = useState({ name: '', termStartDate: today(), termEndDate: '', electionDate: '', notes: '' });
  const [addM, setAddM] = useState({ userId: '', designationKey: '', appointment: 'ELECTED' });
  const [editM, setEditM] = useState<Member | null>(null);
  const [editDesig, setEditDesig] = useState('');
  const [newDesig, setNewDesig] = useState({ label: '', isOfficeBearer: false });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [cRes, hRes] = await Promise.all([api.get('/committee'), api.get('/committee/history')]);
      setCommittee(cRes.data.committee);
      setMembers(cRes.data.members || []);
      setDesignations(cRes.data.designations || []);
      setHistory(hRes.data.terms || []);
    } catch { showToast('Failed to load committee', 'error'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { fetchData(); }, [fetchData]);

  const loadEligible = async () => {
    try { const r = await api.get('/committee/eligible-members'); setEligible(r.data.members || []); }
    catch { showToast('Failed to load residents', 'error'); }
  };

  const close = () => { setDialog(null); setSubmitting(false); setEditM(null); };
  const call = async (fn: () => Promise<any>) => {
    setSubmitting(true);
    try { const res = await fn(); showToast(res?.data?.message || 'Done', 'success'); close(); fetchData(); }
    catch (err: any) { showToast(err.response?.data?.error || 'Action failed', 'error'); }
    finally { setSubmitting(false); }
  };

  const submitStart = () => {
    if (!start.name.trim()) return showToast('Term name is required', 'error');
    call(() => api.post('/committee', {
      name: start.name, termStartDate: start.termStartDate,
      termEndDate: start.termEndDate || undefined, electionDate: start.electionDate || undefined, notes: start.notes || undefined,
    }));
  };
  const dissolve = async () => {
    if (!committee) return;
    const ok = await confirm({ title: 'Dissolve committee', message: `Dissolve "${committee.name}"? All members are stepped down and their committee access removed. History is kept.`, confirmText: 'Dissolve', severity: 'error' });
    if (!ok) return;
    try { await api.post(`/committee/${committee._id}/dissolve`); showToast('Committee dissolved', 'success'); fetchData(); }
    catch (err: any) { showToast(err.response?.data?.error || 'Failed', 'error'); }
  };
  const openAdd = async () => { setAddM({ userId: '', designationKey: designations[0]?.key || '', appointment: 'ELECTED' }); await loadEligible(); setDialog('addMember'); };
  const submitAdd = () => {
    if (!committee) return;
    if (!addM.userId) return showToast('Choose a resident', 'error');
    if (!addM.designationKey) return showToast('Choose a designation', 'error');
    call(() => api.post(`/committee/${committee._id}/members`, addM));
  };
  const openEdit = (m: Member) => { setEditM(m); setEditDesig(m.designationKey); setMenuEl(null); setDialog('editMember'); };
  const submitEdit = () => { if (!editM) return; call(() => api.put(`/committee/members/${editM._id}`, { designationKey: editDesig })); };
  const removeMember = async (m: Member) => {
    setMenuEl(null);
    const ok = await confirm({ title: 'Remove member', message: `Step down ${m.memberSnapshot.name} from the committee?`, confirmText: 'Remove', severity: 'warning' });
    if (!ok) return;
    try { await api.delete(`/committee/members/${m._id}`); showToast('Member removed', 'success'); fetchData(); }
    catch (err: any) { showToast(err.response?.data?.error || 'Failed', 'error'); }
  };
  const addDesignation = async () => {
    if (!newDesig.label.trim()) return showToast('Label required', 'error');
    try { await api.post('/committee/designations', newDesig); setNewDesig({ label: '', isOfficeBearer: false }); showToast('Added', 'success'); fetchData(); }
    catch (err: any) { showToast(err.response?.data?.error || 'Failed', 'error'); }
  };
  const toggleDesignation = async (d: Designation) => {
    try { await api.put(`/committee/designations/${d._id}`, { active: !d.active }); fetchData(); }
    catch (err: any) { showToast(err.response?.data?.error || 'Failed', 'error'); }
  };

  const officeBearers = members.filter((m) => m.isOfficeBearer);
  const plainMembers = members.filter((m) => !m.isOfficeBearer);

  const memberCols: ColumnDef<Member>[] = [
    { id: 'name', label: 'Member', render: (m) => (
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${m.isOfficeBearer ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'}`}>{m.isOfficeBearer ? <Crown className="w-4 h-4" /> : <Users className="w-4 h-4" />}</div>
        <div><div className="font-semibold text-slate-800">{m.memberSnapshot.name}</div><div className="text-xs text-slate-400">{m.memberSnapshot.flatLabel}</div></div>
      </div>
    ) },
    { id: 'designation', label: 'Designation', render: (m) => <Chip size="small" label={m.designationLabel} color={m.isOfficeBearer ? 'primary' : 'default'} variant={m.isOfficeBearer ? 'filled' : 'outlined'} /> },
    { id: 'appointment', label: 'Appointment', render: (m) => <span className="text-xs text-slate-500">{cap(m.appointment.replace('_', ' '))}</span> },
    { id: 'since', label: 'Since', render: (m) => <span className="text-xs text-slate-500">{fmtDate(m.startDate)}</span> },
    ...(canManage ? [{ id: 'actions', label: '', align: 'right' as const, render: (m: Member) => (
      <IconButton size="small" onClick={(e) => { setMenuEl(e.currentTarget); setMenuFor(m); }}><MoreVertical className="w-4 h-4" /></IconButton>
    ) }] : []),
  ];

  if (loading) return <BrandLoader variant="inline" label="Loading committee…" />;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center"><Landmark className="w-6 h-6 text-[#0a5bd7]" /></div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Managing Committee</h1>
            <p className="text-sm text-slate-500">Office bearers & members of your society</p>
          </div>
        </div>
        <ModuleScope scope="society" />
      </div>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="current" label="Current Committee" icon={<ShieldCheck className="w-4 h-4" />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700, minHeight: 48 }} />
        <Tab value="history" label={`History (${history.length})`} icon={<HistoryIcon className="w-4 h-4" />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700, minHeight: 48 }} />
      </Tabs>

      {tab === 'current' && (!committee ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-center text-slate-400"><Landmark className="w-7 h-7" /></div>
          <div>
            <p className="text-slate-700 font-bold">No active committee</p>
            <p className="text-slate-400 text-sm">{canManage ? 'Start a committee term to add office bearers and members.' : 'Your society admin has not set up a committee yet.'}</p>
          </div>
          {canManage && <Button variant="contained" startIcon={<Plus className="w-4 h-4" />} onClick={() => setDialog('start')} sx={{ backgroundColor: '#0a5bd7', mt: 1 }}>Start Committee Term</Button>}
        </div>
      ) : (
        <div className="space-y-5">
          {/* Term header */}
          <div className="rounded-2xl border border-slate-200/70 bg-white p-5 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-800">{committee.name}</h2>
                <Chip size="small" color="success" label="Active" sx={{ height: 20, fontWeight: 700 }} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Term from {fmtDate(committee.termStartDate)}{committee.termEndDate ? ` to ${fmtDate(committee.termEndDate)}` : ''}</span>
                {committee.electionDate && <span>Elected {fmtDate(committee.electionDate)}</span>}
              </div>
            </div>
            {canManage && (
              <div className="flex gap-2">
                <Button size="small" variant="outlined" startIcon={<Settings2 className="w-4 h-4" />} onClick={() => setDialog('designations')} sx={{ textTransform: 'none' }}>Designations</Button>
                <Button size="small" variant="outlined" color="error" onClick={dissolve} sx={{ textTransform: 'none' }}>Dissolve</Button>
                <Button size="small" variant="contained" startIcon={<UserPlus className="w-4 h-4" />} onClick={openAdd} sx={{ backgroundColor: '#0a5bd7', textTransform: 'none' }}>Add Member</Button>
              </div>
            )}
          </div>

          {/* Office bearers grid */}
          {officeBearers.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Office Bearers</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {officeBearers.map((m) => (
                  <div key={m._id} className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center"><Crown className="w-5 h-5" /></div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 truncate">{m.memberSnapshot.name}</div>
                      <div className="text-xs font-semibold text-violet-700">{m.designationLabel}</div>
                      <div className="text-[11px] text-slate-400">{m.memberSnapshot.flatLabel}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members table */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">All Members ({members.length})</p>
            <DataTable columns={memberCols} data={members} keyExtractor={(m) => m._id} emptyTitle="No members yet" emptyText={canManage ? 'Add committee members to get started.' : 'No members on the committee.'} />
          </div>
        </div>
      ))}

      {tab === 'history' && (
        <div className="space-y-4">
          {history.length === 0 && <p className="text-sm text-slate-400 py-8 text-center">No committee history yet.</p>}
          {history.map((term: any) => (
            <div key={term._id} className="rounded-2xl border border-slate-200/70 bg-white p-5">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-800">{term.name}</h3>
                <Chip size="small" label={term.status} color={term.status === 'ACTIVE' ? 'success' : 'default'} sx={{ height: 18, fontSize: 10 }} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{fmtDate(term.termStartDate)} — {fmtDate(term.termEndDate)}</p>
              <Divider sx={{ my: 1.5 }} />
              <div className="flex flex-wrap gap-2">
                {term.members.map((m: any) => (
                  <span key={m._id} className={`text-xs rounded-full px-2.5 py-1 ${m.status === 'ACTIVE' ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-400 line-through'}`}>
                    {m.memberSnapshot.name} · {m.designationLabel}
                  </span>
                ))}
                {term.members.length === 0 && <span className="text-xs text-slate-400">No members recorded</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Row menu */}
      <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
        {menuFor && <MenuItem onClick={() => openEdit(menuFor)}><Pencil className="w-4 h-4 mr-2 text-slate-600" /> Change designation</MenuItem>}
        {menuFor && <MenuItem onClick={() => removeMember(menuFor)} sx={{ color: '#e11d48' }}><Trash2 className="w-4 h-4 mr-2" /> Step down</MenuItem>}
      </Menu>

      {/* Start term */}
      <Dialog open={dialog === 'start'} onClose={close} maxWidth="sm" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold border-b border-slate-100">Start Committee Term</DialogTitle>
        <DialogContent className="pt-6 space-y-4">
          <TextField autoFocus label="Term name" fullWidth size="small" placeholder="Managing Committee 2026–2031" value={start.name} onChange={(e) => setStart({ ...start, name: e.target.value })} />
          <div className="flex gap-2">
            <TextField label="Term start" type="date" fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} value={start.termStartDate} onChange={(e) => setStart({ ...start, termStartDate: e.target.value })} />
            <TextField label="Term end (optional)" type="date" fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} value={start.termEndDate} onChange={(e) => setStart({ ...start, termEndDate: e.target.value })} />
          </div>
          <TextField label="Election date (optional)" type="date" fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} value={start.electionDate} onChange={(e) => setStart({ ...start, electionDate: e.target.value })} />
          <p className="text-xs text-slate-400">Starting a new term dissolves any current committee (its history is preserved).</p>
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100">
          <Button onClick={close} className="text-slate-600">Cancel</Button>
          <Button onClick={submitStart} variant="contained" disabled={submitting} sx={{ backgroundColor: '#0a5bd7' }}>{submitting ? <CircularProgress size={22} color="inherit" /> : 'Start Term'}</Button>
        </DialogActions>
      </Dialog>

      {/* Add member */}
      <Dialog open={dialog === 'addMember'} onClose={close} maxWidth="sm" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold border-b border-slate-100">Add Committee Member</DialogTitle>
        <DialogContent className="pt-6 space-y-4">
          <FormControl fullWidth size="small"><InputLabel>Resident</InputLabel>
            <Select value={addM.userId} label="Resident" onChange={(e) => setAddM({ ...addM, userId: e.target.value })}>
              {eligible.map((el) => <MenuItem key={el.userId} value={el.userId}>{el.name}{el.flatLabel ? ` — ${el.flatLabel}` : ''}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small"><InputLabel>Designation</InputLabel>
            <Select value={addM.designationKey} label="Designation" onChange={(e) => setAddM({ ...addM, designationKey: e.target.value })}>
              {designations.map((d) => <MenuItem key={d.key} value={d.key}>{d.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small"><InputLabel>Appointment</InputLabel>
            <Select value={addM.appointment} label="Appointment" onChange={(e) => setAddM({ ...addM, appointment: e.target.value })}>
              {['ELECTED', 'CO_OPTED', 'APPOINTED'].map((a) => <MenuItem key={a} value={a}>{cap(a.replace('_', ' '))}</MenuItem>)}
            </Select>
          </FormControl>
          <p className="text-xs text-slate-400">Committee members gain elevated (admin-lite) access to society management.</p>
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100">
          <Button onClick={close} className="text-slate-600">Cancel</Button>
          <Button onClick={submitAdd} variant="contained" disabled={submitting} sx={{ backgroundColor: '#0a5bd7' }}>{submitting ? <CircularProgress size={22} color="inherit" /> : 'Add Member'}</Button>
        </DialogActions>
      </Dialog>

      {/* Edit member designation */}
      <Dialog open={dialog === 'editMember'} onClose={close} maxWidth="xs" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold border-b border-slate-100">Change designation — {editM?.memberSnapshot.name}</DialogTitle>
        <DialogContent className="pt-6">
          <FormControl fullWidth size="small"><InputLabel>Designation</InputLabel>
            <Select value={editDesig} label="Designation" onChange={(e) => setEditDesig(e.target.value)}>
              {designations.map((d) => <MenuItem key={d.key} value={d.key}>{d.label}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100">
          <Button onClick={close} className="text-slate-600">Cancel</Button>
          <Button onClick={submitEdit} variant="contained" disabled={submitting} sx={{ backgroundColor: '#0a5bd7' }}>{submitting ? <CircularProgress size={22} color="inherit" /> : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      {/* Designations manager */}
      <Dialog open={dialog === 'designations'} onClose={close} maxWidth="sm" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold border-b border-slate-100">Committee Designations</DialogTitle>
        <DialogContent className="pt-6 space-y-3">
          {designations.map((d) => (
            <div key={d._id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 p-3">
              <div>
                <span className="font-semibold text-slate-800">{d.label}</span>
                {d.isOfficeBearer && <Chip size="small" label="Office bearer" sx={{ ml: 1, height: 18, fontSize: 10 }} />}
                {d.isSystem && <Chip size="small" variant="outlined" label="Default" sx={{ ml: 1, height: 18, fontSize: 10 }} />}
              </div>
              <FormControlLabel control={<Switch size="small" checked={d.active} onChange={() => toggleDesignation(d)} />} label={d.active ? 'Active' : 'Off'} />
            </div>
          ))}
          <Divider />
          <div className="flex items-end gap-2">
            <TextField label="New designation" size="small" fullWidth value={newDesig.label} onChange={(e) => setNewDesig({ ...newDesig, label: e.target.value })} />
            <FormControlLabel control={<Switch size="small" checked={newDesig.isOfficeBearer} onChange={(e) => setNewDesig({ ...newDesig, isOfficeBearer: e.target.checked })} />} label="Bearer" />
            <Button variant="contained" onClick={addDesignation} sx={{ backgroundColor: '#0a5bd7' }}>Add</Button>
          </div>
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100">
          <Button onClick={close} className="text-slate-600">Done</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
