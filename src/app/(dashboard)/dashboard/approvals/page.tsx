'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import {
  Tabs, Tab, Chip, Button, IconButton, Tooltip, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import { Check, X, Ban, Inbox, Send, ShieldCheck } from 'lucide-react';

interface Req {
  _id: string;
  targetName: string;
  targetEmail?: string;
  targetPhone?: string;
  relationship: string;
  requestedRole: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
  initiatedBy: { name: string; side: string };
  approver: { side: string };
  flatId?: { _id: string; number: string; blockName: string };
  rejectionReason?: string;
  createdAt: string;
}

const statusColor: Record<string, any> = {
  PENDING: 'warning', APPROVED: 'success', REJECTED: 'error', CANCELLED: 'default', EXPIRED: 'default',
};
const roleLabel = (r: string) => r.replace('RESIDENT_', '').replace('_', ' ');

export default function ApprovalsPage() {
  const { showToast, confirm } = useToastConfirm();
  const [box, setBox] = useState<'incoming' | 'outgoing'>('incoming');
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [rejectFor, setRejectFor] = useState<Req | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/societies/registration-requests', { params: { box } });
      setRows(res.data.requests || []);
    } catch {
      showToast('Failed to load requests', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const approve = async (row: Req) => {
    const ok = await confirm({
      title: 'Approve registration',
      message: `Grant ${row.targetName} access to flat ${row.flatId?.number || ''} as ${roleLabel(row.requestedRole)}?`,
      confirmText: 'Approve',
    });
    if (!ok) return;
    setBusyId(row._id);
    try {
      await api.post(`/societies/registration-requests/${row._id}/approve`);
      showToast('Approved — resident registered', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to approve', 'error');
    } finally { setBusyId(null); }
  };

  const submitReject = async () => {
    if (!rejectFor) return;
    setBusyId(rejectFor._id);
    try {
      await api.post(`/societies/registration-requests/${rejectFor._id}/reject`, { reason: rejectReason || undefined });
      showToast('Request rejected', 'success');
      setRejectFor(null); setRejectReason('');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to reject', 'error');
    } finally { setBusyId(null); }
  };

  const cancel = async (row: Req) => {
    const ok = await confirm({
      title: 'Cancel request',
      message: `Withdraw the pending registration for ${row.targetName}?`,
      confirmText: 'Cancel request', severity: 'error',
    });
    if (!ok) return;
    setBusyId(row._id);
    try {
      await api.post(`/societies/registration-requests/${row._id}/cancel`);
      showToast('Request cancelled', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to cancel', 'error');
    } finally { setBusyId(null); }
  };

  const columns: ColumnDef<Req>[] = [
    {
      id: 'person', label: 'Person',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-800">{row.targetName}</span>
          <div className="text-xs text-slate-500">{row.targetEmail || row.targetPhone || '—'}</div>
        </div>
      ),
    },
    {
      id: 'flat', label: 'Flat',
      render: (row) => row.flatId ? <span className="text-sm">{row.flatId.blockName}-{row.flatId.number}</span> : '—',
    },
    {
      id: 'role', label: 'As',
      render: (row) => <Chip size="small" label={roleLabel(row.requestedRole)} variant="outlined" />,
    },
    {
      id: 'initiator', label: 'Requested by',
      render: (row) => <span className="text-xs text-slate-600">{row.initiatedBy?.name}</span>,
    },
    {
      id: 'status', label: 'Status',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <Chip size="small" color={statusColor[row.status]} label={row.status} />
          {row.status === 'REJECTED' && row.rejectionReason && <span className="text-[10px] text-slate-400">{row.rejectionReason}</span>}
        </div>
      ),
    },
    {
      id: 'actions', label: 'Actions', align: 'right',
      render: (row) => {
        if (row.status !== 'PENDING') return <span className="text-xs text-slate-300">—</span>;
        if (busyId === row._id) return <CircularProgress size={18} />;
        if (box === 'incoming') {
          return (
            <div className="flex justify-end gap-1">
              <Tooltip title="Approve"><IconButton size="small" onClick={() => approve(row)} className="text-emerald-600 hover:bg-emerald-50"><Check className="w-4 h-4" /></IconButton></Tooltip>
              <Tooltip title="Reject"><IconButton size="small" onClick={() => setRejectFor(row)} className="text-rose-600 hover:bg-rose-50"><X className="w-4 h-4" /></IconButton></Tooltip>
            </div>
          );
        }
        return (
          <Tooltip title="Cancel"><IconButton size="small" onClick={() => cancel(row)} className="text-slate-500 hover:bg-slate-100"><Ban className="w-4 h-4" /></IconButton></Tooltip>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><ShieldCheck className="w-6 h-6" /></div>
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Resident Approvals</h1>
          <p className="text-sm text-slate-500">Review registrations that need your approval, and track ones you submitted</p>
        </div>
      </div>

      <Tabs value={box} onChange={(_, v) => setBox(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="incoming" iconPosition="start" icon={<Inbox className="w-4 h-4" />} label="To approve" sx={{ textTransform: 'none', fontWeight: 700 }} />
        <Tab value="outgoing" iconPosition="start" icon={<Send className="w-4 h-4" />} label="My requests" sx={{ textTransform: 'none', fontWeight: 700 }} />
      </Tabs>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        keyExtractor={(row) => row._id}
        emptyText={box === 'incoming' ? 'Nothing awaiting your approval.' : 'You have not submitted any registrations.'}
      />

      <Dialog open={!!rejectFor} onClose={() => setRejectFor(null)} maxWidth="sm" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold text-slate-800 border-b border-slate-100">Reject registration</DialogTitle>
        <DialogContent className="pt-6 space-y-3">
          <p className="text-sm text-slate-500">Optionally tell {rejectFor?.targetName} why this was rejected.</p>
          <TextField autoFocus label="Reason (optional)" fullWidth multiline minRows={2} size="small"
            value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100">
          <Button onClick={() => setRejectFor(null)} className="text-slate-600">Back</Button>
          <Button onClick={submitReject} variant="contained" color="error" disabled={busyId === rejectFor?._id}>
            {busyId === rejectFor?._id ? <CircularProgress size={22} color="inherit" /> : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
