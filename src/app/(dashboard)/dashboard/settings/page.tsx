'use client';

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button, TextField, CircularProgress, Paper, Grid } from '@mui/material';
import { Save, SlidersHorizontal, Info, ShieldCheck, BellRing } from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import ModuleScope from '@/components/common/ModuleScope';

const CAPABILITY_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: 'max_flat_count', label: 'Max Flats', hint: 'Flats allowed on the free tier' },
  { key: 'max_staff_count', label: 'Max Staff', hint: 'Staff members on the free tier' },
  { key: 'max_member_count', label: 'Max Members', hint: 'Residents / members on the free tier' },
  { key: 'max_visitor_count', label: 'Max Visitors', hint: 'Visitor entries on the free tier' },
  { key: 'max_tickets_count', label: 'Max Tickets', hint: 'Support tickets on the free tier' },
  { key: 'max_service_count', label: 'Max Services', hint: 'Service listings on the free tier' },
];

export default function SettingsPage() {
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gracePeriodDays, setGracePeriodDays] = useState<number>(7);
  const [caps, setCaps] = useState<Record<string, number>>({});
  const [reminderDaysInput, setReminderDaysInput] = useState('3,1');

  useEffect(() => {
    api.get('/settings')
      .then((res) => {
        const s = res.data.settings;
        setGracePeriodDays(s.gracePeriodDays ?? 7);
        setCaps(s.defaultTrialCapabilities || {});
        if (Array.isArray(s.expiryReminderDays)) setReminderDaysInput(s.expiryReminderDays.join(', '));
      })
      .catch(() => showToast('Failed to load settings', 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parseReminderDays = (raw: string): number[] => {
    const nums = raw
      .split(',')
      .map((p) => parseInt(p.trim(), 10))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 90);
    return [...new Set(nums)].sort((a, b) => b - a);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings', {
        gracePeriodDays: Number(gracePeriodDays),
        defaultTrialCapabilities: Object.fromEntries(CAPABILITY_FIELDS.map((c) => [c.key, Number(caps[c.key] ?? 0)])),
        expiryReminderDays: parseReminderDays(reminderDaysInput),
      });
      showToast('Settings saved successfully', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-32"><CircularProgress size={34} thickness={4} /></div>;
  }

  const sectionHeader = (icon: React.ReactNode, title: string, desc: string, tone: string) => (
    <div className="flex items-start gap-3 mb-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>{icon}</div>
      <div>
        <h2 className="text-sm font-black text-slate-800">{title}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl pb-4">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0a5bd7] to-[#2691f5] p-6 md:p-7 shadow-lg shadow-blue-500/10">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-white tracking-tight">System Settings</h1>
              <ModuleScope scope="system" />
            </div>
            <p className="text-sm text-blue-100 mt-1">Free-tier limits, grace period and automated reminders for tenants</p>
          </div>
          <Button onClick={handleSave} disabled={saving} variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save className="w-4 h-4" />}
            sx={{ whiteSpace: 'nowrap', backgroundImage: 'none', backgroundColor: '#fff', color: '#0a5bd7', '&:hover': { backgroundColor: '#f1f5f9', backgroundImage: 'none' } }}>
            Save Changes
          </Button>
        </div>
      </div>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <div className="space-y-5">
            {/* Grace period */}
            <Paper elevation={0} className="p-6 rounded-2xl border border-slate-200/70">
              {sectionHeader(<SlidersHorizontal className="w-5 h-5" />, 'Grace Period', 'Buffer after a paid plan ends, before the free tier kicks in', 'bg-violet-50 text-violet-600')}
              <div className="flex items-end gap-4 flex-wrap">
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Grace Period (days)</span>
                  <TextField hiddenLabel type="number" value={gracePeriodDays} onChange={(e) => setGracePeriodDays(Number(e.target.value))} sx={{ width: 140 }} />
                </div>
                <p className="text-sm text-slate-500 pb-2 max-w-sm">Societies keep <strong>full access</strong> for this many days after their plan ends — then drop to free-tier limits if still unpaid.</p>
              </div>
            </Paper>

            {/* Reminders */}
            <Paper elevation={0} className="p-6 rounded-2xl border border-slate-200/70">
              {sectionHeader(<BellRing className="w-5 h-5" />, 'Expiry Reminder Emails', 'Automatic reminders before a plan expires', 'bg-amber-50 text-amber-600')}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Days Before Expiry (comma-separated)</span>
                <TextField hiddenLabel value={reminderDaysInput} onChange={(e) => setReminderDaysInput(e.target.value)} placeholder="e.g. 3, 2, 1" sx={{ width: 260 }} />
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {parseReminderDays(reminderDaysInput).length === 0
                    ? <span className="text-xs text-slate-400">No reminders configured.</span>
                    : parseReminderDays(reminderDaysInput).map((d) => (
                      <span key={d} className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">{d} day{d === 1 ? '' : 's'} before</span>
                    ))}
                </div>
              </div>
            </Paper>

            {/* Free tier limits */}
            <Paper elevation={0} className="p-6 rounded-2xl border border-slate-200/70">
              {sectionHeader(<ShieldCheck className="w-5 h-5" />, 'Free Tier Limits', 'Capacity for societies without a paid plan (use -1 for unlimited)', 'bg-emerald-50 text-emerald-600')}
              <Grid container spacing={2}>
                {CAPABILITY_FIELDS.map((c) => (
                  <Grid size={{ xs: 6, sm: 4 }} key={c.key}>
                    <div className="rounded-xl border border-slate-200/70 p-3 hover:border-blue-200 transition-colors">
                      <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">{c.label}</span>
                      <TextField hiddenLabel fullWidth type="number" size="small" value={caps[c.key] ?? 0}
                        onChange={(e) => setCaps((p) => ({ ...p, [c.key]: Number(e.target.value) }))} sx={{ mt: 0.5 }} />
                    </div>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </div>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper elevation={0} className="p-6 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-white sticky top-4 space-y-3">
            <div className="flex items-center gap-2 text-blue-700"><Info className="w-4 h-4" /><span className="font-black text-sm">How the free tier works</span></div>
            <ul className="text-xs text-slate-600 space-y-2.5 leading-relaxed">
              {[
                'Any society without a valid paid plan automatically sits on the Free tier — there is no fixed trial length.',
                'When a paid plan ends, the society gets the grace period of full access; if still unpaid it drops to these limits.',
                'Exceeding a limit returns an “upgrade required” response — extra capacity stays locked until they upgrade.',
                'Use -1 for unlimited on any capability.',
                'Reminders run daily at 9:00 AM, emailing societies before their plan ends.',
              ].map((t, i) => (
                <li key={i} className="flex gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />{t}</li>
              ))}
            </ul>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}
