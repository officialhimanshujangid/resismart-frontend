'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Paper, Button, TextField, CircularProgress, Switch, FormControl, Select, MenuItem, FormControlLabel } from '@mui/material';
import { CalendarRange, Percent, BellRing, ReceiptText, CheckCheck } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';

const Label = ({ children }: { children: React.ReactNode }) => <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{children}</span>;
const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <Paper elevation={0} className="p-5 rounded-2xl border border-slate-200/60 space-y-4">
    <div className="flex items-center gap-2 text-slate-700 font-black text-sm">{icon}{title}</div>
    {children}
  </Paper>
);

export default function FinanceSettingsPage() {
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [p, setP] = useState<any>(null);

  const load = async () => {
    try { setLoading(true); const res = await api.get('/finance/society/policy'); setP(res.data); }
    catch (e: any) { showToast(e.response?.data?.error || 'Failed to load', 'error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const upd = (section: string, patch: any) => setP((prev: any) => ({ ...prev, [section]: { ...prev[section], ...patch } }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/finance/society/policy', {
        financialYear: p.financialYear,
        billing: p.billing,
        lateFee: p.lateFee,
        reminders: p.reminders,
        gst: p.gst,
        gstin: p.gstin,
        rounding: p.rounding,
        approvals: p.approvals,
      });
      showToast('Finance settings saved', 'success'); load();
    } catch (e: any) { showToast(e.response?.data?.error || 'Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  if (loading || !p) return <div className="flex justify-center p-12"><CircularProgress size={32} /></div>;
  const rupees = (paise?: number) => ((paise || 0) / 100).toString();

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-3xl">
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Finance Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure billing rules, penalties, reminders and tax to your society's norms</p>
      </div>

      <Section icon={<CalendarRange className="w-4 h-4" />} title="Financial Year & Billing">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1"><Label>FY start month</Label>
            <FormControl fullWidth size="small"><Select value={p.financialYear.startMonth} onChange={e => upd('financialYear', { startMonth: e.target.value })}>{['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}</Select></FormControl>
          </div>
          <div className="space-y-1"><Label>Auto-generate</Label>
            <FormControlLabel control={<Switch checked={p.billing?.autoGenerateEnabled || false} onChange={e => upd('billing', { autoGenerateEnabled: e.target.checked })} />} label={<span className="text-sm">On</span>} />
          </div>
          <div className="space-y-1"><Label>Generate on day</Label>
            <TextField hiddenLabel fullWidth size="small" type="number" value={p.billing?.generationDay || 1} onChange={e => upd('billing', { generationDay: Number(e.target.value) })} />
          </div>
        </div>
      </Section>

      <Section icon={<Percent className="w-4 h-4" />} title="Late Fee / Interest on Arrears">
        <FormControlLabel control={<Switch checked={p.lateFee.enabled} onChange={e => upd('lateFee', { enabled: e.target.checked })} />} label={<span className="text-sm font-semibold">Charge interest on overdue dues</span>} />
        {p.lateFee.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Mode</Label>
              <FormControl fullWidth size="small"><Select value={p.lateFee.mode} onChange={e => upd('lateFee', { mode: e.target.value })}>
                <MenuItem value="FLAT">Flat amount</MenuItem><MenuItem value="PERCENT_PER_MONTH">% per month</MenuItem><MenuItem value="PERCENT_PER_ANNUM">% per annum</MenuItem><MenuItem value="SLAB">Slab</MenuItem>
              </Select></FormControl>
            </div>
            {p.lateFee.mode === 'FLAT'
              ? <div className="space-y-1"><Label>Flat amount (₹)</Label><TextField hiddenLabel fullWidth size="small" type="number" value={rupees(p.lateFee.flatAmountPaise)} onChange={e => upd('lateFee', { flatAmountPaise: Math.round(parseFloat(e.target.value || '0') * 100) })} /></div>
              : <div className="space-y-1"><Label>Rate (%)</Label><TextField hiddenLabel fullWidth size="small" type="number" value={p.lateFee.ratePercent ?? ''} onChange={e => upd('lateFee', { ratePercent: Number(e.target.value) })} /></div>}
            <div className="space-y-1"><Label>Grace days</Label><TextField hiddenLabel fullWidth size="small" type="number" value={p.lateFee.graceDays ?? 0} onChange={e => upd('lateFee', { graceDays: Number(e.target.value) })} /></div>
            <div className="space-y-1"><Label>Cap per invoice (₹, 0 = none)</Label><TextField hiddenLabel fullWidth size="small" type="number" value={rupees(p.lateFee.capPerInvoicePaise)} onChange={e => upd('lateFee', { capPerInvoicePaise: Math.round(parseFloat(e.target.value || '0') * 100) })} /></div>
          </div>
        )}
      </Section>

      <Section icon={<BellRing className="w-4 h-4" />} title="Reminders">
        <FormControlLabel control={<Switch checked={p.reminders.enabled} onChange={e => upd('reminders', { enabled: e.target.checked })} />} label={<span className="text-sm font-semibold">Send due-date reminders</span>} />
        {p.reminders.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Days before due (comma-sep)</Label><TextField hiddenLabel fullWidth size="small" value={(p.reminders.beforeDueDays || []).join(',')} onChange={e => upd('reminders', { beforeDueDays: e.target.value.split(',').map((x: string) => Number(x.trim())).filter((n: number) => n > 0) })} /></div>
            <div className="space-y-1"><Label>Days after due (comma-sep)</Label><TextField hiddenLabel fullWidth size="small" value={(p.reminders.afterDueDays || []).join(',')} onChange={e => upd('reminders', { afterDueDays: e.target.value.split(',').map((x: string) => Number(x.trim())).filter((n: number) => n > 0) })} /></div>
          </div>
        )}
      </Section>

      <Section icon={<ReceiptText className="w-4 h-4" />} title="GST & Rounding">
        <FormControlLabel control={<Switch checked={p.gst.enabled} onChange={e => upd('gst', { enabled: e.target.checked })} />} label={<span className="text-sm font-semibold">Apply GST on maintenance</span>} />
        {p.gst.enabled && (
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><Label>Default rate (%)</Label><TextField hiddenLabel fullWidth size="small" type="number" value={p.gst.defaultRatePercent} onChange={e => upd('gst', { defaultRatePercent: Number(e.target.value) })} /></div>
            <div className="space-y-1"><Label>Default SAC</Label><TextField hiddenLabel fullWidth size="small" value={p.gst.defaultSac} onChange={e => upd('gst', { defaultSac: e.target.value })} /></div>
            <div className="space-y-1"><Label>GSTIN</Label><TextField hiddenLabel fullWidth size="small" value={p.gstin || ''} onChange={e => setP((prev: any) => ({ ...prev, gstin: e.target.value }))} /></div>
          </div>
        )}
        <div className="space-y-1"><Label>Invoice rounding</Label>
          <FormControl fullWidth size="small"><Select value={p.rounding.mode} onChange={e => upd('rounding', { mode: e.target.value })}><MenuItem value="NONE">No rounding</MenuItem><MenuItem value="NEAREST_RUPEE">Nearest rupee</MenuItem><MenuItem value="CEIL_RUPEE">Round up to rupee</MenuItem></Select></FormControl>
        </div>
      </Section>

      <Section icon={<CheckCheck className="w-4 h-4" />} title="Approvals">
        <div className="space-y-1"><Label>Expense approval threshold (₹) — above this a different approver is required</Label>
          <TextField hiddenLabel fullWidth size="small" type="number" value={rupees(p.approvals.expenseThresholdPaise)} onChange={e => upd('approvals', { expenseThresholdPaise: Math.round(parseFloat(e.target.value || '0') * 100) })} />
        </div>
      </Section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} variant="contained" className="px-8 py-2.5 font-bold">{saving ? <CircularProgress size={20} color="inherit" /> : 'Save Settings'}</Button>
      </div>
    </div>
  );
}
