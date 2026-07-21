'use client';

import React, { ReactElement } from 'react';
import { Chip, SxProps, Theme } from '@mui/material';

/**
 * One status, one colour, one word — everywhere.
 *
 * Before this, six screens each kept a private `Record<string, string>` of
 * Tailwind classes, so the same complaint was indigo on one page and violet on
 * the next, and `WORK_DONE` was shown to a resident as the literal string
 * `WORK_DONE` in two places. Appendix A rule 2: never show an internal value.
 *
 * The map below is the single source of truth for BOTH the colour and the
 * words. Adding a status means adding it here, which is the point — a status
 * nobody has written a sentence for is a status nobody can read.
 */

export type Tone = 'neutral' | 'info' | 'good' | 'warn' | 'bad' | 'busy';

/**
 * Colour goes through `sx`, not a Tailwind class.
 *
 * Emotion injects MUI's own styles after Tailwind's layer, so `bg-emerald-50`
 * on a Chip loses and comes back as `!bg-emerald-50` — which is how the gate
 * pages accumulated ~400 `!important`s. Styling the component through its own
 * system means nothing has to shout.
 */
const TONE_SX: Record<Tone, SxProps<Theme>> = {
  neutral: { bgcolor: '#f1f5f9', color: '#475569' },
  info: { bgcolor: '#f0f9ff', color: '#0369a1' },
  good: { bgcolor: '#ecfdf5', color: '#047857' },
  warn: { bgcolor: '#fffbeb', color: '#92400e' },
  bad: { bgcolor: '#fff1f2', color: '#be123c' },
  busy: { bgcolor: '#f5f3ff', color: '#6d28d9' },
};

interface StatusMeaning { label: string; tone: Tone }

/**
 * Keys are the values the API actually sends. They are DB enum values and are
 * never renamed (see PART II tier 3) — only what a person reads is.
 */
const STATUS: Record<string, StatusMeaning> = {
  // ---------------------------- visitor entry (VisitorEntry.status)
  AWAITING: { label: 'Waiting for an answer', tone: 'warn' },
  AT_GATE: { label: 'Waiting at the gate', tone: 'warn' },
  INSIDE: { label: 'Still inside', tone: 'info' },
  LEFT: { label: 'Gone', tone: 'neutral' },

  // ------------------------ approval outcomes (ApprovalRequest.outcome)
  PENDING: { label: 'Waiting for an answer', tone: 'warn' },
  APPROVED: { label: 'Let in', tone: 'good' },
  DENIED: { label: 'Turned away', tone: 'bad' },
  LEFT_AT_GATE: { label: 'Left at the gate', tone: 'busy' },
  TIMED_OUT: { label: 'Nobody answered in time', tone: 'neutral' },
  GUARD_OVERRIDE: { label: 'Decided by the guard', tone: 'warn' },
  AUTO_DENIED: { label: 'Turned away automatically', tone: 'bad' },
  CANCELLED: { label: 'They left before anyone answered', tone: 'neutral' },

  // ------------------------------ visitor passes (GatePass.status)
  ACTIVE: { label: 'Usable', tone: 'good' },
  USED: { label: 'Used', tone: 'neutral' },
  EXPIRED: { label: 'Out of date', tone: 'neutral' },
  REVOKED: { label: 'Cancelled', tone: 'neutral' },

  // ------------------------------------------------------------- blocklist
  ON_LIST: { label: 'Not allowed inside', tone: 'bad' },
  LIFTED: { label: 'Taken off the list', tone: 'neutral' },

  // ------------------------------------------------------------ complaints
  NEW: { label: 'New', tone: 'info' },
  ASSIGNED: { label: 'Given to someone', tone: 'busy' },
  IN_PROGRESS: { label: 'Being worked on', tone: 'busy' },
  ON_HOLD: { label: 'Paused', tone: 'warn' },
  WORK_DONE: { label: 'Work finished — waiting for your confirmation', tone: 'busy' },
  RESOLVED: { label: 'Fixed', tone: 'good' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
  REOPENED: { label: 'Opened again', tone: 'bad' },
  REJECTED: { label: 'Not accepted', tone: 'neutral' },
};

/** What a status means, for callers that need the words without the chip. */
export function statusMeaning(status: string): StatusMeaning {
  // An unmapped status still has to render as something a person can read,
  // so the enum is softened rather than shown raw.
  return STATUS[status] || {
    label: status.toLowerCase().replace(/_/g, ' '),
    tone: 'neutral' as Tone,
  };
}

export default function StatusChip({
  status, label, tone, icon, title,
}: {
  status: string;
  /** Override the shared wording — for a chip that has to be short in a table. */
  label?: string;
  tone?: Tone;
  icon?: ReactElement;
  title?: string;
}) {
  const meaning = statusMeaning(status);
  return (
    <Chip
      size="small"
      icon={icon}
      title={title}
      label={label ?? meaning.label}
      sx={{ ...(TONE_SX[tone ?? meaning.tone] as object), '& .MuiChip-icon': { color: 'inherit' } }}
    />
  );
}
