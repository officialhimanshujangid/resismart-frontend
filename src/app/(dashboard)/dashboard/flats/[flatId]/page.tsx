'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { DataTable, ColumnDef } from '@/components/common/DataTable';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, CircularProgress, Tooltip, MenuItem, Select, FormControl, InputLabel,
  Card, CardContent, Typography, Grid, Chip, Tabs, Tab,
} from '@mui/material';
import {
  ArrowLeft, UserPlus, Trash2, ShieldCheck, User, KeyRound, Home, UserCheck,
  Plus, DoorOpen, Store, LogIn, History,
} from 'lucide-react';

interface Flat {
  _id: string; number: string; blockName: string; status: string;
  plotNumber?: string; fullAddress?: string;
  ownerUserId?: { _id: string; name: string; email: string; phone?: string };
}
interface Resident {
  _id: string; userId: { _id: string; name: string; email: string; phone?: string };
  relationship: string; isOwner: boolean; isActive: boolean;
}
interface Occupant { name: string; relationship: string; userId?: string; }
interface Tenure {
  _id: string; type: 'OWNERSHIP' | 'TENANCY' | 'OWNER_OCCUPANCY';
  party: { name: string }; occupants: Occupant[];
  startDate: string; endDate?: string | null; status: 'ACTIVE' | 'ENDED'; source: string;
  saleAmountPaise?: number; rentAmountPaise?: number; securityDepositPaise?: number; notes?: string;
}

const money = (paise?: number) => (paise || paise === 0) ? `₹${(paise / 100).toLocaleString('en-IN')}` : '';
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Present';
const today = () => new Date().toISOString().slice(0, 10);
const plusMonths = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };

const TENURE_META: Record<string, { icon: React.ReactNode; tone: string; label: string }> = {
  OWNERSHIP: { icon: <Home className="w-4 h-4" />, tone: 'bg-blue-100 text-blue-700', label: 'Ownership' },
  TENANCY: { icon: <KeyRound className="w-4 h-4" />, tone: 'bg-amber-100 text-amber-700', label: 'Tenancy' },
  OWNER_OCCUPANCY: { icon: <UserCheck className="w-4 h-4" />, tone: 'bg-emerald-100 text-emerald-700', label: 'Owner occupied' },
};

type DialogKind = null | 'register' | 'rent' | 'sell' | 'endTenancy' | 'moveIn' | 'vacant' | 'history';

export default function FlatDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast, confirm } = useToastConfirm();
  const flatId = params.flatId as string;

  const [flat, setFlat] = useState<Flat | null>(null);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [timeline, setTimeline] = useState<Tenure[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'residents' | 'timeline'>('residents');

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [submitting, setSubmitting] = useState(false);

  // form states
  const [reg, setReg] = useState({ name: '', email: '', phone: '', relationship: 'TENANT' });
  const [rent, setRent] = useState({ name: '', email: '', phone: '', rentAmount: '', securityDeposit: '', startDate: today(), endDate: plusMonths(11) });
  const [rentOccupants, setRentOccupants] = useState<Occupant[]>([]);
  const [sell, setSell] = useState({ name: '', email: '', phone: '', saleAmount: '', saleDate: today() });
  const [actionDate, setActionDate] = useState(today());
  const [hist, setHist] = useState({ type: 'OWNERSHIP', partyName: '', startDate: '', endDate: '', saleAmount: '', rentAmount: '', notes: '' });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [flatRes, resRes, tlRes] = await Promise.all([
        api.get(`/societies/flats/${flatId}`),
        api.get(`/societies/flats/${flatId}/residents`),
        api.get(`/societies/flats/${flatId}/timeline`),
      ]);
      setFlat(flatRes.data.flat);
      setResidents(resRes.data.residents);
      setTimeline(tlRes.data.timeline || []);
    } catch {
      showToast('Failed to load flat details', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const closeDialog = () => { setDialog(null); setSubmitting(false); };

  const call = async (fn: () => Promise<any>, successMsg?: string) => {
    setSubmitting(true);
    try {
      const res = await fn();
      showToast(res?.data?.message || successMsg || 'Done', res?.data?.autoApproved === false ? 'info' : 'success');
      closeDialog();
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.response?.data?.errors?.[0]?.message || 'Action failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitRegister = () => {
    if (!reg.name.trim() || (!reg.email.trim() && !reg.phone.trim())) return showToast('Name and an email or phone are required', 'error');
    call(() => api.post(`/societies/flats/${flatId}/registration-requests`, reg));
  };
  const submitRent = () => {
    if (!rent.name.trim() || (!rent.email.trim() && !rent.phone.trim())) return showToast('Tenant name and an email or phone are required', 'error');
    call(() => api.post(`/societies/flats/${flatId}/rent-out`, {
      tenant: { name: rent.name, email: rent.email, phone: rent.phone },
      occupants: rentOccupants.filter((o) => o.name.trim()),
      rentAmount: Number(rent.rentAmount || 0), securityDeposit: Number(rent.securityDeposit || 0),
      startDate: rent.startDate, endDate: rent.endDate,
    }), 'Flat rented out');
  };
  const submitSell = () => {
    if (!sell.name.trim() || (!sell.email.trim() && !sell.phone.trim())) return showToast('Buyer name and an email or phone are required', 'error');
    call(() => api.post(`/societies/flats/${flatId}/sell`, {
      buyer: { name: sell.name, email: sell.email, phone: sell.phone },
      saleAmount: sell.saleAmount ? Number(sell.saleAmount) : undefined, saleDate: sell.saleDate,
    }), 'Ownership transferred');
  };
  const submitHistory = () => {
    if (!hist.partyName.trim() || !hist.startDate) return showToast('Party name and start date are required', 'error');
    call(() => api.post(`/societies/flats/${flatId}/tenures`, {
      type: hist.type, partyName: hist.partyName, startDate: hist.startDate,
      endDate: hist.endDate || undefined,
      saleAmount: hist.saleAmount ? Number(hist.saleAmount) : undefined,
      rentAmount: hist.rentAmount ? Number(hist.rentAmount) : undefined,
      notes: hist.notes || undefined,
    }), 'Historical record added');
  };

  const handleRemoveResident = async (id: string, name: string, isOwner: boolean) => {
    if (isOwner) return showToast('Use “Sell” to change ownership.', 'warning');
    const ok = await confirm({ title: 'Remove Resident', message: `Remove ${name} from this flat?`, confirmText: 'Remove', severity: 'error' });
    if (!ok) return;
    try {
      await api.delete(`/societies/residents/${id}`);
      showToast('Resident removed', 'success');
      fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to remove resident', 'error');
    }
  };

  const columns: ColumnDef<Resident>[] = [
    {
      id: 'name', label: 'Name',
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.isOwner ? <ShieldCheck className="w-4 h-4 text-blue-600" /> : <User className="w-4 h-4 text-slate-400" />}
          <div>
            <span className="font-semibold text-slate-800">{row.userId?.name}</span>
            <div className="text-xs text-slate-500">{row.userId?.email || row.userId?.phone}</div>
          </div>
        </div>
      ),
    },
    { id: 'relationship', label: 'Role', render: (row) => <Chip label={row.relationship.replace('_', ' ')} size="small" color={row.isOwner ? 'primary' : 'default'} variant={row.isOwner ? 'filled' : 'outlined'} /> },
    {
      id: 'actions', label: 'Actions', align: 'right',
      render: (row) => !row.isOwner ? (
        <Tooltip title="Remove"><IconButton onClick={() => handleRemoveResident(row._id, row.userId?.name, row.isOwner)} size="small" className="text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></IconButton></Tooltip>
      ) : null,
    },
  ];

  if (loading) return <div className="flex justify-center py-20"><CircularProgress /></div>;
  if (!flat) return <div className="text-center py-20">Flat not found.</div>;

  const status = flat.status;
  const actionBtn = (label: string, icon: React.ReactNode, onClick: () => void, color = 'primary') => (
    <Button variant="outlined" size="small" startIcon={icon} onClick={onClick} color={color as any} sx={{ textTransform: 'none', borderRadius: 2 }}>{label}</Button>
  );

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
        {status !== 'RENTED' && actionBtn('Rent Out', <KeyRound className="w-4 h-4" />, () => setDialog('rent'))}
        {status === 'RENTED' && actionBtn('End Tenancy', <DoorOpen className="w-4 h-4" />, () => { setActionDate(today()); setDialog('endTenancy'); }, 'warning')}
        {actionBtn('Sell', <Store className="w-4 h-4" />, () => setDialog('sell'))}
        {flat.ownerUserId && status !== 'OWNER_OCCUPIED' && actionBtn('Owner Move In', <LogIn className="w-4 h-4" />, () => { setActionDate(today()); setDialog('moveIn'); })}
        {status !== 'VACANT' && actionBtn('Mark Vacant', <DoorOpen className="w-4 h-4" />, () => { setActionDate(today()); setDialog('vacant'); })}
        {actionBtn('Add History', <History className="w-4 h-4" />, () => setDialog('history'), 'inherit')}
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
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tab value="residents" label={`Residents (${residents.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab value="timeline" label={`Timeline (${timeline.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
          </Tabs>

          {tab === 'residents' && (
            <>
              <div className="flex justify-end mb-3">
                <Button variant="contained" onClick={() => setDialog('register')} startIcon={<UserPlus className="w-4 h-4" />} sx={{ backgroundColor: '#0a5bd7', '&:hover': { backgroundColor: '#094cb0' } }}>Register Resident</Button>
              </div>
              <DataTable columns={columns} data={residents} loading={loading} keyExtractor={(r) => r._id} emptyText="No active residents." />
            </>
          )}

          {tab === 'timeline' && (
            <div className="relative pl-3">
              {timeline.length === 0 && <p className="text-sm text-slate-400 py-8 text-center">No history yet. Rent out, sell, or add a historical record.</p>}
              <div className="space-y-4">
                {timeline.map((t) => {
                  const meta = TENURE_META[t.type];
                  return (
                    <div key={t._id} className={`rounded-2xl border p-4 ${t.status === 'ACTIVE' ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200/70'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${meta.tone}`}>{meta.icon}</div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">{t.party.name}</span>
                              {t.status === 'ACTIVE' && <Chip size="small" color="success" label="Current" sx={{ height: 18, fontSize: 10 }} />}
                              {t.source === 'MIGRATION' && <Chip size="small" variant="outlined" label="Historical" sx={{ height: 18, fontSize: 10 }} />}
                            </div>
                            <span className="text-xs text-slate-500">{meta.label}</span>
                          </div>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          {fmtDate(t.startDate)} — {fmtDate(t.endDate)}
                          {(t.saleAmountPaise || t.rentAmountPaise) ? (
                            <div className="font-bold text-slate-700 mt-0.5">{money(t.saleAmountPaise) || `${money(t.rentAmountPaise)}/mo`}</div>
                          ) : null}
                        </div>
                      </div>
                      {t.occupants?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5 pl-11">
                          {t.occupants.map((o, i) => <span key={i} className="text-[11px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{o.name} · {o.relationship.toLowerCase()}</span>)}
                        </div>
                      )}
                      {t.notes && <p className="text-xs text-slate-400 mt-2 pl-11 italic">{t.notes}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Grid>
      </Grid>

      {/* Register resident */}
      <Dialog open={dialog === 'register'} onClose={closeDialog} maxWidth="sm" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold border-b border-slate-100">Register Resident</DialogTitle>
        <DialogContent className="pt-6 space-y-4">
          <p className="text-xs text-slate-500 -mt-1">An owner or tenant goes to the {flat.ownerUserId ? 'flat owner' : 'society'} for approval. Family members are activated immediately.</p>
          <FormControl fullWidth size="small"><InputLabel>Relationship</InputLabel>
            <Select value={reg.relationship} label="Relationship" onChange={(e) => setReg({ ...reg, relationship: e.target.value })}>
              {['OWNER', 'TENANT', 'SPOUSE', 'CHILD', 'PARENT', 'OTHER'].map((r) => <MenuItem key={r} value={r}>{r[0] + r.slice(1).toLowerCase()}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField autoFocus label="Name" fullWidth size="small" value={reg.name} onChange={(e) => setReg({ ...reg, name: e.target.value })} />
          <TextField label="Email" fullWidth size="small" type="email" value={reg.email} onChange={(e) => setReg({ ...reg, email: e.target.value })} />
          <TextField label="Phone" fullWidth size="small" value={reg.phone} onChange={(e) => setReg({ ...reg, phone: e.target.value })} />
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100">
          <Button onClick={closeDialog} className="text-slate-600">Cancel</Button>
          <Button onClick={submitRegister} variant="contained" disabled={submitting} sx={{ backgroundColor: '#0a5bd7' }}>{submitting ? <CircularProgress size={22} color="inherit" /> : 'Register'}</Button>
        </DialogActions>
      </Dialog>

      {/* Rent out */}
      <Dialog open={dialog === 'rent'} onClose={closeDialog} maxWidth="sm" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold border-b border-slate-100">Rent Out Flat</DialogTitle>
        <DialogContent className="pt-6 space-y-4">
          <Typography variant="caption" className="font-bold text-slate-500 uppercase">Tenant</Typography>
          <TextField label="Tenant Name" fullWidth size="small" value={rent.name} onChange={(e) => setRent({ ...rent, name: e.target.value })} />
          <div className="flex gap-2">
            <TextField label="Email" fullWidth size="small" value={rent.email} onChange={(e) => setRent({ ...rent, email: e.target.value })} />
            <TextField label="Phone" fullWidth size="small" value={rent.phone} onChange={(e) => setRent({ ...rent, phone: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <TextField label="Monthly Rent (₹)" type="number" fullWidth size="small" value={rent.rentAmount} onChange={(e) => setRent({ ...rent, rentAmount: e.target.value })} />
            <TextField label="Security Deposit (₹)" type="number" fullWidth size="small" value={rent.securityDeposit} onChange={(e) => setRent({ ...rent, securityDeposit: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <TextField label="Start" type="date" fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} value={rent.startDate} onChange={(e) => setRent({ ...rent, startDate: e.target.value })} />
            <TextField label="End" type="date" fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} value={rent.endDate} onChange={(e) => setRent({ ...rent, endDate: e.target.value })} />
          </div>
          <div className="flex items-center justify-between">
            <Typography variant="caption" className="font-bold text-slate-500 uppercase">Household ({rentOccupants.length})</Typography>
            <Button size="small" startIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setRentOccupants([...rentOccupants, { name: '', relationship: 'SPOUSE' }])}>Add</Button>
          </div>
          {rentOccupants.map((o, i) => (
            <div key={i} className="flex gap-2 items-center">
              <TextField label="Name" size="small" fullWidth value={o.name} onChange={(e) => setRentOccupants(rentOccupants.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select value={o.relationship} onChange={(e) => setRentOccupants(rentOccupants.map((x, j) => j === i ? { ...x, relationship: e.target.value } : x))}>
                  {['SPOUSE', 'CHILD', 'PARENT', 'OTHER'].map((r) => <MenuItem key={r} value={r}>{r[0] + r.slice(1).toLowerCase()}</MenuItem>)}
                </Select>
              </FormControl>
              <IconButton size="small" onClick={() => setRentOccupants(rentOccupants.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 text-rose-500" /></IconButton>
            </div>
          ))}
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100">
          <Button onClick={closeDialog} className="text-slate-600">Cancel</Button>
          <Button onClick={submitRent} variant="contained" disabled={submitting} sx={{ backgroundColor: '#0a5bd7' }}>{submitting ? <CircularProgress size={22} color="inherit" /> : 'Rent Out'}</Button>
        </DialogActions>
      </Dialog>

      {/* Sell */}
      <Dialog open={dialog === 'sell'} onClose={closeDialog} maxWidth="sm" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold border-b border-slate-100">Sell / Transfer Ownership</DialogTitle>
        <DialogContent className="pt-6 space-y-4">
          <p className="text-xs text-slate-500 -mt-1">The current owner and any sitting tenants are moved out, and the buyer becomes the new owner.</p>
          <TextField label="Buyer Name" fullWidth size="small" value={sell.name} onChange={(e) => setSell({ ...sell, name: e.target.value })} />
          <div className="flex gap-2">
            <TextField label="Email" fullWidth size="small" value={sell.email} onChange={(e) => setSell({ ...sell, email: e.target.value })} />
            <TextField label="Phone" fullWidth size="small" value={sell.phone} onChange={(e) => setSell({ ...sell, phone: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <TextField label="Sale Amount (₹)" type="number" fullWidth size="small" value={sell.saleAmount} onChange={(e) => setSell({ ...sell, saleAmount: e.target.value })} />
            <TextField label="Sale Date" type="date" fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} value={sell.saleDate} onChange={(e) => setSell({ ...sell, saleDate: e.target.value })} />
          </div>
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100">
          <Button onClick={closeDialog} className="text-slate-600">Cancel</Button>
          <Button onClick={submitSell} variant="contained" color="primary" disabled={submitting}>{submitting ? <CircularProgress size={22} color="inherit" /> : 'Transfer'}</Button>
        </DialogActions>
      </Dialog>

      {/* Simple date actions: end tenancy / move in / vacant */}
      <Dialog open={dialog === 'endTenancy' || dialog === 'moveIn' || dialog === 'vacant'} onClose={closeDialog} maxWidth="xs" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold border-b border-slate-100">
          {dialog === 'endTenancy' ? 'End Tenancy' : dialog === 'moveIn' ? 'Owner Move In' : 'Mark Vacant'}
        </DialogTitle>
        <DialogContent className="pt-6 space-y-3">
          <p className="text-sm text-slate-500">
            {dialog === 'endTenancy' ? 'Close the active tenancy and move the tenant out.' : dialog === 'moveIn' ? 'Record the owner moving into this flat.' : 'End current occupancy and mark the flat vacant.'}
          </p>
          <TextField label="Effective Date" type="date" fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} value={actionDate} onChange={(e) => setActionDate(e.target.value)} />
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100">
          <Button onClick={closeDialog} className="text-slate-600">Cancel</Button>
          <Button variant="contained" disabled={submitting} onClick={() => {
            const path = dialog === 'endTenancy' ? 'end-tenancy' : dialog === 'moveIn' ? 'move-in' : 'set-vacant';
            call(() => api.post(`/societies/flats/${flatId}/${path}`, { date: actionDate }));
          }}>{submitting ? <CircularProgress size={22} color="inherit" /> : 'Confirm'}</Button>
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
