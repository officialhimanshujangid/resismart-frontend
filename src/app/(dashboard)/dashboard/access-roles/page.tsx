'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import {
  Paper, Button, TextField, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, Chip, Switch, FormControlLabel, ToggleButton, ToggleButtonGroup,
  Checkbox, ListItemText, OutlinedInput,
} from '@mui/material';
import { Plus, Shield, Trash2, Pencil, Users, Lock, Building2, Info } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

/**
 * Who can do what, inside this society.
 *
 * Two things this screen is careful about:
 *
 * 1. It shows all three levels, not a checkbox. "Cannot see it", "can see it"
 *    and "can change it" are genuinely different answers, and collapsing the
 *    middle one is how a treasurer ends up able to edit a report they were only
 *    meant to read.
 *
 * 2. The wing scope is offered plainly. No competitor models this, but
 *    "Rajesh looks after A and B wing" is how large societies actually work.
 */

type Level = 'NONE' | 'READ' | 'FULL';
interface Grant { module: string; level: Level }
interface Role {
  _id: string; name: string; description?: string;
  appliesTo: 'COMMITTEE' | 'STAFF' | 'BOTH';
  permissions: Grant[];
  scope: { allBlocks: boolean; blockIds: string[] };
  isSystem: boolean; isActive: boolean;
}
interface ModuleInfo { key: string; label: string; blurb: string }
interface BlockLite { _id: string; name: string }
interface MemberRow {
  _id: string;
  memberSnapshot: { name: string };
  designationLabel: string;
  isOfficeBearer: boolean;
  accessRoleId?: { _id: string; name: string; isActive: boolean } | null;
}

const LEVELS: { v: Level; label: string }[] = [
  { v: 'NONE', label: 'Hidden' },
  { v: 'READ', label: 'View' },
  { v: 'FULL', label: 'Change' },
];

const emptyRole = (): Partial<Role> => ({
  name: '', description: '', appliesTo: 'BOTH', permissions: [],
  scope: { allBlocks: true, blockIds: [] },
});

export default function AccessRolesPage() {
  const { showToast, confirm } = useToastConfirm();

  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<ModuleInfo[]>([]);
  const [blocks, setBlocks] = useState<BlockLite[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [tab, setTab] = useState<'roles' | 'people'>('roles');

  const [editing, setEditing] = useState<Partial<Role> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [r, m] = await Promise.all([
        api.get('/access-roles'),
        api.get('/access-roles/members').catch(() => ({ data: { data: [] } })),
      ]);
      setRoles(r.data?.data?.roles || []);
      setCatalog(r.data?.data?.catalog || []);
      setBlocks(r.data?.data?.blocks || []);
      setMembers(m.data?.data || []);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not load roles', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const levelOf = (role: Partial<Role>, key: string): Level =>
    (role.permissions || []).find(p => p.module === key)?.level ?? 'NONE';

  const setLevel = (key: string, level: Level) => {
    setEditing(prev => {
      if (!prev) return prev;
      const rest = (prev.permissions || []).filter(p => p.module !== key);
      return { ...prev, permissions: [...rest, { module: key, level }] };
    });
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const body = {
        name: editing.name,
        description: editing.description,
        appliesTo: editing.appliesTo,
        permissions: editing.permissions,
        scope: editing.scope,
      };
      if (editing._id) await api.put(`/access-roles/${editing._id}`, body);
      else await api.post('/access-roles', body);
      showToast(editing._id ? 'Role updated' : 'Role created', 'success');
      setEditing(null);
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not save that role', 'error');
    } finally { setSaving(false); }
  };

  const remove = async (r: Role) => {
    const yes = await confirm({
      title: `Delete "${r.name}"?`,
      message: 'Anyone holding it will lose their access until they are given another role.',
      confirmText: 'Delete', cancelText: 'Cancel', severity: 'warning',
    });
    if (!yes) return;
    try {
      await api.delete(`/access-roles/${r._id}`);
      showToast('Role deleted', 'success');
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not delete that role', 'error');
    }
  };

  const assign = async (memberId: string, roleId: string) => {
    try {
      await api.put(`/access-roles/members/${memberId}`, { accessRoleId: roleId || null });
      showToast('Access updated', 'success');
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not assign that role', 'error');
    }
  };

  const committeeRoles = useMemo(
    () => roles.filter(r => r.isActive && r.appliesTo !== 'STAFF'),
    [roles],
  );

  if (loading) return <div className="flex justify-center py-24"><CircularProgress size={28} /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-24">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">Who can do what</h1>
          <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
            Build a role, then give it to a committee member. A role can be limited to
            certain wings — useful when someone looks after only part of the society.
          </p>
        </div>
        {tab === 'roles' && (
          <Button variant="contained" startIcon={<Plus className="w-4 h-4" />}
            onClick={() => setEditing(emptyRole())}
            className="!rounded-xl !normal-case !font-bold shrink-0">
            New role
          </Button>
        )}
      </div>

      <ToggleButtonGroup exclusive size="small" value={tab}
        onChange={(_, v) => v && setTab(v)} className="!rounded-xl">
        <ToggleButton value="roles" className="!rounded-l-xl !normal-case !font-bold !text-xs !px-4">
          <Shield className="w-3.5 h-3.5 mr-1.5" /> Roles
        </ToggleButton>
        <ToggleButton value="people" className="!rounded-r-xl !normal-case !font-bold !text-xs !px-4">
          <Users className="w-3.5 h-3.5 mr-1.5" /> Committee members
        </ToggleButton>
      </ToggleButtonGroup>

      {/* ----------------------------------------------------------- roles */}
      {tab === 'roles' && (
        <div className="grid gap-3">
          {roles.map(r => {
            const granted = r.permissions.filter(p => p.level !== 'NONE');
            return (
              <Paper key={r._id} elevation={0}
                className={`rounded-2xl border p-4 ${r.isActive ? 'border-slate-200/70' : 'border-slate-200/70 opacity-60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-800">{r.name}</p>
                      {r.isSystem && <Chip size="small" label="Standard" className="!bg-slate-100 !text-slate-600 !font-bold !text-[10px]" />}
                      {!r.isActive && <Chip size="small" label="Switched off" className="!bg-amber-100 !text-amber-700 !font-bold !text-[10px]" />}
                      <Chip size="small" label={r.appliesTo === 'BOTH' ? 'Committee & staff' : r.appliesTo === 'COMMITTEE' ? 'Committee' : 'Staff'}
                        className="!bg-slate-100 !text-slate-500 !font-semibold !text-[10px]" />
                    </div>
                    {r.description && <p className="text-xs text-slate-500 mt-1">{r.description}</p>}

                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {granted.length === 0
                        ? <span className="text-xs text-slate-400 italic">No access to anything yet</span>
                        : granted.map(p => (
                          <Chip key={p.module} size="small"
                            label={`${catalog.find(c => c.key === p.module)?.label || p.module} · ${p.level === 'FULL' ? 'change' : 'view'}`}
                            className={`!text-[10px] !font-semibold ${p.level === 'FULL' ? '!bg-indigo-50 !text-indigo-700' : '!bg-slate-100 !text-slate-600'}`} />
                        ))}
                    </div>

                    {!r.scope.allBlocks && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-700">
                        <Building2 className="w-3.5 h-3.5" />
                        Limited to {r.scope.blockIds.map(id => blocks.find(b => b._id === id)?.name).filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <Button size="small" startIcon={<Pencil className="w-3.5 h-3.5" />}
                      onClick={() => setEditing(JSON.parse(JSON.stringify(r)))}
                      className="!normal-case !font-bold !text-xs">Edit</Button>
                    {!r.isSystem && (
                      <Button size="small" color="error" onClick={() => remove(r)}
                        className="!min-w-0 !px-2"><Trash2 className="w-3.5 h-3.5" /></Button>
                    )}
                  </div>
                </div>
              </Paper>
            );
          })}
        </div>
      )}

      {/* --------------------------------------------------------- people */}
      {tab === 'people' && (
        <Paper elevation={0} className="rounded-2xl border border-slate-200/70 overflow-hidden">
          {members.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No active committee members yet.
            </div>
          ) : members.map(m => (
            <div key={m._id} className="p-4 border-b border-slate-100 last:border-0 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 text-sm">{m.memberSnapshot?.name}</p>
                <p className="text-xs text-slate-500">{m.designationLabel}</p>
                {!m.accessRoleId && (
                  <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Cannot do anything until given a role
                  </p>
                )}
              </div>
              <FormControl size="small" className="!w-56 shrink-0">
                <Select value={m.accessRoleId?._id || ''} displayEmpty className="!rounded-xl"
                  onChange={e => assign(m._id, e.target.value)}>
                  <MenuItem value=""><em className="text-slate-400">No access</em></MenuItem>
                  {committeeRoles.map(r => <MenuItem key={r._id} value={r._id}>{r.name}</MenuItem>)}
                </Select>
              </FormControl>
            </div>
          ))}
        </Paper>
      )}

      {/* ---------------------------------------------------------- editor */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="sm"
        slotProps={{ paper: { className: '!rounded-2xl' } }}>
        <DialogTitle className="!font-black !text-slate-900">
          {editing?._id ? `Edit "${editing.name}"` : 'New role'}
        </DialogTitle>
        <DialogContent dividers className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <TextField label="Name" size="small" fullWidth value={editing?.name || ''}
              disabled={editing?.isSystem}
              helperText={editing?.isSystem ? 'Standard roles keep their name' : ' '}
              onChange={e => setEditing(p => p && { ...p, name: e.target.value })} />
            <FormControl size="small" fullWidth>
              <Select value={editing?.appliesTo || 'BOTH'}
                onChange={e => setEditing(p => p && { ...p, appliesTo: e.target.value as any })}>
                <MenuItem value="BOTH">Committee &amp; staff</MenuItem>
                <MenuItem value="COMMITTEE">Committee only</MenuItem>
                <MenuItem value="STAFF">Staff only</MenuItem>
              </Select>
            </FormControl>
          </div>
          <TextField label="What this role is for" size="small" fullWidth
            value={editing?.description || ''}
            onChange={e => setEditing(p => p && { ...p, description: e.target.value })} />

          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Access</span>
            <div className="mt-2 space-y-1.5">
              {catalog.map(c => (
                <div key={c.key} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-700 font-medium">{c.label}</p>
                    <p className="text-[11px] text-slate-500">{c.blurb}</p>
                  </div>
                  <ToggleButtonGroup exclusive size="small" className="shrink-0"
                    value={editing ? levelOf(editing, c.key) : 'NONE'}
                    onChange={(_, v) => v && setLevel(c.key, v)}>
                    {LEVELS.map(l => (
                      <ToggleButton key={l.v} value={l.v} className="!normal-case !text-[11px] !font-bold !px-2.5 !py-1">
                        {l.label}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <FormControlLabel
              control={<Switch size="small" checked={editing?.scope?.allBlocks !== false}
                onChange={e => setEditing(p => p && {
                  ...p, scope: { allBlocks: e.target.checked, blockIds: e.target.checked ? [] : (p.scope?.blockIds || []) },
                })} />}
              label={<span className="text-sm font-semibold text-slate-700">Every wing</span>}
            />
            {editing?.scope?.allBlocks === false && (
              <FormControl size="small" fullWidth className="!mt-2">
                <Select multiple value={editing?.scope?.blockIds || []}
                  input={<OutlinedInput className="!rounded-xl" />}
                  renderValue={(sel: any) => (sel as string[]).map(id => blocks.find(b => b._id === id)?.name).filter(Boolean).join(', ') || 'Choose wings'}
                  onChange={e => setEditing(p => p && {
                    ...p, scope: { allBlocks: false, blockIds: e.target.value as string[] },
                  })}>
                  {blocks.map(b => (
                    <MenuItem key={b._id} value={b._id}>
                      <Checkbox size="small" checked={(editing?.scope?.blockIds || []).includes(b._id)} />
                      <ListItemText primary={b.name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <p className="text-[11px] text-slate-500 mt-2 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Anything belonging to the whole society stays visible either way — the limit
              only applies to things filed under a wing.
            </p>
          </div>
        </DialogContent>
        <DialogActions className="!px-6 !py-3">
          <Button onClick={() => setEditing(null)} className="!normal-case !font-bold">Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving || !editing?.name}
            className="!rounded-xl !normal-case !font-bold">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
