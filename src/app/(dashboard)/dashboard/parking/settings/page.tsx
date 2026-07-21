'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, Button, ButtonBase, Chip, FormControl, MenuItem, Select, Switch, TextField,
} from '@mui/material';
import { ArrowRight, IndianRupee, SquareParking } from 'lucide-react';
import api from '@/lib/api';
import PageHeader from '@/components/common/PageHeader';
import PageSkeleton from '@/components/common/PageSkeleton';
import ErrorState from '@/components/common/ErrorState';
import { SettingsCard, SettingRow } from '@/components/common/SettingsCard';
import { useToastConfirm } from '@/context/ToastConfirmContext';

/**
 * Parking setup — five plain questions.
 *
 * This is the one screen that switches the parking module on, and it is
 * deliberately reachable while parking is OFF: the server exempts
 * `/parking/settings` from the module gate for exactly this reason. A settings
 * page that 404s is a society that can never switch the feature on — the switch
 * cannot be locked inside the room it opens.
 *
 * Nothing here is worded the way the database stores it. There is no "billing
 * frequency", no "charge head", no "pricing mode" — a committee member is asked
 * whether they charge for parking and when they collect it, and the server turns
 * that into an ordinary charge head so the invoice PDF, the GST handling, the
 * 4120 ledger account and the resident's My Bills screen all keep working with
 * no changes at all.
 *
 * The form is submitted whole each time rather than patched, because that is
 * what the API expects: a blank two-wheeler amount means "the same as cars", not
 * "leave last year's separate bike rate alone".
 */

interface Settings {
  managed: boolean;
  chargeable: boolean;
  billingFrequency: 'MONTHLY' | 'YEARLY';
  annualBillingMonth: number;
  perSlotPaise: number;
  twoWheelerPaise?: number | null;
  carHead?: { code: string; name: string; ratePaise: number; isActive: boolean } | null;
  bikeHead?: { code: string; name: string; ratePaise: number; isActive: boolean } | null;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Paise in, a plain rupee figure out — for a text box, so no grouping commas. */
const toRupees = (paise?: number | null) =>
  paise === undefined || paise === null || paise === 0 ? '' : String(paise / 100);

/** Rupees typed by a person, out as integer paise. Blank reads as nothing. */
const toPaise = (rupees: string): number | null => {
  const trimmed = rupees.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
};

/**
 * One of a small set of choices, as a card rather than a radio — each one needs
 * a sentence explaining what it costs. Colour comes from the theme's primary.
 */
function ChoiceCard({
  selected, disabled, title, blurb, onClick,
}: {
  selected: boolean; disabled?: boolean; title: string; blurb: string; onClick: () => void;
}) {
  return (
    <ButtonBase
      disabled={disabled}
      onClick={onClick}
      sx={{
        display: 'block', width: '100%', textAlign: 'left', p: 1.5, borderRadius: 3,
        border: '1px solid',
        borderColor: selected ? 'primary.main' : '#e2e8f0',
        bgcolor: selected ? 'rgba(10, 91, 215, 0.06)' : 'transparent',
        '&:hover': { borderColor: selected ? 'primary.main' : '#cbd5e1' },
      }}
    >
      <div className="flex items-center gap-2">
        <span className="font-bold text-slate-800 text-sm">{title}</span>
        {selected && <Chip size="small" color="primary" label="Chosen" />}
      </div>
      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{blurb}</p>
    </ButtonBase>
  );
}

export default function ParkingSettingsPage() {
  const router = useRouter();
  const { showToast, confirm } = useToastConfirm();

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** What the society last saved — the thing the confirm dialogs compare against. */
  const [saved, setSaved] = useState<Settings | null>(null);
  const [inPlan, setInPlan] = useState(true);
  const [canEdit, setCanEdit] = useState(false);

  // The five answers, held as the form rather than as the stored shape: the
  // rates are strings because they are being typed.
  const [manage, setManage] = useState(false);
  const [chargeable, setChargeable] = useState(false);
  const [frequency, setFrequency] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [month, setMonth] = useState(4);
  const [perSlot, setPerSlot] = useState('');
  const [separateBikeRate, setSeparateBikeRate] = useState(false);
  const [bikeRate, setBikeRate] = useState('');

  const fill = useCallback((s: Settings) => {
    setSaved(s);
    setManage(!!s.managed);
    setChargeable(!!s.chargeable);
    setFrequency(s.billingFrequency === 'YEARLY' ? 'YEARLY' : 'MONTHLY');
    // April unless the society has said otherwise — the start of the Indian
    // financial year, which is when most societies raise their annual levies.
    setMonth(s.annualBillingMonth || 4);
    setPerSlot(toRupees(s.perSlotPaise));
    setSeparateBikeRate(s.twoWheelerPaise !== undefined && s.twoWheelerPaise !== null);
    setBikeRate(toRupees(s.twoWheelerPaise));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(null);
    try {
      const [settingsRes, entRes] = await Promise.all([
        api.get('/parking/settings'),
        api.get('/me/entitlements').catch(() => null),
      ]);
      fill(settingsRes.data?.data || {
        managed: false, chargeable: false, billingFrequency: 'MONTHLY',
        annualBillingMonth: 4, perSlotPaise: 0,
      });

      const ent = entRes?.data?.data;
      // `0` on this capability means parking was never sold to this society.
      // Saying "yes" would write the switch and change nothing anybody can see,
      // because every other parking route still answers 404.
      const limit = ent?.plan?.limits?.max_parking_slots;
      setInPlan(!(limit !== undefined && limit !== null && Number(limit) === 0));
      setCanEdit(!!ent && (ent.isAdmin === true || ent.permissions?.OPS_SETTINGS === 'FULL'));
    } catch (e: any) {
      setFailed(
        e.response?.status === 403
          ? 'Only the society admin, the committee and the society manager can set up parking. Ask them to switch it on.'
          : 'Your parking settings did not load, so nothing here can be changed yet.',
      );
      showToast(e.response?.data?.message || 'Could not load your parking settings', 'error');
    } finally { setLoading(false); }
  }, [fill, showToast]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    // ------------------------------------------------ switching parking off
    if (!manage && saved?.managed) {
      const agreed = await confirm({
        title: 'Switch parking off?',
        message:
          'Parking disappears from the menu for everybody. Your slots, your areas and every '
          + 'allocation are kept safely and come back exactly as they are if you switch this on '
          + 'again — nothing is deleted.\n\n'
          + 'If you are charging for parking, that charge stops from next month\'s bill onwards. '
          + 'Bills already raised are not touched.',
        confirmText: 'Switch parking off',
        cancelText: 'Keep parking on',
        severity: 'warning',
      });
      if (!agreed) return;
    }

    // -------------------------------------------------- stopping the charge
    if (manage && saved?.managed && saved.chargeable && !chargeable) {
      const agreed = await confirm({
        title: 'Stop charging for parking?',
        message:
          'Parking stays exactly as it is — the map, the slots and who holds them. The parking '
          + 'line simply stops appearing on the maintenance bill from next month onwards. '
          + 'Bills already raised are not touched, and the old charge is kept so last year\'s '
          + 'invoices still explain themselves.',
        confirmText: 'Make parking free',
        cancelText: 'Keep charging',
        severity: 'warning',
      });
      if (!agreed) return;
    }

    const perSlotPaise = toPaise(perSlot);
    if (manage && chargeable && !(perSlotPaise && perSlotPaise > 0)) {
      showToast('How much is one slot? Enter an amount, or say parking is free.', 'error');
      return;
    }

    const body: Record<string, unknown> = { manage };
    if (manage) {
      body.chargeable = chargeable;
      if (chargeable) {
        body.billingFrequency = frequency;
        body.perSlotPaise = perSlotPaise;
        if (frequency === 'YEARLY') body.annualBillingMonth = month;
        // `null` is an answer, not an omission: it means two-wheelers are billed
        // at the car rate. Leaving the key out would mean the same, but sending
        // it makes the intent readable in the request.
        body.twoWheelerPaise = separateBikeRate ? toPaise(bikeRate) : null;
      }
    }

    setSaving(true);
    try {
      const res = await api.put('/parking/settings', body);
      const next: Settings = res.data?.data;
      if (next) fill(next);
      // Parking's answer to question one IS the module switch, so the menu has
      // to change now rather than on the next hard reload. `Sidebar.tsx` listens
      // for this and refetches entitlements.
      if ((next?.managed ?? manage) !== saved?.managed) {
        window.dispatchEvent(new Event('ops-modules-changed'));
      }
      showToast(res.data?.message || 'Saved', 'success');
    } catch (e: any) {
      showToast(
        e.response?.data?.message || 'That did not save, so nothing has changed. Try again.',
        'error',
      );
    } finally { setSaving(false); }
  };

  if (loading) return <PageSkeleton label="Loading your parking settings" />;
  if (failed) return <ErrorState message={failed} onRetry={load} />;

  const disabled = saving || !canEdit || !inPlan;

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-24">
      <PageHeader
        breadcrumb="Operations"
        title="Parking"
        icon={<SquareParking className="w-4.5 h-4.5" />}
        subtitle="Five short questions. Answering the first one 'yes' is what puts Parking in the menu; answering it 'no' takes it out again without losing anything."
      />

      {!inPlan && (
        <Alert severity="warning" className="rounded-2xl">
          <strong>Parking is not part of your plan.</strong>{' '}
          You can read this page, but switching parking on here would change nothing anybody can
          see — every parking screen would still be unavailable. Speak to us about adding it.
        </Alert>
      )}

      {inPlan && !canEdit && (
        <Alert severity="info" className="rounded-2xl">
          Only the society admin and the committee can change these settings. Ask them if something
          here needs to change.
        </Alert>
      )}

      {/* ---------------------------------------------------------- question 1 */}
      <SettingsCard
        icon={<SquareParking className="w-4 h-4 text-slate-600" />}
        title="Do you manage parking in your society?"
        description="Some societies allot every bay by name; others let people park where they find room. If you do not manage it, none of this appears anywhere."
      >
        <div className="grid sm:grid-cols-2 gap-2 py-3">
          <ChoiceCard
            selected={manage} disabled={disabled}
            title="Yes, we manage parking"
            blurb="You get the map, the slots, who holds each one and a waiting list. Whether you charge for it is the next question."
            onClick={() => setManage(true)}
          />
          <ChoiceCard
            selected={!manage} disabled={disabled}
            title="No, we do not"
            blurb="Parking is not shown to anybody. If you have already drawn slots and allotted them, they are kept safely and come back if you change your mind."
            onClick={() => setManage(false)}
          />
        </div>
        {saved?.managed && !manage && (
          <Alert severity="warning" className="rounded-2xl mb-3">
            Saving this hides parking from everybody. Your slots and allocations are kept, and any
            parking charge stops from next month&rsquo;s bill.
          </Alert>
        )}
      </SettingsCard>

      {/* ---------------------------------------------------------- question 2 */}
      {manage && (
        <SettingsCard
          icon={<IndianRupee className="w-4 h-4 text-slate-600" />}
          title="Is parking free, or do you charge for it?"
          description="Free still gives you everything — the map, the slots, the allocations, the waiting list. It simply never touches a bill."
        >
          <div className="grid sm:grid-cols-2 gap-2 py-3">
            <ChoiceCard
              selected={!chargeable} disabled={disabled}
              title="Free for residents"
              blurb="Many societies allot parking carefully and charge nothing for it. Nothing is added to anybody's bill."
              onClick={() => setChargeable(false)}
            />
            <ChoiceCard
              selected={chargeable} disabled={disabled}
              title="We charge for it"
              blurb="A parking line is added to the maintenance bill, for exactly the number of slots each flat holds."
              onClick={() => setChargeable(true)}
            />
          </div>
        </SettingsCard>
      )}

      {/* -------------------------------------------------- questions 3, 4 and 5 */}
      {manage && chargeable && (
        <SettingsCard
          icon={<IndianRupee className="w-4 h-4 text-slate-600" />}
          title="How much, and how often?"
          description="The amount is per slot. A flat that holds two slots is billed twice — the count comes from what has actually been allotted, not from anything typed by hand."
        >
          <div className="grid sm:grid-cols-2 gap-2 py-3">
            <ChoiceCard
              selected={frequency === 'MONTHLY'} disabled={disabled}
              title="Every month, with the maintenance bill"
              blurb="The usual arrangement. The parking line sits on the same bill as everything else."
              onClick={() => setFrequency('MONTHLY')}
            />
            <ChoiceCard
              selected={frequency === 'YEARLY'} disabled={disabled}
              title="Once a year"
              blurb="Raised on one month's bill and no other. Re-running that month's billing cannot charge it twice."
              onClick={() => setFrequency('YEARLY')}
            />
          </div>

          <SettingRow
            title={frequency === 'YEARLY' ? 'Amount per slot, per year' : 'Amount per slot, per month'}
            hint="In rupees, as you would write it on a notice."
          >
            <TextField
              type="number" size="small" value={perSlot} disabled={disabled}
              onChange={e => setPerSlot(e.target.value)}
              placeholder="0"
              slotProps={{
                htmlInput: { min: 0, max: 50000, step: 50 },
                input: { startAdornment: <span className="text-slate-400 mr-1">₹</span> },
              }}
              className="w-40"
            />
          </SettingRow>

          {frequency === 'YEARLY' && (
            <SettingRow
              title="Which month do you raise it?"
              hint="April unless you say otherwise — the start of the financial year, when most societies raise their annual levies."
            >
              <FormControl>
                <Select
                  size="small" value={month} disabled={disabled}
                  onChange={e => setMonth(Number(e.target.value))}
                >
                  {MONTHS.map((m, i) => (
                    <MenuItem key={m} value={i + 1}>{m}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </SettingRow>
          )}

          <SettingRow
            title="Charge two-wheelers differently?"
            hint="Leave this off and a bike bay is billed at the same amount as a car bay."
          >
            <Switch
              checked={separateBikeRate} disabled={disabled}
              onChange={e => setSeparateBikeRate(e.target.checked)}
            />
          </SettingRow>

          {separateBikeRate && (
            <SettingRow
              title={frequency === 'YEARLY' ? 'Two-wheeler amount, per year' : 'Two-wheeler amount, per month'}
              hint="Applies to bays marked for two-wheelers. Enter 0 if bike parking is free."
            >
              <TextField
                type="number" size="small" value={bikeRate} disabled={disabled}
                onChange={e => setBikeRate(e.target.value)}
                placeholder="0"
                slotProps={{
                  htmlInput: { min: 0, max: 50000, step: 50 },
                  input: { startAdornment: <span className="text-slate-400 mr-1">₹</span> },
                }}
                className="w-40"
              />
            </SettingRow>
          )}
        </SettingsCard>
      )}

      {saved?.carHead && (
        <Alert severity="info" className="rounded-2xl">
          This is billed as an ordinary charge head called{' '}
          <strong>{saved.carHead.name}</strong> ({saved.carHead.code}), so it appears on the invoice,
          in the collection reports and in the accounts exactly like every other charge.
          {!saved.carHead.isActive && ' It is switched off at the moment, so nothing is being billed.'}
        </Alert>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
        <Button variant="text" onClick={() => router.push('/dashboard/operations/modules')}>
          Back to what this society uses
        </Button>
        <div className="flex gap-2">
          {manage && saved?.managed && (
            <Button
              variant="outlined"
              endIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => router.push('/dashboard/parking')}
            >
              Open the parking map
            </Button>
          )}
          <Button variant="contained" disabled={disabled} onClick={save}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
