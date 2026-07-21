import api from '@/lib/api';

/**
 * What every complaint screen agrees on.
 *
 * The list, the board and the ticket page are three views of one thing, and
 * before this they each kept their own copy of the wording, the pause labels
 * and — worst — their own idea of which buttons to draw. That last one is
 * exactly the defect the server's `can` array exists to end: the server now
 * publishes the verbs it will accept, and everything here is about turning a
 * verb into a request, never about deciding whether to offer it.
 */

export interface Complaint {
  _id: string; ticketCode: string; kind: string; title: string; description?: string;
  category: string; subCategory?: string; status: string; priority: string;
  flatLabel?: string; blockName?: string; assetName?: string;
  assigneeName?: string; assigneeVendorName?: string; routedVia?: string;
  raisedByName: string; createdAt: string;
  firstResponseDueAt?: string; resolutionDueAt?: string; firstRespondedAt?: string;
  pausedAt?: string; pauseReason?: string; reopenCount: number; escalationLevel?: number;
  meTooUserIds: string[]; visibility: string; rating?: number; feedback?: string;
  photoKeys?: string[];
  rejectionReason?: string; mergedIntoId?: string;
  totalPausedMs?: number;
}

export interface EventRow {
  _id: string; type: string; note?: string; byName: string;
  createdAt: string; isInternal: boolean; photoKeys?: string[];
}

export interface Photo {
  key: string; url: string; source: 'RAISED' | 'EVENT';
  at: string; byName: string; caption?: string;
}

/** One entry of the published state machine. `unless` does not survive JSON. */
export interface TransitionSpec { to: string; verb: string; who: string[]; label: string }

export interface Options {
  categories: {
    _id: string; category: string; subCategory?: string;
    firstResponseMinutes: number; resolutionMinutes: number; isEmergency: boolean;
  }[];
  staff: { _id: string; person: { name: string }; designation: string }[];
  blocks: { _id: string; name: string }[];
  assets: { _id: string; name: string; location?: string }[];
  pauseReasons: string[];
  escalation?: { level: number; afterMinutes: number; label: string }[];
  transitions: Record<string, TransitionSpec[]>;
  verbs: Record<string, string>;
  /** The sentence explaining that the clocks only run in working hours. */
  workingHours?: string;
  photoLimit?: number;
  viewer?: { canManage: boolean; canSeeStaff: boolean; canSeeConduct: boolean };
  stats?: Stats;
}

export interface Stats {
  open: number; overdue: number; awaitingConfirmation: number; unassigned: number;
  reopenRate: number;
  medianResolutionMinutes: number | null;
  avgResolutionMinutes: number | null;
}

export interface Detail {
  complaint: Complaint;
  events: EventRow[];
  /** Exactly the verbs the server will accept from this viewer, right now. */
  can: string[];
  viewerIs: { canManage?: boolean; isAssignee?: boolean; isResident?: boolean };
}

/**
 * The columns of the board, in the order work actually moves.
 *
 * REJECTED is last and deliberately present: dropping a card there is the
 * one-click disposal that used to cost four clicks through Work-done →
 * It's-fixed → Close, permanently corrupting the resolution figures.
 */
export const BOARD_COLUMNS = [
  'NEW', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'WORK_DONE', 'RESOLVED', 'CLOSED', 'REJECTED',
] as const;

export const PAUSE_LABEL: Record<string, string> = {
  AWAITING_ACCESS: 'Nobody was home',
  AWAITING_PARTS: 'Waiting for parts',
  AWAITING_VENDOR: 'Waiting for the vendor',
  AWAITING_APPROVAL: 'Waiting for approval',
};

/**
 * The escalation ladder, worded for a person rather than as a number.
 *
 * Mirrors `ESCALATION_LADDER` in complaint.service, and `/options` publishes
 * that list too — this is the fallback wording for a rung the server has not
 * named, so a new rung shows up as words rather than as "level 5".
 */
export const ESCALATION_RUNG: Record<number, string> = {
  1: 'Raise to the person doing the work',
  2: 'Raise to the manager',
  3: 'Raise to the committee',
  4: 'Take it to the Registrar',
};

export const pretty = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());

export const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

export const when = (iso?: string) => iso
  ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '—';

/** Appendix A: never show a bare code. */
export const complaintNo = (c: Pick<Complaint, 'ticketCode'>) => `Complaint no. ${c.ticketCode}`;

export const isOverdue = (x: Complaint) =>
  !!x.resolutionDueAt
  && new Date(x.resolutionDueAt) < new Date()
  && !['RESOLVED', 'CLOSED', 'REJECTED', 'ON_HOLD', 'WORK_DONE'].includes(x.status);

/**
 * How a verb becomes a request.
 *
 * `path` is the endpoint; `needs` is what the server will refuse without, and
 * is what makes the board's drag-and-drop honest — dropping a card on "Paused"
 * has to ask WHY before it can send anything, because a free-text hold would
 * mean nothing and a missing one is a 400.
 */
export type VerbNeed = 'note' | 'reason' | 'pauseReason' | 'staff' | 'ticket' | 'rating' | 'level' | null;

export const VERB_REQUEST: Record<string, { path: string; needs: VerbNeed; done: string }> = {
  assign: { path: 'assign', needs: 'staff', done: 'Given to them' },
  respond: { path: 'respond', needs: 'note', done: 'Reply recorded' },
  comment: { path: 'comment', needs: 'note', done: 'Message added' },
  note: { path: 'note', needs: 'note', done: 'Note saved for the staff' },
  pause: { path: 'pause', needs: 'pauseReason', done: 'Put on hold' },
  resume: { path: 'resume', needs: null, done: 'Back on' },
  workDone: { path: 'work-done', needs: 'note', done: 'Marked as done' },
  resolve: { path: 'resolve', needs: null, done: 'Confirmed as fixed' },
  close: { path: 'close', needs: null, done: 'Closed' },
  reopen: { path: 'reopen', needs: 'reason', done: 'Opened again' },
  reject: { path: 'reject', needs: 'reason', done: 'Rejected' },
  duplicate: { path: 'duplicate', needs: 'ticket', done: 'Joined to the other complaint' },
  rate: { path: 'rate', needs: 'rating', done: 'Thank you' },
  meToo: { path: 'me-too', needs: null, done: 'Added you' },
  escalate: { path: 'escalate', needs: 'level', done: 'Sent up' },
};

/**
 * Send a verb. One function, so the list, the ticket page and the board all
 * hit the same endpoint with the same body — three copies of this mapping is
 * how the old page came to POST a reply and a completion note to two different
 * verbs from one shared textarea (§IV-1.6).
 *
 * Returns the sentence to show. Throws on refusal, so the caller can put the
 * server's own words in front of the person rather than "Could not do that".
 */
export async function sendVerb(id: string, verb: string, body: Record<string, unknown> = {}) {
  const spec = VERB_REQUEST[verb];
  if (!spec) throw new Error('That is not something this complaint can do.');
  await api.post(`/complaints/${id}/${spec.path}`, body);
  return spec.done;
}

/** The server's refusal, in its own words — it writes better ones than we do. */
export const refusal = (e: unknown, fallback = 'That could not be done') =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/**
 * Which verb moves a ticket INTO this column, for this viewer.
 *
 * Read off the published table, so the board can never offer a move the server
 * would refuse for a reason of status or role. The `unless` guards — community-
 * only "me too", the pause cap — are functions and do not survive JSON, so they
 * are still enforced only server-side; those come back as a plain sentence
 * about the ticket rather than as a permissions error.
 */
export function verbInto(
  transitions: Record<string, TransitionSpec[]> | undefined,
  from: string,
  to: string,
  can: string[],
): TransitionSpec | undefined {
  return (transitions?.[from] || []).find(s => s.to === to && can.includes(s.verb));
}
