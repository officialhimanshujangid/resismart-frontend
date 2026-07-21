'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Button, TextField, CircularProgress, Paper, Grid, LinearProgress } from '@mui/material';
import {
  Save, SlidersHorizontal, Info, ShieldCheck, BellRing, Package, TriangleAlert, CheckCircle2, XCircle,
  KeyRound, RefreshCw,
} from 'lucide-react';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { useAuth } from '@/context/AuthContext';
import ModuleScope from '@/components/common/ModuleScope';
import PageHeader from '@/components/common/PageHeader';
import PageSkeleton from '@/components/common/PageSkeleton';
import ErrorState from '@/components/common/ErrorState';
import SectionHeading from '@/components/common/SectionHeading';
import {
  CapabilityRow, SOCIETY_CAPABILITY_GROUPS, capabilitiesFor, capabilityLabel, stateFromValue,
} from '@/app/(dashboard)/owner/plans/capability-catalog';

/**
 * One route, two readers.
 *
 * `/dashboard/settings` is ResiSmart's own system settings — free-tier limits,
 * grace period, reminder emails — and `GET /settings` is `SYSTEM_OWNER` only.
 * Anybody from a society who landed here got a "Failed to load settings" toast
 * and an empty form: a screen that looks broken instead of a screen that is
 * not theirs.
 *
 * So the same route answers the question each reader actually has. ResiSmart
 * sees the knobs. A society sees what its own plan covers and how much of it
 * is used — the panel that stops "your plan covers 50, you have 63" being
 * discovered as a 402 halfway through adding a flat.
 */
export default function SettingsPage() {
  const { activeProfile } = useAuth();

  // Branch on the tenant, not the role name: every society role — admin,
  // committee, staff, resident — belongs on the plan panel, and only the
  // people inside ResiSmart belong on the other one.
  if (activeProfile?.tenantType === 'SYSTEM') return <SystemSettings />;
  return <MyPlanPanel />;
}

// ===========================================================================
// ResiSmart's own settings
// ===========================================================================

function SystemSettings() {
  const { showToast } = useToastConfirm();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gracePeriodDays, setGracePeriodDays] = useState<number>(7);
  const [caps, setCaps] = useState<Record<string, number>>({});
  const [reminderDaysInput, setReminderDaysInput] = useState('3,1');

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    api.get('/settings')
      .then((res) => {
        const s = res.data.settings;
        setGracePeriodDays(s.gracePeriodDays ?? 7);
        setCaps(s.defaultTrialCapabilities || {});
        if (Array.isArray(s.expiryReminderDays)) setReminderDaysInput(s.expiryReminderDays.join(', '));
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

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
        // Sent exactly as loaded, plus whatever was edited.
        //
        // It used to be rebuilt from a hardcoded list of six keys with `?? 0`
        // for anything missing — so every save silently wrote `0` over any
        // capability that list had not heard of, and `0` does not mean "no
        // limit configured", it means "this module does not exist". One save
        // of an unrelated field removed Housing listings from every society on
        // the free tier.
        defaultTrialCapabilities: Object.fromEntries(
          Object.entries(caps).map(([k, v]) => [k, Math.trunc(Number(v))])
        ),
        expiryReminderDays: parseReminderDays(reminderDaysInput),
      });
      showToast('Settings saved successfully', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton label="Loading settings" />;
  if (failed) {
    return (
      <ErrorState
        title="Settings could not load"
        message="These are ResiSmart's own settings."
        hint="If you are signed in for a society, this screen is not yours — nothing is wrong with your account."
        onRetry={load}
      />
    );
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

            {/* Free tier limits — the same switch-and-limit control as the plan editor */}
            <Paper elevation={0} className="p-6 rounded-2xl border border-slate-200/70 space-y-4">
              {sectionHeader(<ShieldCheck className="w-5 h-5" />, 'Free Tier', 'What a society gets with no paid plan', 'bg-emerald-50 text-emerald-600')}
              {SOCIETY_CAPABILITY_GROUPS.map((group) => (
                <div key={group.title} className="space-y-2">
                  <SectionHeading hint={group.hint}>{group.title}</SectionHeading>
                  <div className="space-y-2">
                    {group.items.map((cap) => (
                      <CapabilityRow
                        key={cap.key}
                        cap={cap}
                        value={caps[cap.key]}
                        onChange={(next) => setCaps((p) => ({ ...p, [cap.key]: next }))}
                        disabled={saving}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-200/70 rounded-xl p-3">
                A row showing <strong>Unlimited</strong> that you have never set is genuinely unlimited today —
                nothing has ever been stored for it, and the software reads &ldquo;not set&rdquo; as
                &ldquo;no ceiling&rdquo;. Set a number to change that.
              </p>
            </Paper>

            <PassSigningKeyPanel sectionHeader={sectionHeader} />
          </div>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper elevation={0} className="p-6 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 to-white sticky top-4 space-y-3">
            <div className="flex items-center gap-2 text-blue-700"><Info className="w-4 h-4" /><span className="font-black text-sm">How the free tier works</span></div>
            <ul className="text-xs text-slate-600 space-y-2.5 leading-relaxed">
              {[
                'Any society without a valid paid plan automatically sits on the Free tier — there is no fixed trial length.',
                'When a paid plan ends, the society gets the grace period of full access; if still unpaid it drops to these limits.',
                'Reaching a limit refuses only NEW entries. Nothing already recorded is removed or locked.',
                'Switching a module off here removes it from every free-tier society: no menu, no page, and the data waits untouched until it is switched back on.',
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

// ===========================================================================
// The gate-pass signing key
// ===========================================================================

interface KeyStatus {
  source: 'ENV' | 'STORED' | 'GENERATED';
  keyCount: number;
  envPinned: boolean;
  rotatedAt?: string;
  retiredKeyExpiresAt?: string;
  graceHours: number;
  maxOfflineHours: number;
}

const SOURCE_WORDS: Record<KeyStatus['source'], string> = {
  ENV: 'Set in this server’s environment',
  STORED: 'Stored in the database',
  GENERATED: 'Generated automatically on first use',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

type SectionHeader = (icon: React.ReactNode, title: string, desc: string, tone: string) => React.ReactNode;

/**
 * One key, every gate, every society — which is why it lives on ResiSmart's own
 * settings and not a society's.
 *
 * The screen's job is to make the consequences legible BEFORE the click, not
 * after. Rotating is not an isolated act: passes already in guests' hands keep
 * working for the grace window, and until every guard device fetches the new
 * key list, a device that is offline is running on a cache that knows nothing
 * about this. Both of those are said here, in those words.
 *
 * The two refusals are deliberately NOT predicted client-side. The server owns
 * the rule and its messages carry the exact remedy — which environment
 * variables to move, or how long to wait — so they are shown verbatim rather
 * than re-worded into something that can drift out of step with the service.
 */
function PassSigningKeyPanel({ sectionHeader }: { sectionHeader: SectionHeader }) {
  const { showToast, confirm } = useToastConfirm();
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [refusal, setRefusal] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/settings/pass-signing-key')
      .then((res) => setStatus(res.data.data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const grace = status?.graceHours ?? 24;

  const handleRotate = async () => {
    const agreed = await confirm({
      title: 'Rotate the gate pass signing key?',
      message:
        `Every society on this installation shares this key. Passes already issued keep working for `
        + `${grace} hours, so nobody holding an invitation is turned away — but every guard device must `
        + `re-fetch its scanner configuration before it will accept passes issued from now on. Open the `
        + `scanner on each device while it has a network.`,
      confirmText: 'Rotate the key',
      cancelText: 'Leave it alone',
      severity: 'warning',
    });
    if (!agreed) return;

    setRotating(true);
    setRefusal('');
    try {
      const res = await api.post('/settings/pass-signing-key/rotate');
      setStatus(res.data.data);
      showToast(res.data.message || 'Signing key rotated', 'success');
    } catch (err: any) {
      // Kept on the screen rather than only in a toast: these messages are two
      // sentences of instruction, and a toast that clears in four seconds is
      // not where an operator reads which variables to move.
      const msg = err.response?.data?.message || 'Could not rotate the signing key.';
      setRefusal(msg);
      showToast(msg, 'error');
    } finally {
      setRotating(false);
    }
  };

  return (
    <Paper elevation={0} className="p-6 rounded-2xl border border-slate-200/70">
      {sectionHeader(
        <KeyRound className="w-5 h-5" />,
        'Gate Pass Signing Key',
        'The one key every guard device uses to check visitor passes offline',
        'bg-rose-50 text-rose-600',
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500"><CircularProgress size={16} /> Reading key status…</div>
      ) : !status ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-slate-500">The key status could not be read just now.</p>
          <Button size="small" onClick={load}>Try again</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Where the key comes from</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">{SOURCE_WORDS[status.source]}</p>
            </div>
            <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-3">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Keys guards accept today</p>
              <p className="text-sm font-bold text-slate-800 mt-0.5">
                {status.keyCount === 1 ? '1 key' : `${status.keyCount} keys`}
                {status.keyCount > 1 && <span className="font-medium text-slate-500"> — a rotation is settling</span>}
              </p>
            </div>
          </div>

          {status.source !== 'ENV' && (
            <p className="text-[11px] text-amber-800 leading-relaxed bg-amber-50 border border-amber-200 rounded-xl p-3">
              The private key is sitting in the database in plain text. Anyone who can read that one row can
              mint a valid pass for any flat in any society here. Set <code>PASS_SIGNING_PRIVATE_KEY</code> and{' '}
              <code>PASS_SIGNING_PUBLIC_KEY</code> in this server&rsquo;s environment for a real installation.
            </p>
          )}

          {status.rotatedAt && status.retiredKeyExpiresAt && (
            <p className="text-[11px] text-blue-800 leading-relaxed bg-blue-50 border border-blue-200 rounded-xl p-3">
              Rotated on <strong>{when(status.rotatedAt)}</strong>. The previous key keeps verifying until{' '}
              <strong>{when(status.retiredKeyExpiresAt)}</strong>, so passes issued before the rotation still work.
              Nothing may rotate again until then — doing so would cancel every one of them.
            </p>
          )}

          {refusal && (
            <p className="text-[12px] text-rose-800 leading-relaxed bg-rose-50 border border-rose-200 rounded-xl p-3 whitespace-pre-line">
              {refusal}
            </p>
          )}

          <div className="rounded-xl border border-slate-200/70 p-4 space-y-3">
            <p className="text-xs text-slate-600 leading-relaxed">
              Rotating replaces the key new passes are signed with. It applies to{' '}
              <strong>every society on this installation</strong>, because they all share it.
            </p>
            <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
              {[
                <>Passes already issued <strong>stay valid for {grace} hours</strong> — nobody holding an invitation is turned away.</>,
                <>Every guard device must re-fetch its scanner configuration before it will accept newly issued passes. Opening the scanner while the device has a network does this.</>,
                <>A device that is offline is running on its cached key list and will not know about this until it reconnects, which is why the old key is kept alive for {grace} hours.</>,
              ].map((t, i) => (
                <li key={i} className="flex gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />{t}</li>
              ))}
            </ul>
            <Button
              onClick={handleRotate}
              disabled={rotating}
              variant="outlined"
              color="error"
              startIcon={rotating ? <CircularProgress size={16} color="inherit" /> : <RefreshCw className="w-4 h-4" />}
            >
              Rotate signing key
            </Button>
          </div>
        </div>
      )}
    </Paper>
  );
}

// ===========================================================================
// What YOUR plan includes — society side, read-only
// ===========================================================================

interface UsageRow { key: string; noun: string; limit: number | null; included: boolean; used: number }

interface Entitlements {
  plan: { name: string; isFreeTier: boolean; status: string; limits: Record<string, number> };
  opsModules: string[];
  financeModules: string[];
  hasFinance: boolean;
  isAdmin: boolean;
  usage?: UsageRow[];
}

/** Ops module keys are internal. Nobody outside the code calls it `GATE`. */
const OPS_MODULE_LABELS: Record<string, string> = {
  GATE: 'Visitor Management',
  COMPLAINTS: 'Complaints',
  STAFF: 'Staff',
  ASSETS: 'Assets',
  PARKING: 'Parking',
};

const PLAN_STATUS_WORDS: Record<string, string> = {
  active: 'Running normally',
  past_due: 'Payment overdue — you still have full access for now',
  cancelled: 'Cancelled',
  expired: 'Ended',
  unknown: 'We could not check this just now',
};

function MyPlanPanel() {
  const [data, setData] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    api.get('/me/entitlements')
      .then((res) => setData(res.data.data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PageSkeleton label="Checking your plan" />;
  // `status: 'unknown'` is the resolver's fail-closed answer: it could not work
  // out what this society bought, so it returned everything switched off and no
  // limits at all. Rendering that literally would tell an admin their plan
  // includes everything, unlimited — the single most misleading thing this
  // screen could say. A 200 that means "we could not tell" is still an error.
  if (failed || !data || data.plan.status === 'unknown') {
    return (
      <ErrorState
        title="We could not check your plan"
        message="Nothing has changed with your society — this screen simply could not reach us."
        hint="Try again in a moment. If it keeps happening, tell your ResiSmart contact."
        onRetry={load}
      />
    );
  }

  const usageByKey = new Map((data.usage || []).map((u) => [u.key, u]));
  const catalog = capabilitiesFor('society');

  // A row can come from two places: the server counts what it knows how to
  // count (and only for admins), and the plan itself says what is included.
  // Where there is no count, the row still has to say whether it is included —
  // that is the half of the answer everybody needs.
  const rows = catalog.map((cap) => {
    const u = usageByKey.get(cap.key);
    const s = stateFromValue(data.plan.limits?.[cap.key], cap.suggested);
    return {
      cap,
      included: u ? u.included : s.included,
      limit: u ? u.limit : (s.included && !s.unlimited ? s.limit : null),
      used: u?.used,
      counted: !!u,
    };
  });

  const over = rows.filter((r) => r.included && r.limit !== null && r.used !== undefined && r.used > r.limit);
  const excluded = rows.filter((r) => !r.included);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl pb-4">
      <PageHeader
        title="What your plan includes"
        breadcrumb="Society"
        icon={<Package className="w-5 h-5" />}
        subtitle="The parts of ResiSmart your society has, and how much of each you are using. Only ResiSmart can change this — ask your contact if you need more."
      />

      <Paper elevation={0} className="rounded-2xl border border-slate-200/70 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Your plan</p>
            <p className="text-xl font-black text-slate-800">
              {data.plan.isFreeTier ? 'Free' : data.plan.name}
            </p>
          </div>
          <p className="text-sm text-slate-600">
            {PLAN_STATUS_WORDS[data.plan.status] || PLAN_STATUS_WORDS.unknown}
          </p>
        </div>
      </Paper>

      {over.length > 0 && (
        <Paper elevation={0} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <div className="flex items-start gap-3">
            <TriangleAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-bold text-slate-800 text-sm">You are past what your plan covers</p>
              <ul className="text-sm text-slate-700 space-y-1">
                {over.map((r) => (
                  <li key={r.cap.key}>
                    <strong>{r.cap.label}</strong> — your plan covers {r.limit!.toLocaleString('en-IN')};
                    you have {r.used!.toLocaleString('en-IN')}.
                  </li>
                ))}
              </ul>
              {/* Grandfathering, said before anybody meets a 402. */}
              <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                <strong>Nothing has been removed and nothing is locked.</strong> Everything already
                recorded stays exactly as it is, and you can still open and change it. Only
                <strong> new</strong> ones are refused until you either remove some or ask your
                ResiSmart contact to increase your plan.
              </p>
            </div>
          </div>
        </Paper>
      )}

      <div className="space-y-3">
        <SectionHeading hint={data.isAdmin
          ? 'The number on the right is what you are using right now.'
          : 'Ask your society office if you need something that is not in your plan.'}>
          Included in your plan
        </SectionHeading>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rows.filter((r) => r.included).map((r) => {
            const pct = r.limit && r.used !== undefined ? Math.min(100, Math.round((r.used / r.limit) * 100)) : null;
            const isOver = r.limit !== null && r.used !== undefined && r.used > r.limit;
            return (
              <Paper key={r.cap.key} elevation={0} className="rounded-2xl border border-slate-200/70 p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      {r.cap.label}
                    </p>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{r.cap.description}</p>
                  </div>
                  <p className="text-xs font-bold text-slate-600 shrink-0 text-right">
                    {r.limit === null
                      ? 'No limit'
                      : `${r.limit.toLocaleString('en-IN')} ${r.cap.unit}`}
                  </p>
                </div>

                {r.counted && r.used !== undefined && (
                  <div className="space-y-1">
                    {pct !== null && (
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, pct)}
                        color={isOver ? 'warning' : 'primary'}
                        sx={{ height: 6, borderRadius: 3 }}
                      />
                    )}
                    <p className={`text-[11px] font-semibold ${isOver ? 'text-amber-700' : 'text-slate-500'}`}>
                      {r.limit === null
                        ? `You have ${r.used.toLocaleString('en-IN')} ${r.cap.unit}.`
                        : `Your plan covers ${r.limit.toLocaleString('en-IN')}; you have ${r.used.toLocaleString('en-IN')}.`}
                    </p>
                  </div>
                )}
              </Paper>
            );
          })}
        </div>
      </div>

      {excluded.length > 0 && (
        <div className="space-y-3">
          <SectionHeading hint="These are not part of your plan, so they do not appear anywhere in the app. Ask your ResiSmart contact if you would like them.">
            Not in your plan
          </SectionHeading>
          <div className="flex flex-wrap gap-2">
            {excluded.map((r) => (
              <span key={r.cap.key}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5">
                <XCircle className="w-3.5 h-3.5" />
                {r.cap.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <SectionHeading hint="Your plan allows these, and your society has switched them on. Your society admin can switch them on and off in Operations settings.">
          Switched on for your society
        </SectionHeading>
        <div className="flex flex-wrap gap-2">
          {data.opsModules.length === 0 && !data.hasFinance && (
            <span className="text-sm text-slate-500">Nothing is switched on yet.</span>
          )}
          {data.opsModules.map((m) => (
            <span key={m} className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5">
              {OPS_MODULE_LABELS[m] || capabilityLabel(m)}
            </span>
          ))}
          {data.hasFinance && (
            <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5">
              Finance &amp; Accounting — {data.financeModules.length} of 11 parts on
            </span>
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-200/70 rounded-xl p-4">
        If your plan changes, nothing you have already entered is ever deleted. A module that is
        switched off is hidden and stops taking new entries; everything in it is waiting, unchanged,
        if it is switched back on.
      </p>
    </div>
  );
}
