import type { SxProps, Theme } from '@mui/material';

/**
 * One vocabulary for the whole parking module.
 *
 * The spec is explicit that colour comes from ONE shared token map rather than
 * hand-picked classes per call site (VII-7), and Appendix A is explicit that a
 * person never reads an enum. Both live here, once, so a status that nobody has
 * written a sentence for cannot be rendered at all.
 */

export type SlotStatus =
  | 'AVAILABLE' | 'ALLOCATED' | 'RESERVED' | 'VISITOR' | 'BLOCKED' | 'OUT_OF_SERVICE';
export type SlotVehicleKind = 'CAR' | 'BIKE' | 'EV' | 'ANY';
export type SlotSize = 'COMPACT' | 'STANDARD' | 'LARGE';
export type AllocationKind = 'PERMANENT' | 'TEMPORARY' | 'VISITOR' | 'STAFF';
export type ZoneKind = 'BASEMENT' | 'STILT' | 'OPEN' | 'COVERED' | 'MLCP';

export interface Zone {
  _id: string;
  name: string;
  kind: ZoneKind;
  blockId?: string;
  blockName?: string;
  levelIndex: number;
  layout: { rows: number; cols: number };
  sortOrder: number;
  isActive: boolean;
}

export interface Slot {
  _id: string;
  zoneId: string;
  zoneName?: string;
  code: string;
  row: number;
  col: number;
  vehicleKind: SlotVehicleKind;
  size: SlotSize;
  isAccessible: boolean;
  hasEvCharger: boolean;
  status: SlotStatus;
  isActive: boolean;
}

export interface MapSlotHolder {
  allocationId: string;
  flatLabel?: string;
  residentName?: string;
  plate?: string;
  since: string;
  kind: AllocationKind;
  chargeable: boolean;
}

export interface MapSlot {
  _id: string;
  code: string;
  row: number;
  col: number;
  vehicleKind: SlotVehicleKind;
  size: SlotSize;
  isAccessible: boolean;
  hasEvCharger: boolean;
  status: SlotStatus;
  isMine: boolean;
  holder?: MapSlotHolder;
}

export interface Allocation {
  _id: string;
  slotId: string;
  slotCode: string;
  zoneId: string;
  slotKind: SlotVehicleKind;
  flatId: string;
  flatLabel?: string;
  vehicleId?: string;
  kind: AllocationKind;
  startDate: string;
  endDate?: string;
  status: 'ACTIVE' | 'ENDED';
  endReason?: string;
  chargeable: boolean;
  allocatedByName?: string;
  endedByName?: string;
}

export interface ParkingRequestRow {
  _id: string;
  flatId: string;
  flatLabel?: string;
  requestedByName: string;
  vehicleKind: SlotVehicleKind;
  note?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
  queuedAt: string;
  decidedByName?: string;
  decidedAt?: string;
  decisionNote?: string;
}

export interface OccupancyReport {
  byZone: {
    zoneId: string; name: string; kind: ZoneKind;
    total: number; allotted: number; available: number; reserved: number;
    outOfUse: number; occupancy: number | null;
  }[];
  totals: {
    slots: number; allotted: number; flats: number;
    flatsWithASlot: number; flatsWithout: number;
  };
}

export interface ReconciliationReport {
  mismatches: {
    flatId: string; flatLabel: string;
    billedCars: number; allocatedCars: number;
    billedBikes: number; allocatedBikes: number;
  }[];
  flatsChecked: number;
  slotsAllotted: number;
}

export interface FlatOption { _id: string; number: string; blockName?: string }

export const flatLabelOf = (f: FlatOption) => `${f.blockName || ''} ${f.number || ''}`.trim() || f.number;

// --------------------------------------------------------------- vocabulary

/** Plain language, Appendix A. "Two-wheeler", never "BIKE". */
export const VEHICLE_KIND_LABEL: Record<SlotVehicleKind, string> = {
  CAR: 'Car',
  BIKE: 'Two-wheeler',
  EV: 'Electric car',
  ANY: 'Anything',
};

export const SIZE_LABEL: Record<SlotSize, string> = {
  COMPACT: 'Small',
  STANDARD: 'Normal',
  LARGE: 'Big',
};

export const ZONE_KIND_LABEL: Record<ZoneKind, string> = {
  BASEMENT: 'Basement',
  STILT: 'Stilt',
  OPEN: 'Open compound',
  COVERED: 'Covered',
  MLCP: 'Multi-level car park',
};

export const ALLOCATION_KIND_LABEL: Record<AllocationKind, string> = {
  PERMANENT: 'Given for good',
  TEMPORARY: 'Given for now',
  VISITOR: 'Kept for visitors',
  STAFF: 'Given to a worker',
};

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Waiting for the committee',
  APPROVED: 'Slot given',
  REJECTED: 'Turned down',
  WITHDRAWN: 'Taken off the list',
};

/**
 * Colour = status, from one map (spec VII-7).
 *
 * These are `sx` objects rather than Tailwind classes on purpose. Emotion
 * injects after Tailwind's layer, so a `bg-emerald-50` on a MUI surface loses
 * and comes back as `!bg-emerald-50` — which is how the gate pages once
 * accumulated hundreds of `!important`s. Styling through MUI's own system means
 * nothing has to shout.
 */
export interface SlotToken {
  /** What a person reads. Never the enum. */
  label: string;
  /** One sentence for the legend and the drawer. */
  hint: string;
  bg: string;
  border: string;
  fg: string;
  /** For the legend swatch and the stat cards. */
  dot: string;
}

export const SLOT_TOKENS: Record<SlotStatus, SlotToken> = {
  AVAILABLE: {
    label: 'Free', hint: 'Nobody holds this one.',
    bg: '#ecfdf5', border: '#6ee7b7', fg: '#047857', dot: '#10b981',
  },
  ALLOCATED: {
    label: 'Given to a flat', hint: 'A flat holds this slot, and is billed for it.',
    bg: '#eff6ff', border: '#93c5fd', fg: '#1d4ed8', dot: '#3b82f6',
  },
  RESERVED: {
    label: 'Kept aside', hint: 'Held back by the committee — not given to anybody yet.',
    bg: '#fffbeb', border: '#fcd34d', fg: '#92400e', dot: '#f59e0b',
  },
  VISITOR: {
    label: 'For visitors', hint: 'Kept free for guests.',
    bg: '#fffbeb', border: '#fcd34d', fg: '#92400e', dot: '#f59e0b',
  },
  BLOCKED: {
    label: 'Not usable', hint: 'Something is in the way — a pillar, a bike stand, building work.',
    bg: '#fff1f2', border: '#fda4af', fg: '#be123c', dot: '#f43f5e',
  },
  OUT_OF_SERVICE: {
    label: 'Out of use', hint: 'Taken out of use. Put it back in service before giving it to anybody.',
    bg: '#fff1f2', border: '#fda4af', fg: '#be123c', dot: '#f43f5e',
  },
};

/** A retired slot, which has no status of its own on the map. */
export const INACTIVE_TOKEN: SlotToken = {
  label: 'Retired', hint: 'No longer part of the parking.',
  bg: '#f8fafc', border: '#e2e8f0', fg: '#94a3b8', dot: '#cbd5e1',
};

export const tokenFor = (status: SlotStatus, isActive = true): SlotToken =>
  (isActive ? SLOT_TOKENS[status] : INACTIVE_TOKEN) || INACTIVE_TOKEN;

/** The statuses a person may set by hand. ALLOCATED is a consequence, never a choice. */
export const SETTABLE_STATUSES: SlotStatus[] = ['AVAILABLE', 'RESERVED', 'VISITOR', 'BLOCKED', 'OUT_OF_SERVICE'];

export const slotChipSx = (t: SlotToken): SxProps<Theme> => ({
  bgcolor: t.bg, color: t.fg, border: `1px solid ${t.border}`, fontWeight: 700,
});

// ------------------------------------------------------------------ helpers

export const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

/** How long ago, said the way somebody says it out loud. */
export const sinceWhen = (iso?: string) => {
  if (!iso) return '—';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 31) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months} month${months > 1 ? 's' : ''} ago`;
  return `${Math.round(days / 365)} years ago`;
};

/**
 * Plates and flat numbers are written a dozen ways.
 *
 * "A-102", "A 102" and "a102" are the same flat; "MH 12 AB 1234" and
 * "MH12AB1234" are the same car. A manager typing either into the search box
 * has to find the slot, so both sides are reduced to letters and digits before
 * they are compared.
 */
export const squash = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** The message an API failure should show, never the raw axios error. */
/**
 * Turn a failed request into something a person can act on.
 *
 * The old version was `data.message || data.error || fallback`, which reads
 * fine until there is **no response at all** — the server restarting, the wifi
 * dropping, a CORS refusal. Those have no `response`, so every one of them came
 * out as the caller's generic sentence: "That did not go through." A committee
 * member reads that on a parking screen and reasonably concludes parking is
 * broken, when the truth is the backend was not answering. It cost a real
 * debugging session to find that out, which is the tell that the message was
 * the bug.
 *
 * So: say which kind of failure it was. The server's own sentence always wins
 * when there is one — those are written for the reader. Anything else gets a
 * plain description and, for the genuinely unexpected, the status code, so the
 * next person has a thread to pull.
 */
export const apiMessage = (e: any, fallback: string): string => {
  const said = e?.response?.data?.message || e?.response?.data?.error;
  if (said) return said;

  // No response object at all: the request never got an answer.
  if (!e?.response) {
    return 'Could not reach the server. Check your connection and try again — nothing was changed.';
  }

  switch (e.response.status) {
    case 401: return 'Your session has ended. Sign in again.';
    case 403: return 'You do not have access to do that.';
    case 404: return 'That is not part of what your society uses.';
    case 402: return 'Your plan does not cover this.';
    case 413: return 'That file is too large.';
    default: return `${fallback} (error ${e.response.status})`;
  }
};
