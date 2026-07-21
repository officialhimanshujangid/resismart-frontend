'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Switch, Chip, Alert,
} from '@mui/material';
import { Plus, DoorOpen, LogIn, LogOut } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import PageHeader from '@/components/common/PageHeader';
import PageSkeleton from '@/components/common/PageSkeleton';
import StatusChip from '@/components/common/StatusChip';
import AuditFooter from '@/components/common/AuditFooter';

/**
 * The society's physical gates.
 *
 * This screen exists because the gate was, until now, an implicit single door
 * the software pretended every society had. A large society has several, and
 * without naming them the register cannot say which one a visitor came through
 * or left by, and an offline scanner cannot be tied to the door it stands at.
 */

const KIND_LABEL: Record<string, string> = {
  MAIN: 'Main', PEDESTRIAN: 'Pedestrian', VEHICLE: 'Vehicle', SERVICE: 'Service',
};

interface Gate {
  _id: string; code: string; name: string; kind: string;
  handlesEntry: boolean; handlesExit: boolean;
  blockId?: string; blockName?: string; isActive: boolean;
  createdByName?: string; updatedByName?: string; createdAt?: string; updatedAt?: string;
}
interface Block { _id: string; name: string }

export default function GatesPage() {
  const { showToast, confirm } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [gates, setGates] = useState<Gate[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [editing, setEditing] = useState<Partial<Gate> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const [g, b] = await Promise.all([
        api.get('/visitors/gates?all=true'),
        // `/blocks` is not mounted — wings live under /societies. The old path
        // 404'd on every load and the .catch swallowed it, so the wing dropdown
        // was permanently and silently empty.
        api.get('/societies/blocks').catch(() => ({ data: { data: [] } })),
      ]);
      setGates(g.data?.data || []);
      setBlocks(b.data?.data || []);
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not load gates', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const save = async () => {
    if (!editing?.code?.trim() || !editing?.name?.trim()) return showToast('A gate needs a code and a name', 'error');
    if (editing.handlesEntry === false && editing.handlesExit === false) {
      return showToast('A gate that does neither is not a gate — pick entry, exit or both', 'error');
    }
    setSaving(true);
    try {
      const body = {
        code: editing.code, name: editing.name, kind: editing.kind || 'MAIN',
        handlesEntry: editing.handlesEntry !== false,
        handlesExit: editing.handlesExit !== false,
        blockId: editing.blockId || undefined,
        isActive: editing.isActive !== false,
      };
      if (editing._id) await api.put(`/visitors/gates/${editing._id}`, body);
      else await api.post('/visitors/gates', body);
      showToast('Saved', 'success');
      setEditing(null);
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not save that', 'error');
    } finally { setSaving(false); }
  };

  const retire = async (g: Gate) => {
    if (!(await confirm({
      title: `Retire ${g.name}?`,
      message: 'It stops being an option at the console but stays on old entries. Anyone still recorded inside through it has to be closed off first.',
      severity: 'warning',
    }))) return;
    try {
      await api.post(`/visitors/gates/${g._id}/retire`, {});
      showToast('Retired', 'success');
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not retire that gate', 'error');
    }
  };

  const columns: ColumnDef<Gate>[] = [
    {
      id: 'name', label: 'Gate', alwaysVisible: true,
      sortValue: g => g.name,
      exportValue: g => g.name,
      render: g => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${g.isActive ? 'bg-slate-100 text-slate-500' : 'bg-slate-50 text-slate-300'}`}>
            <DoorOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className={`font-bold truncate ${g.isActive ? 'text-slate-800' : 'text-slate-400'}`}>{g.name}</p>
            <p className="text-[11px] text-slate-400 font-mono">{g.code}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'kind', label: 'Kind',
      sortValue: g => KIND_LABEL[g.kind] || g.kind,
      exportValue: g => KIND_LABEL[g.kind] || g.kind,
      render: g => <span className="text-sm text-slate-600">{KIND_LABEL[g.kind] || g.kind}</span>,
    },
    {
      id: 'wing', label: 'Wing',
      sortValue: g => g.blockName || '',
      exportValue: g => g.blockName || 'Whole society',
      render: g => <span className="text-sm text-slate-500">{g.blockName || 'Whole society'}</span>,
    },
    {
      id: 'direction', label: 'Takes',
      exportValue: g => [g.handlesEntry && 'entry', g.handlesExit && 'exit'].filter(Boolean).join(' + '),
      render: g => (
        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
          {g.handlesEntry && <span className="flex items-center gap-0.5"><LogIn className="w-3 h-3" />In</span>}
          {g.handlesExit && <span className="flex items-center gap-0.5"><LogOut className="w-3 h-3" />Out</span>}
        </div>
      ),
    },
    {
      id: 'audit', label: 'Added', defaultHidden: true,
      sortValue: g => g.createdAt || '',
      exportValue: g => `${g.createdAt ? new Date(g.createdAt).toLocaleDateString('en-IN') : ''} ${g.createdByName || ''}`.trim(),
      render: g => (
        <span className="text-[11px] text-slate-500">
          {g.createdAt ? new Date(g.createdAt).toLocaleDateString('en-IN') : '—'}
          {g.createdByName && <><br />by {g.createdByName}</>}
        </span>
      ),
    },
    {
      id: 'status', label: 'Status', align: 'right',
      sortValue: g => (g.isActive ? 'In use' : 'Retired'),
      exportValue: g => (g.isActive ? 'In use' : 'Retired'),
      render: g => g.isActive
        ? <StatusChip status="IN_USE" label="In use" tone="good" />
        : <StatusChip status="RETIRED" label="Retired" tone="neutral" />,
    },
    {
      id: 'act', label: '', align: 'right', alwaysVisible: true,
      render: g => (
        <div className="flex items-center justify-end gap-1">
          <Button size="small" onClick={() => setEditing(g)}>Edit</Button>
          {g.isActive && (
            <Button size="small" color="error" onClick={() => retire(g)}>Retire</Button>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <PageSkeleton />;

  const live = gates.filter(g => g.isActive);

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        breadcrumb="Operations · Visitor Management"
        title="Gates"
        icon={<DoorOpen className="w-4.5 h-4.5" />}
        subtitle="The physical doors in the wall. The guard picks one when logging a visitor, so the register can say which way somebody came in and which way they left."
        actions={
          <Button variant="contained" startIcon={<Plus className="w-4 h-4" />}
            onClick={() => setEditing({ kind: 'MAIN', handlesEntry: true, handlesExit: true, isActive: true })}>Add gate</Button>
        }
      />

      {live.length === 1 && (
        <Alert severity="info" className="rounded-2xl">
          With one gate the console never asks which — every entry is recorded against{' '}
          <strong>{live[0].name}</strong> automatically. Add a second and the guard gets a choice.
        </Alert>
      )}
      {live.length > 0 && !live.some(g => g.handlesExit) && (
        <Alert severity="warning" className="rounded-2xl">
          No gate here records exits, so nobody can be marked as gone. Edit a gate and switch
          &ldquo;Handles exit&rdquo; on, or set the society to arrivals-only in Operations Settings.
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={gates}
        keyExtractor={g => g._id}
        exportFileName="gates"
        columnToggle
        emptyTitle="No gates yet"
        emptyText="Add your gates so the register can say which one each visitor used."
        emptyIcon={<DoorOpen className="w-6 h-6" />}
      />

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="xs">
        <DialogTitle>{editing?._id ? 'Edit gate' : 'Add gate'}</DialogTitle>
        <DialogContent dividers className="flex flex-col gap-4 pt-2">
          <div className="flex gap-2">
            <TextField size="small" label="Code" value={editing?.code || ''} className="w-28"
              onChange={e => setEditing({ ...editing, code: e.target.value })} placeholder="G2" />
            <TextField fullWidth size="small" label="Name" value={editing?.name || ''}
              onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Main Gate" />
          </div>
          <FormControl fullWidth size="small">
            <InputLabel>Kind</InputLabel>
            <Select label="Kind" value={editing?.kind || 'MAIN'}
              onChange={e => setEditing({ ...editing, kind: e.target.value })}>
              {Object.entries(KIND_LABEL).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Wing (optional)</InputLabel>
            <Select label="Wing (optional)" value={editing?.blockId || ''}
              onChange={e => setEditing({ ...editing, blockId: e.target.value })}>
              <MenuItem value=""><em className="text-slate-400">Whole society</em></MenuItem>
              {blocks.map(b => <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>)}
            </Select>
          </FormControl>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-700">Handles entry</p>
              <p className="text-[11px] text-slate-400">People can be logged in here.</p>
            </div>
            <Switch checked={editing?.handlesEntry !== false}
              onChange={e => setEditing({ ...editing, handlesEntry: e.target.checked })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-700">Handles exit</p>
              <p className="text-[11px] text-slate-400">People can be marked as gone here.</p>
            </div>
            <Switch checked={editing?.handlesExit !== false}
              onChange={e => setEditing({ ...editing, handlesExit: e.target.checked })} />
          </div>
          {editing?._id && <AuditFooter record={editing as any} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
