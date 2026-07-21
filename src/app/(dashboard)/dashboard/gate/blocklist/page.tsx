'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import {
  Button, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Chip, Alert, Checkbox,
  ListItemText, OutlinedInput, Tooltip,
} from '@mui/material';
import { Plus, ShieldBan, Undo2, Search } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import PageHeader from '@/components/common/PageHeader';

/**
 * The blocklist — people the society has decided not to let in.
 *
 * The backend for this shipped complete and this screen never existed, so the
 * list could be read by the gate and added to by nobody. Two rules from the
 * model surface here as UI rather than as a surprise 400:
 *
 *   - you can only block a phone or a plate that has ACTUALLY been recorded at
 *     this gate, never a number somebody typed from memory;
 *   - it takes two serving committee members, so the form asks for the second
 *     one by name instead of failing after the fact.
 *
 * And the thing a committee must understand before using it at all, said on the
 * screen: this WARNS the guard. It does not bar the door.
 */

interface Row {
  _id: string;
  basis: 'PHONE' | 'VEHICLE' | 'PASS_ISSUER';
  value: string;
  label?: string;
  reason: string;
  approvedByNames: string[];
  isActive: boolean;
  liftedAt?: string;
  liftedReason?: string;
  createdByName?: string;
  createdAt?: string;
}

interface Member { userId: string; name: string; designationLabel?: string }

const BASIS_LABEL: Record<string, string> = {
  PHONE: 'Phone number', VEHICLE: 'Vehicle', PASS_ISSUER: 'Pass issuer',
};

export default function BlocklistPage() {
  const { showToast, confirm } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showLifted, setShowLifted] = useState(false);
  const [q, setQ] = useState('');

  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ basis: 'PHONE' | 'VEHICLE'; value: string; label: string; reason: string; approverUserIds: string[] }>(
    { basis: 'PHONE', value: '', label: '', reason: '', approverUserIds: [] },
  );

  const load = async () => {
    try {
      const [b, c] = await Promise.all([
        api.get(`/gate/blocklist?all=${showLifted}`),
        api.get('/committee').catch(() => ({ data: { members: [] } })),
      ]);
      setRows(b.data?.data || []);
      setMembers((c.data?.members || []).map((m: any) => ({
        userId: String(m.userId),
        name: m.memberSnapshot?.name || m.designationLabel || 'Member',
        designationLabel: m.designationLabel,
      })));
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not load the blocklist', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [showLifted]);

  const save = async () => {
    if (!form.value.trim()) return showToast('What are we blocking?', 'error');
    if (!form.reason.trim()) return showToast('Please say why — this is kept permanently', 'error');
    if (form.approverUserIds.length < 1) {
      return showToast('A second committee member has to agree to this', 'error');
    }
    setSaving(true);
    try {
      const res = await api.post('/gate/blocklist', form);
      showToast(res.data?.message || 'Added', 'success');
      setAdding(false);
      setForm({ basis: 'PHONE', value: '', label: '', reason: '', approverUserIds: [] });
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not add that', 'error');
    } finally { setSaving(false); }
  };

  const lift = async (r: Row) => {
    if (!(await confirm({
      title: `Take ${r.label || r.value} off the list?`,
      message: 'The gate stops being warned about them. The record of the block stays.',
      severity: 'warning',
    }))) return;
    try {
      await api.post(`/gate/blocklist/${r._id}/lift`, { reason: 'Lifted by committee' });
      showToast('Removed from the list', 'success');
      await load();
    } catch (e: any) {
      showToast(e.response?.data?.message || 'Could not do that', 'error');
    }
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(r =>
      [r.value, r.label, r.reason, ...(r.approvedByNames || [])].join(' ').toLowerCase().includes(needle));
  }, [rows, q]);

  const columns: ColumnDef<Row>[] = [
    {
      id: 'who', label: 'Who', alwaysVisible: true,
      sortValue: r => r.label || r.value,
      exportValue: r => `${r.label || ''} ${r.value}`.trim(),
      render: r => (
        <div className="min-w-0">
          <p className="font-bold text-slate-800 truncate">{r.label || r.value}</p>
          {r.label && <p className="text-[11px] text-slate-400 font-mono">{r.value}</p>}
        </div>
      ),
    },
    {
      id: 'basis', label: 'Matched on',
      sortValue: r => BASIS_LABEL[r.basis] || r.basis,
      exportValue: r => BASIS_LABEL[r.basis] || r.basis,
      render: r => <span className="text-sm text-slate-600">{BASIS_LABEL[r.basis] || r.basis}</span>,
    },
    {
      id: 'reason', label: 'Why',
      sortValue: r => r.reason,
      exportValue: r => r.reason,
      render: r => <span className="text-sm text-slate-600 line-clamp-2">{r.reason}</span>,
    },
    {
      id: 'approved', label: 'Agreed by',
      exportValue: r => (r.approvedByNames || []).join('; '),
      render: r => (
        <span className="text-[11px] text-slate-500">{(r.approvedByNames || []).join(', ') || '—'}</span>
      ),
    },
    {
      id: 'added', label: 'Added', defaultHidden: true,
      sortValue: r => r.createdAt || '',
      exportValue: r => r.createdAt ? new Date(r.createdAt).toLocaleString('en-IN') : '',
      render: r => (
        <span className="text-[11px] text-slate-500">
          {r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '—'}
          {r.createdByName && <><br />by {r.createdByName}</>}
        </span>
      ),
    },
    {
      id: 'status', label: 'Status', align: 'right',
      sortValue: r => (r.isActive ? 'Active' : 'Lifted'),
      exportValue: r => (r.isActive ? 'Active' : 'Lifted'),
      render: r => r.isActive
        ? <Chip size="small" label="On the list" className="!bg-rose-50 !text-rose-700 !font-bold !text-[10px]" />
        : <Tooltip title={r.liftedReason || ''}>
            <Chip size="small" label="Lifted" className="!bg-slate-100 !text-slate-500 !font-bold !text-[10px]" />
          </Tooltip>,
    },
    {
      id: 'act', label: '', align: 'right', alwaysVisible: true,
      render: r => r.isActive ? (
        <Button size="small" startIcon={<Undo2 className="w-3.5 h-3.5" />} onClick={() => lift(r)}
          className="!rounded-xl !normal-case !font-bold !text-xs !text-slate-500">Lift</Button>
      ) : null,
    },
  ];

  if (loading) return <div className="flex justify-center py-24"><CircularProgress /></div>;

  return (
    <div className="space-y-4 pb-24">
      <PageHeader
        breadcrumb="Operations · Gate"
        title="Blocklist"
        icon={<ShieldBan className="w-4.5 h-4.5" />}
        subtitle="People the committee has decided should not be let in. The gate is warned when one of them turns up — it does not refuse entry on its own, because the software cannot know whether today is an emergency."
        actions={
          <Button variant="contained" startIcon={<Plus className="w-4 h-4" />} onClick={() => setAdding(true)}
            className="!rounded-xl !normal-case !font-bold">Block somebody</Button>
        }
      />

      <Alert severity="info" className="!rounded-2xl !text-sm">
        Only a phone number or vehicle that has <strong>actually been recorded at this gate</strong> can be blocked,
        and it takes <strong>two serving committee members</strong>. Names are never matched on — turning away the
        wrong Ramesh is how this feature fails everywhere else.
      </Alert>

      <DataTable
        columns={columns}
        data={filtered}
        keyExtractor={r => r._id}
        exportFileName="blocklist"
        columnToggle
        emptyTitle="Nobody is blocked"
        emptyText="That is the normal state. Block from an entry in the gate log when the committee has decided to."
        emptyIcon={<ShieldBan className="w-6 h-6" />}
        toolbar={
          <>
            <TextField size="small" placeholder="Search the list" value={q} onChange={e => setQ(e.target.value)}
              className="min-w-[220px]"
              slotProps={{ input: { startAdornment: <Search className="w-4 h-4 text-slate-400 mr-2" /> } }} />
            <Button size="small" variant={showLifted ? 'contained' : 'outlined'}
              onClick={() => setShowLifted(v => !v)}
              className="!rounded-xl !normal-case !font-bold !text-xs">
              {showLifted ? 'Showing lifted too' : 'Show lifted'}
            </Button>
          </>
        }
      />

      <Dialog open={adding} onClose={() => setAdding(false)} fullWidth maxWidth="xs"
        slotProps={{ paper: { className: '!rounded-2xl' } }}>
        <DialogTitle className="!font-black !text-slate-900">Block somebody</DialogTitle>
        <DialogContent dividers className="space-y-3">
          <FormControl fullWidth size="small">
            <InputLabel>Block on</InputLabel>
            <Select label="Block on" value={form.basis}
              onChange={e => setForm({ ...form, basis: e.target.value as 'PHONE' | 'VEHICLE' })}>
              <MenuItem value="PHONE">Phone number</MenuItem>
              <MenuItem value="VEHICLE">Vehicle number</MenuItem>
            </Select>
          </FormControl>
          <TextField fullWidth size="small" label={form.basis === 'PHONE' ? 'Phone number' : 'Vehicle number'}
            value={form.value} onChange={e => setForm({ ...form, value: e.target.value })}
            placeholder={form.basis === 'PHONE' ? '9876543210' : 'MH 12 AB 1234'}
            helperText="It must already appear somewhere in the gate log." />
          <TextField fullWidth size="small" label="Name (for the list only)" value={form.label}
            onChange={e => setForm({ ...form, label: e.target.value })}
            helperText="Shown to whoever reads the list. Never used to match anybody." />
          <TextField fullWidth size="small" multiline minRows={2} label="Why" value={form.reason}
            onChange={e => setForm({ ...form, reason: e.target.value })}
            helperText="Kept permanently, and readable by the committee that follows yours." />
          <FormControl fullWidth size="small">
            <InputLabel>Agreed with</InputLabel>
            <Select multiple label="Agreed with" value={form.approverUserIds}
              input={<OutlinedInput label="Agreed with" />}
              onChange={e => setForm({ ...form, approverUserIds: e.target.value as string[] })}
              renderValue={ids => members.filter(m => (ids as string[]).includes(m.userId)).map(m => m.name).join(', ')}>
              {members.map(m => (
                <MenuItem key={m.userId} value={m.userId}>
                  <Checkbox size="small" checked={form.approverUserIds.includes(m.userId)} className="!p-0 !mr-2" />
                  <ListItemText primary={m.name} secondary={m.designationLabel}
                    slotProps={{
                      primary: { className: '!text-sm' },
                      secondary: { className: '!text-[11px]' },
                    }} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <p className="text-[11px] text-slate-500">
            You count as one of the two. Pick at least one other serving member who agrees.
          </p>
        </DialogContent>
        <DialogActions className="!px-6 !py-3">
          <Button onClick={() => setAdding(false)} className="!normal-case !font-bold">Cancel</Button>
          <Button variant="contained" color="error" onClick={save} disabled={saving}
            className="!rounded-xl !normal-case !font-bold">{saving ? 'Saving…' : 'Add to the list'}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
