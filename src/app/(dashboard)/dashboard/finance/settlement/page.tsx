'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Paper, Button, TextField, CircularProgress, Radio } from '@mui/material';
import { Landmark, ShieldCheck, Copy, Info, Wallet, Building2 } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

const MODES = [
  { v: 'OFFLINE_ONLY', title: 'Offline only', desc: 'Track cash / UPI / cheque manually. No online gateway.', icon: Wallet },
  { v: 'OWN_KEYS', title: 'Our own Razorpay', desc: 'Residents pay into YOUR society Razorpay account. Money never touches the platform.', icon: ShieldCheck },
  { v: 'PLATFORM_COLLECT_PAYOUT', title: 'Platform collects & pays out', desc: 'Platform collects online and settles to your society bank account.', icon: Landmark },
  { v: 'PLATFORM_ROUTE', title: 'Platform (Route split)', desc: 'Platform gateway with automatic split-settlement to your linked account.', icon: Building2 },
];

export default function SettlementPage() {
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('OFFLINE_ONLY');
  const [status, setStatus] = useState<any>(null);
  const [f, setF] = useState({ upiId: '', keyId: '', keySecret: '', webhookSecret: '', routeAccountId: '', payoutAccountName: '', payoutAccountNumber: '', payoutIfsc: '', payoutBankName: '' });

  const set = (patch: Partial<typeof f>) => setF(v => ({ ...v, ...patch }));

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get('/finance/society/settlement');
      setStatus(res.data); setMode(res.data.mode);
      set({ upiId: res.data.upiId || '', keyId: res.data.ownKeys?.keyId || '', routeAccountId: res.data.routeAccountId || '',
        payoutAccountName: res.data.payoutBank?.accountName || '', payoutIfsc: res.data.payoutBank?.ifsc || '', payoutBankName: res.data.payoutBank?.bankName || '' });
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to load', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Which required fields are satisfied for the chosen mode
  const canSave = (() => {
    if (mode === 'OWN_KEYS') return !!f.keyId && (!!f.keySecret || status?.ownKeys?.hasSecret) && (!!f.webhookSecret || status?.ownKeys?.hasWebhookSecret);
    if (mode === 'PLATFORM_ROUTE') return !!f.routeAccountId;
    if (mode === 'PLATFORM_COLLECT_PAYOUT') return !!status?.payoutBank?.last4 || (!!f.payoutAccountName && !!f.payoutAccountNumber && !!f.payoutIfsc && !!f.payoutBankName);
    return true; // OFFLINE_ONLY
  })();

  const save = async () => {
    setSaving(true);
    try {
      const body: any = { mode, upiId: f.upiId };
      if (mode === 'OWN_KEYS') { body.keyId = f.keyId; if (f.keySecret) body.keySecret = f.keySecret; if (f.webhookSecret) body.webhookSecret = f.webhookSecret; }
      if (mode === 'PLATFORM_ROUTE') body.routeAccountId = f.routeAccountId;
      if (mode === 'PLATFORM_COLLECT_PAYOUT') { body.payoutAccountName = f.payoutAccountName; body.payoutIfsc = f.payoutIfsc; body.payoutBankName = f.payoutBankName; if (f.payoutAccountNumber) body.payoutAccountNumber = f.payoutAccountNumber; }
      await api.put('/finance/society/settlement', body);
      showToast('Settlement settings saved', 'success'); set({ keySecret: '', webhookSecret: '', payoutAccountNumber: '' }); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  const Label = ({ children }: { children: React.ReactNode }) => <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{children}</span>;

  if (loading) return <div className="flex justify-center p-12"><CircularProgress size={32} /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Payment Settlement</h1>
        <p className="text-sm text-slate-500 mt-0.5">Choose how residents' online payments reach your society</p>
      </div>

      <div className="space-y-3">
        {MODES.map(m => {
          const Icon = m.icon;
          return (
            <Paper key={m.v} elevation={0} onClick={() => setMode(m.v)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${mode === m.v ? 'border-blue-400 bg-blue-50/40' : 'border-slate-200/60 hover:border-slate-300'}`}>
              <Radio checked={mode === m.v} size="small" className="mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2"><Icon className={`w-4 h-4 ${m.v === 'OWN_KEYS' ? 'text-emerald-600' : 'text-slate-500'}`} /><span className="font-bold text-slate-800">{m.title}</span></div>
                <p className="text-sm text-slate-500 mt-0.5">{m.desc}</p>
              </div>
            </Paper>
          );
        })}
      </div>

      {/* Mode-specific required fields */}
      {mode === 'OWN_KEYS' && (
        <Paper elevation={0} className="p-5 rounded-2xl border border-slate-200/60 space-y-4">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Your Razorpay credentials <span className="text-red-500">*</span></p>
          <div className="space-y-1"><Label>Key ID *</Label><TextField hiddenLabel fullWidth size="small" placeholder="rzp_live_xxxx" value={f.keyId} onChange={e => set({ keyId: e.target.value })} /></div>
          <div className="space-y-1"><Label>Key Secret {status?.ownKeys?.hasSecret ? <span className="text-emerald-600">(saved — blank keeps it)</span> : <span className="text-red-500">*</span>}</Label><TextField hiddenLabel fullWidth size="small" type="password" placeholder="••••••••" value={f.keySecret} onChange={e => set({ keySecret: e.target.value })} /></div>
          <div className="space-y-1"><Label>Webhook Secret {status?.ownKeys?.hasWebhookSecret ? <span className="text-emerald-600">(saved)</span> : <span className="text-red-500">*</span>}</Label><TextField hiddenLabel fullWidth size="small" type="password" placeholder="••••••••" value={f.webhookSecret} onChange={e => set({ webhookSecret: e.target.value })} /></div>
          {status?.webhookUrl && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 space-y-1">
              <p className="flex items-center gap-1 font-semibold"><Info className="w-4 h-4" /> Add this webhook URL in your Razorpay dashboard (event <code>payment_link.paid</code>):</p>
              <div className="flex items-center gap-2 mt-1"><code className="bg-white px-2 py-1 rounded border border-blue-100 flex-1 truncate">{status.webhookUrl}</code><Button size="small" startIcon={<Copy className="w-3 h-3" />} onClick={() => { navigator.clipboard.writeText(status.webhookUrl); showToast('Copied', 'success'); }}>Copy</Button></div>
            </div>
          )}
        </Paper>
      )}

      {mode === 'PLATFORM_ROUTE' && (
        <Paper elevation={0} className="p-5 rounded-2xl border border-slate-200/60 space-y-2">
          <Label>Razorpay Route linked-account id *</Label>
          <TextField hiddenLabel fullWidth size="small" placeholder="acc_XXXXXXXX" value={f.routeAccountId} onChange={e => set({ routeAccountId: e.target.value })} />
          <p className="text-xs text-slate-500">Your society must be onboarded as a Razorpay Route linked account; paste its <code>acc_...</code> id here.</p>
        </Paper>
      )}

      {mode === 'PLATFORM_COLLECT_PAYOUT' && (
        <Paper elevation={0} className="p-5 rounded-2xl border border-slate-200/60 space-y-4">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">Society payout bank account <span className="text-red-500">*</span></p>
          {status?.payoutBank?.last4 && <p className="text-xs text-emerald-600 font-semibold">Saved: {status.payoutBank.bankName} ••••{status.payoutBank.last4}. Fill the number only to change it.</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Account holder *</Label><TextField hiddenLabel fullWidth size="small" value={f.payoutAccountName} onChange={e => set({ payoutAccountName: e.target.value })} /></div>
            <div className="space-y-1"><Label>Account number {status?.payoutBank?.last4 ? '' : '*'}</Label><TextField hiddenLabel fullWidth size="small" value={f.payoutAccountNumber} onChange={e => set({ payoutAccountNumber: e.target.value })} /></div>
            <div className="space-y-1"><Label>IFSC *</Label><TextField hiddenLabel fullWidth size="small" value={f.payoutIfsc} onChange={e => set({ payoutIfsc: e.target.value.toUpperCase() })} /></div>
            <div className="space-y-1"><Label>Bank name *</Label><TextField hiddenLabel fullWidth size="small" value={f.payoutBankName} onChange={e => set({ payoutBankName: e.target.value })} /></div>
          </div>
        </Paper>
      )}

      {/* UPI id — useful for offline collection in any mode */}
      <Paper elevation={0} className="p-5 rounded-2xl border border-slate-200/60 space-y-2">
        <Label>Society UPI ID (shown to residents for offline payment)</Label>
        <TextField hiddenLabel fullWidth size="small" placeholder="society@upi" value={f.upiId} onChange={e => set({ upiId: e.target.value })} />
      </Paper>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || !canSave} variant="contained" className="px-8 py-2.5 font-bold">{saving ? <CircularProgress size={20} color="inherit" /> : 'Save Settlement Settings'}</Button>
      </div>
    </div>
  );
}
