'use client';

import React from 'react';
import { Switch, TextField, Tooltip } from '@mui/material';
import { TriangleAlert } from 'lucide-react';

/**
 * What a plan sells, in words an owner can price.
 *
 * `Plan.capabilities` is — and stays — one flat `Map<string, number>`, because
 * it is snapshotted onto the subscription at purchase and every gate in the
 * backend already reads it. What changed is only how it is WRITTEN:
 *
 *   0            not in this plan — the module is invisible and its API 404s,
 *                for everyone in that society, the admin included
 *   -1 / absent  unlimited
 *   N            included, capped at N
 *
 * The editor used to be six number boxes labelled "Max Visitors". Nothing on
 * screen said that typing `0` there removes Visitor Management from every
 * society on the plan — an owner meaning "none included yet, we'll set it
 * later" silently shipped a plan with the gate module deleted. So the number
 * is now split into the two questions it actually answers — *is it in the
 * plan* and *how much of it* — and joined back into one number on save.
 *
 * The keys and their nouns are owned by
 * `backend/src/services/entitlement.service.ts` → `CAPABILITIES`. That file is
 * the enforcement; this one is the sales sheet. Adding a capability there
 * means adding a row here, and until somebody does the plan editor simply will
 * not offer it — which is the safe direction: a capability nobody has written
 * a sentence for is one nobody can price.
 *
 * Lives under `owner/plans/` rather than `components/common/` because it is
 * plan-editing vocabulary, and the society-side "What your plan includes"
 * panel imports the labels from here so the two screens cannot drift into
 * calling the same module two different things.
 */

/** `-1` is the only negative the backend means anything by. */
export const UNLIMITED = -1;

export interface PlanCapability {
  key: string;
  /** What a person buying this calls it. Never the database key. */
  label: string;
  /** One line: what the society gets. */
  description: string;
  /** What disappears when the switch is off. Shown at the moment it is off. */
  offMeans: string;
  /** The thing being counted — "flats", "visitor entries a month". */
  unit: string;
  /**
   * Core capabilities are part of every plan by definition: a society product
   * with no flats is not a product. The switch is still offered, because the
   * storage genuinely allows `0` and hiding that would be the same lie as
   * before — but turning it off is flagged as a mistake rather than presented
   * as a choice.
   */
  core?: boolean;
  /** Upper bound for the limit box, where one exists (finance has 11 modules). */
  max?: number;
  /** Starting cap for a brand-new plan. */
  suggested: number;
}

export interface CapabilityGroup {
  title: string;
  hint: string;
  items: PlanCapability[];
}

export const SOCIETY_CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    title: 'The society itself',
    hint: 'Every plan includes these. The number is how large a society the plan is priced for.',
    items: [
      {
        key: 'max_flat_count', label: 'Flats', unit: 'flats', core: true, suggested: 100,
        description: 'How many homes the society can have on its books.',
        offMeans: 'Nobody in the society can add a flat — not even the admin. Flats already added stay.',
      },
      {
        key: 'max_member_count', label: 'Residents', unit: 'residents', core: true, suggested: 400,
        description: 'How many people can be living in those flats at once.',
        offMeans: 'Nobody can add a resident. People already added stay, and keep their logins.',
      },
    ],
  },
  {
    title: 'Modules you are selling',
    hint: 'Switch a module off and it is gone for that society — no menu, no page, and the API answers as if it never existed. It is not greyed out; there is nothing to ask about.',
    items: [
      {
        key: 'max_visitor_count', label: 'Visitor Management', unit: 'visitor entries a month', suggested: 5000,
        description: 'The gate screens, visitor passes, resident approvals and the daily log.',
        offMeans: 'The whole gate and visitor section disappears — console, log, passes, approvals and blocklist.',
      },
      {
        key: 'max_tickets_count', label: 'Complaints', unit: 'complaints a month', suggested: 300,
        description: 'Residents report a problem; the office assigns it and closes it.',
        offMeans: 'Residents cannot report a problem and the Complaints section disappears for the office too.',
      },
      {
        key: 'max_staff_count', label: 'Staff', unit: 'staff on the register', suggested: 50,
        description: 'The staff register, their shifts, who is on duty and who is on leave.',
        offMeans: 'The staff register and duty coverage disappear. Complaints can no longer be given to a staff member.',
      },
      {
        key: 'max_parking_slots', label: 'Parking', unit: 'parking slots', suggested: 200,
        description: 'Slot inventory, which flat has which slot, and the waiting list.',
        offMeans: 'Parking slots and allocations disappear. Nothing is deleted — the slots come back if the plan changes.',
      },
      {
        key: 'max_finance_modules', label: 'Finance & Accounting', unit: 'of the 11 finance modules', max: 11, suggested: 11,
        description: 'Bills, receipts, expenses, funds, accounting and reports. The number is how many of the 11 finance modules a society may switch on.',
        offMeans: 'The entire finance section disappears — bills, receipts, expenses, accounting and reports.',
      },
      {
        key: 'max_active_listings', label: 'ResiSmart Housing', unit: 'live listings', suggested: 25,
        description: 'Flats listed for sale or rent, and the enquiries they bring in.',
        offMeans: 'Buying, selling and renting listings disappear for the society and its residents.',
      },
    ],
  },
];

export const SHOP_CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    title: 'What the shop gets',
    hint: 'Switch something off and that part of the shop app is gone for everyone on this plan.',
    items: [
      {
        key: 'max_staff_count', label: 'Staff', unit: 'staff', suggested: 10,
        description: 'People who can be given a shop login.',
        offMeans: 'The shop cannot add staff. Staff already added stay.',
      },
      {
        key: 'max_inventory_items', label: 'Items', unit: 'items', suggested: 500,
        description: 'How many products the shop can keep in its catalogue.',
        offMeans: 'The shop cannot add items to its catalogue.',
      },
      {
        key: 'max_orders_per_day', label: 'Orders a day', unit: 'orders a day', suggested: 200,
        description: 'How many orders the shop can take in one day.',
        offMeans: 'The shop cannot take orders.',
      },
      {
        key: 'max_customers', label: 'Customers', unit: 'customers', suggested: 1000,
        description: 'How many customers the shop can keep on file.',
        offMeans: 'The shop cannot add customers.',
      },
    ],
  },
];

export const groupsFor = (scope: string): CapabilityGroup[] =>
  scope === 'shop' ? SHOP_CAPABILITY_GROUPS : SOCIETY_CAPABILITY_GROUPS;

export const capabilitiesFor = (scope: string): PlanCapability[] =>
  groupsFor(scope).flatMap((g) => g.items);

/** Label for a key, for screens that only have the key. Falls back readably. */
export function capabilityLabel(key: string): string {
  const found = [...SOCIETY_CAPABILITY_GROUPS, ...SHOP_CAPABILITY_GROUPS]
    .flatMap((g) => g.items).find((c) => c.key === key);
  if (found) return found.label;
  // Never show `max_service_count` to a person. Rule: no raw keys on screen.
  return key.replace(/^max_/, '').replace(/_/g, ' ').replace(/\bcount\b/, '').trim()
    .replace(/^./, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// One number ⇄ two questions
// ---------------------------------------------------------------------------

export interface CapState {
  included: boolean;
  unlimited: boolean;
  /** Only meaningful when included and not unlimited. Always ≥ 1. */
  limit: number;
}

export function stateFromValue(raw: number | undefined | null, fallback: number): CapState {
  // Absent means unlimited to every reader in the backend (`planAllows` returns
  // true, `planLimit` returns null), so it must mean unlimited here too — the
  // one thing this control must never do is show a plan as more restrictive
  // than it is being enforced.
  if (raw === undefined || raw === null) return { included: true, unlimited: true, limit: fallback };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { included: true, unlimited: true, limit: fallback };
  if (n === 0) return { included: false, unlimited: false, limit: fallback };
  // Any other negative is data from before this was validated. `-1` is the only
  // one the backend reads as unlimited; the rest would refuse every creation
  // with no explanation. Showing them as unlimited and letting a save repair
  // them to `-1` is the reading that matches what whoever typed it meant.
  if (n < 0) return { included: true, unlimited: true, limit: fallback };
  return { included: true, unlimited: false, limit: Math.floor(n) };
}

export function valueFromState(s: CapState): number {
  if (!s.included) return 0;
  if (s.unlimited) return UNLIMITED;
  // Guarded, not trusted: a `0` arriving here would silently delete the module
  // while the switch on screen still said "in this plan".
  return Math.max(1, Math.floor(s.limit || 1));
}

/** The one-line summary of what a stored number means. */
export function describeValue(raw: number | undefined | null, cap: PlanCapability): string {
  const s = stateFromValue(raw, cap.suggested);
  if (!s.included) return 'Not in this plan';
  if (s.unlimited) return 'Unlimited';
  return `Up to ${s.limit.toLocaleString('en-IN')} ${cap.unit}`;
}

// ---------------------------------------------------------------------------
// The row
// ---------------------------------------------------------------------------

/**
 * One capability: a switch, and — when it is on — how much of it.
 *
 * The two controls write one number. There is deliberately no way to type `0`
 * into the limit box: `0` is the switch's job, and a box that can also mean
 * "remove the module" is the ambiguity this whole row exists to remove.
 */
export function CapabilityRow({
  cap, value, onChange, disabled,
}: {
  cap: PlanCapability;
  value: number | undefined;
  onChange: (next: number) => void;
  disabled?: boolean;
}) {
  const s = stateFromValue(value, cap.suggested);
  const set = (patch: Partial<CapState>) => onChange(valueFromState({ ...s, ...patch }));
  // Finance is the one capability with a real ceiling — there are 11 modules
  // and no twelfth. Typing 40 there would store a number the backend silently
  // treats as "all of them", so the plan and the invoice would disagree.
  const setLimit = (raw: string) => {
    const n = Number(raw);
    set({ limit: cap.max ? Math.min(cap.max, n) : n });
  };

  return (
    <div className={`rounded-xl border p-3 sm:p-4 transition-colors ${
      s.included ? 'border-slate-200 bg-white' : 'border-slate-200/70 bg-slate-50/70'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <Switch
            size="small"
            checked={s.included}
            disabled={disabled}
            onChange={(e) => set({ included: e.target.checked })}
            slotProps={{ input: { 'aria-label': `${cap.label} is in this plan` } }}
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800">{cap.label}</p>
            <p className="text-[11px] text-slate-500 leading-relaxed">{cap.description}</p>
          </div>
        </div>

        {/* The limit box only exists while the module does. Showing a greyed
            number next to an off switch invites "but it says 5,000". */}
        {s.included && (
          <div className="flex items-center gap-2 shrink-0">
            <Tooltip title={s.unlimited ? 'Switch this off to set a number' : 'Switch this on for no limit'}>
              <span className="flex items-center gap-1.5">
                <Switch
                  size="small"
                  checked={s.unlimited}
                  disabled={disabled}
                  onChange={(e) => set({ unlimited: e.target.checked })}
                  slotProps={{ input: { 'aria-label': `${cap.label} is unlimited` } }}
                />
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Unlimited</span>
              </span>
            </Tooltip>
            {!s.unlimited && (
              <TextField
                hiddenLabel size="small" type="number" disabled={disabled}
                value={s.limit}
                onChange={(e) => setLimit(e.target.value)}
                onBlur={(e) => setLimit(e.target.value)}
                slotProps={{ htmlInput: { min: 1, max: cap.max, 'aria-label': `${cap.label} limit` } }}
                sx={{ width: 110 }}
              />
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] mt-2 leading-relaxed">
        {s.included ? (
          <span className="text-slate-500">
            <span className="font-bold text-slate-700">{describeValue(valueFromState(s), cap)}</span>
            {!s.unlimited && cap.max ? ` (there are ${cap.max} in all)` : ''}
            {' · '}Societies already past this number keep everything they have; only new ones are refused.
          </span>
        ) : (
          <span className={`inline-flex items-start gap-1.5 font-semibold ${cap.core ? 'text-rose-700' : 'text-amber-700'}`}>
            <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>
              {cap.core && <strong>This is part of every society. </strong>}
              {cap.offMeans}
            </span>
          </span>
        )}
      </p>
    </div>
  );
}
