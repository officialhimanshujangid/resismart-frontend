'use client';

import React, { useState, useRef } from 'react';
import api from '@/lib/api';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import OtpVerifyField from '@/components/common/OtpVerifyField';
import {
  Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Menu, MenuItem, Divider, IconButton, FormControl, Select, Typography,
  FormControlLabel, Switch
} from '@mui/material';
import { Upload, ChevronDown, Settings, Plus, Trash2 } from 'lucide-react';

const today = () => new Date().toISOString().slice(0, 10);
const plusMonths = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
const cap = (s: string) => s ? s[0] + s.slice(1).toLowerCase() : s;
const FAMILY_RELATIONS = ['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'RELATIVE', 'STAFF', 'OTHER'];

type DialogKind = null | 'rent' | 'sell' | 'endTenancy' | 'moveIn' | 'vacant';

interface Props {
  flatId: string;
  flatStatus: string;
  onComplete: () => void;
  variant?: 'button' | 'icon';
  canManage?: boolean;
  canSell?: boolean;
}

export interface FlatLifecycleManagerHandle {
  openAction: (action: DialogKind) => void;
}

const FlatLifecycleManager = React.forwardRef<FlatLifecycleManagerHandle, Props>(({ flatId, flatStatus, onComplete, variant = 'button', canManage = true, canSell = true }, ref) => {
  const { showToast } = useToastConfirm();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [submitting, setSubmitting] = useState(false);

  React.useImperativeHandle(ref, () => ({
    openAction: (action: DialogKind) => setDialog(action)
  }));

  // rent-out state
  const [rentTerms, setRentTerms] = useState({ rentAmount: '', securityDeposit: '', startDate: today(), endDate: plusMonths(11) });
  type TenantRow = { name: string; email: string; phone: string; relationship: string; isHead: boolean };
  const [tenants, setTenants] = useState<TenantRow[]>([{ name: '', email: '', phone: '', relationship: 'TENANT', isHead: true }]);
  const [rentDocFile, setRentDocFile] = useState<File | null>(null);
  const rentFileRef = useRef<HTMLInputElement>(null);

  // sell state
  const [sell, setSell] = useState({ name: '', email: '', phone: '', saleAmount: '', saleDate: today() });
  const [sellEmailToken, setSellEmailToken] = useState<string | null>(null);
  const [sellPhoneToken, setSellPhoneToken] = useState<string | null>(null);

  // simple date actions state
  const [actionDate, setActionDate] = useState(today());

  const closeDialog = () => { setDialog(null); setSubmitting(false); };
  
  const call = async (fn: () => Promise<any>) => {
    setSubmitting(true);
    try { const res = await fn(); showToast(res?.data?.message || 'Done', 'success'); closeDialog(); onComplete(); }
    catch (err: any) { showToast(err.response?.data?.error || err.response?.data?.errors?.[0]?.message || 'Action failed', 'error'); }
    finally { setSubmitting(false); }
  };

  const setTenant = (i: number, patch: Partial<TenantRow>) => setTenants(tenants.map((t, j) => j === i ? { ...t, ...patch } : t));
  const setHeadTenant = (i: number) => setTenants(tenants.map((t, j) => ({ ...t, isHead: j === i })));

  const submitRent = async () => {
    const filled = tenants.filter((t) => t.name.trim());
    if (!filled.length) return showToast('Add at least one tenant', 'error');
    const head = filled.find((t) => t.isHead) || filled[0];
    if (!head.email.trim() && !head.phone.trim()) return showToast('The primary tenant needs an email or phone', 'error');
    setSubmitting(true);
    try {
      let documents: any[] = [];
      if (rentDocFile) {
        const fd = new FormData(); fd.append('file', rentDocFile);
        const up = await api.post('/upload/document', fd);
        documents = [{ kind: 'AGREEMENT', label: rentDocFile.name, key: up.data.key, url: up.data.url }];
      }
      const res = await api.post(`/societies/flats/${flatId}/rent-out`, {
        tenants: filled.map((t) => ({ name: t.name, email: t.email || undefined, phone: t.phone || undefined, relationship: t.relationship, isHead: t === head })),
        rentAmount: Number(rentTerms.rentAmount || 0), securityDeposit: Number(rentTerms.securityDeposit || 0),
        startDate: rentTerms.startDate, endDate: rentTerms.endDate || undefined, documents,
      });
      showToast(res?.data?.message || 'Flat rented out', 'success');
      setRentDocFile(null); closeDialog(); onComplete();
    } catch (err: any) {
      showToast(err.response?.data?.error || err.response?.data?.errors?.[0]?.message || 'Action failed', 'error');
    } finally { setSubmitting(false); }
  };

  const submitSell = () => {
    if (!sell.name.trim() || (!sell.email.trim() && !sell.phone.trim())) return showToast('Buyer name and an email or phone are required', 'error');
    if (sell.email.trim() && !sellEmailToken) return showToast('Verify buyer email with an OTP, or clear it', 'error');
    if (sell.phone.trim() && !sellPhoneToken) return showToast('Verify buyer phone with an OTP, or clear it', 'error');
    call(() => api.post(`/societies/flats/${flatId}/sell`, {
      buyer: { name: sell.name, email: sell.email, phone: sell.phone },
      saleAmount: sell.saleAmount ? Number(sell.saleAmount) : undefined, saleDate: sell.saleDate,
      emailToken: sellEmailToken || undefined, phoneToken: sellPhoneToken || undefined,
    }));
  };

  if (!canManage && !canSell) return null;

  return (
    <>
      {variant === 'button' ? (
        <Button 
          variant="outlined" 
          size="small"
          endIcon={<ChevronDown className="w-4 h-4" />} 
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{ borderColor: '#e2e8f0', color: '#475569', '&:hover': { borderColor: '#cbd5e1', bgcolor: '#f8fafc' }, fontWeight: 700 }}
        >
          Manage Flat
        </Button>
      ) : (
        <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ color: '#64748b' }}>
          <Settings className="w-5 h-5" />
        </IconButton>
      )}

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { className: 'rounded-xl border border-slate-100 shadow-xl', elevation: 0 } }}>
        {canManage && flatStatus !== 'RENTED' && <MenuItem onClick={() => { setAnchorEl(null); setDialog('rent'); }} className="text-sm font-semibold text-slate-700">Rent Out...</MenuItem>}
        {canManage && flatStatus === 'VACANT' && <MenuItem onClick={() => { setAnchorEl(null); setDialog('moveIn'); }} className="text-sm font-semibold text-slate-700">Owner Move In...</MenuItem>}
        {canManage && flatStatus === 'RENTED' && <MenuItem onClick={() => { setAnchorEl(null); setDialog('endTenancy'); }} className="text-sm font-semibold text-rose-600">End Tenancy...</MenuItem>}
        {canManage && flatStatus === 'OWNER_OCCUPIED' && <MenuItem onClick={() => { setAnchorEl(null); setDialog('vacant'); }} className="text-sm font-semibold text-slate-700">Move Out (Mark Vacant)...</MenuItem>}
        {canManage && <Divider className="my-1" />}
        {canSell && <MenuItem onClick={() => { setAnchorEl(null); setDialog('sell'); }} className="text-sm font-bold text-[#0a5bd7]">Sell / Transfer Ownership...</MenuItem>}
      </Menu>

      {/* Rent Out Dialog */}
      <Dialog open={dialog === 'rent'} onClose={closeDialog} maxWidth="sm" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold border-b border-slate-100">Rent Out Flat</DialogTitle>
        <DialogContent className="pt-6 space-y-4">
          <p className="text-xs text-slate-500 -mt-1">Rent to a <strong>family</strong>, a group of <strong>friends sharing</strong>, or a mix. Add each person: mark co-tenants as <strong>Co-tenant / Friend</strong> and relatives with their relationship. The person marked <strong>Primary</strong> is the lead tenant on the agreement and needs a contact.</p>
          <div className="flex items-center justify-between">
            <Typography variant="caption" className="font-bold text-slate-500 uppercase">Tenant household ({tenants.length})</Typography>
            <Button size="small" startIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setTenants([...tenants, { name: '', email: '', phone: '', relationship: 'TENANT', isHead: false }])}>Add person</Button>
          </div>
          {tenants.map((t, i) => (
            <div key={i} className={`rounded-xl border p-3 space-y-2 ${t.isHead ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200/70'}`}>
              <div className="flex items-center gap-2">
                <TextField label="Full name" size="small" fullWidth value={t.name} onChange={(e) => setTenant(i, { name: e.target.value })} />
                <FormControl size="small" sx={{ minWidth: 150 }}>
                  <Select value={t.relationship} onChange={(e) => setTenant(i, { relationship: e.target.value })}>
                    <MenuItem value="TENANT">Co-tenant / Friend</MenuItem>
                    {FAMILY_RELATIONS.map((r) => <MenuItem key={r} value={r}>{cap(r)}</MenuItem>)}
                  </Select>
                </FormControl>
                {tenants.length > 1 && <IconButton size="small" onClick={() => { const next = tenants.filter((_, j) => j !== i); if (!next.some((x) => x.isHead) && next[0]) next[0].isHead = true; setTenants([...next]); }}><Trash2 className="w-4 h-4 text-rose-500" /></IconButton>}
              </div>
              <div className="flex gap-2">
                <TextField label="Email" size="small" fullWidth value={t.email} onChange={(e) => setTenant(i, { email: e.target.value })} />
                <TextField label="Phone" size="small" fullWidth value={t.phone} onChange={(e) => setTenant(i, { phone: e.target.value })} />
              </div>
              <FormControlLabel control={<Switch size="small" checked={t.isHead} onChange={() => setHeadTenant(i)} />} label={<span className="text-xs font-semibold">Primary tenant (lead on agreement)</span>} />
            </div>
          ))}
          <Divider />
          <div className="flex gap-2">
            <TextField label="Monthly Rent (₹)" type="number" fullWidth size="small" value={rentTerms.rentAmount} onChange={(e) => setRentTerms({ ...rentTerms, rentAmount: e.target.value })} />
            <TextField label="Security Deposit (₹)" type="number" fullWidth size="small" value={rentTerms.securityDeposit} onChange={(e) => setRentTerms({ ...rentTerms, securityDeposit: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <TextField label="Start" type="date" fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} value={rentTerms.startDate} onChange={(e) => setRentTerms({ ...rentTerms, startDate: e.target.value })} />
            <TextField label="End" type="date" fullWidth size="small" slotProps={{ inputLabel: { shrink: true } }} value={rentTerms.endDate} onChange={(e) => setRentTerms({ ...rentTerms, endDate: e.target.value })} />
          </div>
          <Typography variant="caption" className="font-bold text-slate-500 uppercase">Rental agreement (optional)</Typography>
          <input ref={rentFileRef} type="file" accept="application/pdf,image/*" hidden onChange={(e) => setRentDocFile(e.target.files?.[0] || null)} />
          <Button variant="outlined" fullWidth startIcon={<Upload className="w-4 h-4" />} onClick={() => rentFileRef.current?.click()} sx={{ textTransform: 'none' }}>
            {rentDocFile ? rentDocFile.name : 'Attach agreement (PDF/image)'}
          </Button>
        </DialogContent>
        <DialogActions className="p-4 border-t border-slate-100">
          <Button onClick={closeDialog} className="text-slate-600">Cancel</Button>
          <Button onClick={submitRent} variant="contained" disabled={submitting} sx={{ backgroundColor: '#0a5bd7' }}>{submitting ? <CircularProgress size={22} color="inherit" /> : 'Rent Out'}</Button>
        </DialogActions>
      </Dialog>

      {/* Sell Dialog */}
      <Dialog open={dialog === 'sell'} onClose={closeDialog} maxWidth="sm" fullWidth slotProps={{ paper: { className: 'rounded-2xl' } }}>
        <DialogTitle className="font-bold border-b border-slate-100">Sell / Transfer Ownership</DialogTitle>
        <DialogContent className="pt-6 space-y-4">
          <p className="text-xs text-slate-500 -mt-1">The current owner and any sitting tenants are moved out, and the buyer becomes the new owner.</p>
          <TextField label="Buyer Name" fullWidth size="small" value={sell.name} onChange={(e) => setSell({ ...sell, name: e.target.value })} />
          <div className="flex gap-2">
            <div className="flex-1 flex flex-col">
              <TextField label="Email" fullWidth size="small" value={sell.email} onChange={(e) => { setSell({ ...sell, email: e.target.value }); setSellEmailToken(null); }} />
              {sell.email.trim() && <OtpVerifyField channel="EMAIL" target={sell.email} purpose="FLAT_REGISTRATION" onVerified={setSellEmailToken} onReset={() => setSellEmailToken(null)} />}
            </div>
            <div className="flex-1 flex flex-col">
              <TextField label="Phone" fullWidth size="small" value={sell.phone} onChange={(e) => { setSell({ ...sell, phone: e.target.value }); setSellPhoneToken(null); }} />
              {sell.phone.trim() && <OtpVerifyField channel="PHONE" target={sell.phone} purpose="FLAT_REGISTRATION" onVerified={setSellPhoneToken} onReset={() => setSellPhoneToken(null)} />}
            </div>
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

      {/* Simple date actions */}
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
    </>
  );
});

export default FlatLifecycleManager;
