'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Chip, Switch } from '@mui/material';
import { ArrowRight, LayoutGrid, Lock } from 'lucide-react';
import api from '@/lib/api';
import PageHeader from '@/components/common/PageHeader';
import PageSkeleton from '@/components/common/PageSkeleton';
import ErrorState from '@/components/common/ErrorState';
import { SettingsCard, SettingRow } from '@/components/common/SettingsCard';
import { useToastConfirm } from '@/context/ToastConfirmContext';

/**
 * Which operations modules this society uses.
 *
 * This screen exists because the gate that hides a module had no switch. The
 * server has filtered the menu by `SocietyOpsPolicy.modules` since Phase 4, and
 * the only way to change that list was an API call — so a society that wanted
 * Parking could not have it, and a society that did not want Complaints could
 * not be rid of them. The module gate was built without its handle.
 *
 * Three rules the screen has to keep:
 *
 * 1. **The plan comes first.** A module the society did not buy is not offered
 *    as a switch it can flip and then find broken. It is shown, greyed, saying
 *    so — hiding it entirely means an admin who was sold Parking and cannot see
 *    it has nowhere to look.
 * 2. **Switching off never deletes.** The confirm says that in those words,
 *    because "switch off" reads as "delete" to most people, and the one thing a
 *    committee will not risk is losing two years of complaints.
 * 3. **Parking is not a plain switch.** Turning it on also has to answer "do you
 *    charge for it?", and turning it off has to stop that charge — both of which
 *    live in the parking setup. A bare switch here would leave a charge head
 *    active on every flat's bill for a module nobody can see. So parking sends
 *    you to its own short setup, which stays reachable whether parking is on or
 *    off: the switch cannot be locked inside the room it opens.
 */

interface ModuleInfo { key: string; label: string; blurb: string; pages: string[] }
interface UsageRow { key: string; noun: string; limit: number | null; included: boolean; used: number }

/**
 * Which plan capability sells each module.
 *
 * A copy of the `opsModule` column of `CAPABILITIES` in
 * `backend/src/services/entitlement.service.ts`, and the only honest way to tell
 * "the society switched this off" from "the plan never included it": the
 * `opsModules` array is already the intersection of the two, so a module missing
 * from it could be either. ASSETS is deliberately absent — no plan capability
 * governs it, so every plan includes it.
 */
const PLAN_KEY: Record<string, string | undefined> = {
  GATE: 'max_visitor_count',
  COMPLAINTS: 'max_tickets_count',
  STAFF: 'max_staff_count',
  ASSETS: undefined,
  PARKING: 'max_parking_slots',
};

/**
 * Parking's own catalogue row.
 *
 * `OPS_MODULE_CATALOG` in `ops-policy.service.ts` still lists only the original
 * four, so parking would otherwise be the one module with no row on the screen
 * that switches modules on — which is exactly the reported bug. This belongs in
 * that catalogue and should move there; it is here so the screen is correct now
 * rather than correct later. It is only used when the server does not send one.
 */
const PARKING_FALLBACK: ModuleInfo = {
  key: 'PARKING',
  label: 'Parking',
  blurb: 'Slots, who holds each one, the waiting list — and the parking charge on the bill, if you make one.',
  pages: ['Parking Map', 'Who Parks Where', 'Requests'],
};

/** `0` means the plan does not include it. Absent means no ceiling was set. */
const planAllows = (limits: Record<string, any> | undefined, key?: string) => {
  if (!key) return true;
  const raw = limits?.[key];
  if (raw === undefined || raw === null) return true;
  return Number(raw) !== 0;
};

export default function OperationsModulesPage() {
  const router = useRouter();
  const { showToast, confirm } = useToastConfirm();

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [catalog, setCatalog] = useState<ModuleInfo[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [limits, setLimits] = useState<Record<string, any>>({});
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [parkingChargeable, setParkingChargeable] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(null);
    try {
      // The policy call is the one that must succeed — it carries both the
      // catalogue and the society's current answer. The other two only sharpen
      // the screen, so a failure there costs a chip, not the page.
      const [policyRes, entRes, parkRes] = await Promise.all([
        api.get('/visitors/policy'),
        api.get('/me/entitlements').catch(() => null),
        api.get('/parking/settings').catch(() => null),
      ]);

      const server: ModuleInfo[] = policyRes.data?.data?.catalog || [];
      setCatalog(
        server.some(m => m.key === 'PARKING') ? server : [...server, PARKING_FALLBACK],
      );
      setModules(policyRes.data?.data?.modules || []);

      const ent = entRes?.data?.data;
      setLimits(ent?.plan?.limits || {});
      setUsage(Array.isArray(ent?.usage) ? ent.usage : []);
      // Fails closed, like everything else that reads entitlements: if we could
      // not tell whether this person may change settings, the switches are
      // read-only rather than live.
      setCanEdit(!!ent && (ent.isAdmin === true || ent.permissions?.OPS_SETTINGS === 'FULL'));

      const park = parkRes?.data?.data;
      setParkingChargeable(park ? !!park.chargeable : null);
    } catch (e: any) {
      // A refusal and a breakage need different sentences. "It did not load,
      // try again" sends somebody who was never allowed in round the retry loop
      // for as long as their patience lasts.
      setFailed(
        e.response?.status === 403
          ? 'Only the society admin and the committee can see which operations modules this society uses. Ask them if something you need is switched off.'
          : 'We could not read which operations modules this society uses, so nothing here can be changed yet.',
      );
      showToast(e.response?.data?.message || 'Could not load what this society uses', 'error');
    } finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  /**
   * Switch one module on or off.
   *
   * Applied locally first so the switch moves under the finger, and snapped back
   * if the server says no — a switch that sits in its new position while the
   * server holds the old value is a screen telling a lie.
   */
  const setModule = async (info: ModuleInfo, on: boolean) => {
    if (!on) {
      const agreed = await confirm({
        title: `Switch off ${info.label}?`,
        message:
          `${info.label} disappears from the menu for everybody, and no new entries can be added to it. `
          + 'Nothing is deleted — every record you already have stays exactly where it is, and switching '
          + 'this back on brings all of it straight back.'
          + (info.pages?.length ? `\n\nScreens that will be hidden: ${info.pages.join(', ')}.` : ''),
        confirmText: `Switch off ${info.label}`,
        cancelText: 'Leave it on',
        severity: 'warning',
      });
      if (!agreed) return;
    }

    const previous = modules;
    const next = on ? [...modules, info.key] : modules.filter(k => k !== info.key);
    setModules(next);
    setSaving(true);
    try {
      const res = await api.put('/visitors/policy', { modules: next });
      if (Array.isArray(res.data?.data?.modules)) setModules(res.data.data.modules);
      // The menu has to change now, not on the next hard reload — `Sidebar.tsx`
      // listens for this and refetches entitlements. A toggle that appears to do
      // nothing reads as broken.
      window.dispatchEvent(new Event('ops-modules-changed'));
      showToast(on ? `${info.label} switched on` : `${info.label} hidden — nothing was deleted`, 'success');
    } catch (e: any) {
      setModules(previous);
      showToast(
        e.response?.data?.message || 'That did not save, so nothing has changed. Try again.',
        'error',
      );
    } finally { setSaving(false); }
  };

  if (loading) return <PageSkeleton label="Loading what this society uses" />;
  if (failed) return <ErrorState message={failed} onRetry={load} />;

  const capFor = (key?: string) => usage.find(u => u.key === key);

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-24">
      <PageHeader
        breadcrumb="Operations"
        title="What this society uses"
        icon={<LayoutGrid className="w-4.5 h-4.5" />}
        subtitle="Every part of operations can be switched on or off here. Switching one off only hides its screens — nothing is ever deleted, and turning it back on brings everything straight back."
      />

      {!canEdit && (
        <Alert severity="info" icon={<Lock className="w-5 h-5" />} className="rounded-2xl">
          You can see what this society uses, but only the society admin and the committee can
          change it. Ask them if something you need is switched off.
        </Alert>
      )}

      <SettingsCard
        icon={<LayoutGrid className="w-4 h-4 text-slate-600" />}
        title="Operations modules"
        description="Each one is a group of screens. What a module covers is written under its name, along with the screens it shows or hides."
        footer={
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-slate-500 leading-relaxed max-w-md">
              Parking is switched on by answering five short questions — whether you manage it at
              all, and whether you charge for it. That page stays open whether parking is on or off,
              so you can always switch it back.
            </p>
            <Button
              size="small"
              variant="outlined"
              endIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => router.push('/dashboard/parking/settings')}
            >
              {modules.includes('PARKING') ? 'Change parking settings' : 'Set up parking'}
            </Button>
          </div>
        }
      >
        {catalog.map(m => {
          const on = modules.includes(m.key);
          const sold = planAllows(limits, PLAN_KEY[m.key]);
          const cap = capFor(PLAN_KEY[m.key]);

          return (
            <SettingRow
              key={m.key}
              disabled={!sold}
              title={m.label}
              hint={
                <>
                  <span>{m.blurb}</span>
                  {m.pages?.length > 0 && (
                    <span className="block mt-0.5">
                      {on ? 'Shows: ' : 'Would show: '}{m.pages.join(' · ')}
                    </span>
                  )}
                  {!sold && (
                    <span className="block mt-0.5 font-bold">
                      Not part of your plan, so it cannot be switched on here.
                    </span>
                  )}
                  {sold && cap && cap.limit !== null && (
                    <span className="block mt-0.5">
                      Your plan covers {cap.limit.toLocaleString('en-IN')} {cap.noun}
                      {cap.used > 0 ? ` — you are using ${cap.used.toLocaleString('en-IN')}.` : '.'}
                    </span>
                  )}
                </>
              }
            >
              {m.key === 'PARKING' ? (
                /**
                 * Parking answers two questions at once, so it gets a button
                 * rather than a switch. Switching it off has to stop the parking
                 * charge on next month's bill as well as hide the screens, and
                 * only the parking setup does both.
                 */
                <div className="flex items-center gap-2">
                  <Chip
                    size="small"
                    color={on ? 'primary' : 'default'}
                    variant={on ? 'filled' : 'outlined'}
                    label={
                      !on ? 'Off'
                        : parkingChargeable === null ? 'On'
                        : parkingChargeable ? 'On, chargeable' : 'On, free'
                    }
                  />
                  <Button
                    size="small"
                    variant={on ? 'outlined' : 'contained'}
                    endIcon={<ArrowRight className="w-4 h-4" />}
                    disabled={!sold}
                    onClick={() => router.push('/dashboard/parking/settings')}
                  >
                    {on ? 'Change' : 'Set up'}
                  </Button>
                </div>
              ) : (
                <Switch
                  checked={on}
                  disabled={saving || !sold || !canEdit}
                  onChange={e => setModule(m, e.target.checked)}
                />
              )}
            </SettingRow>
          );
        })}
      </SettingsCard>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="text" onClick={() => router.push('/dashboard/operations/setup')}>
          Setting up operations
        </Button>
        <Button variant="outlined" onClick={() => router.push('/dashboard/visitors/settings')}>
          Operations settings
        </Button>
      </div>
    </div>
  );
}
