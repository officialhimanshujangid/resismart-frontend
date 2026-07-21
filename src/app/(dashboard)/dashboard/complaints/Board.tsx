'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Camera, RefreshCw, Users } from 'lucide-react';
import { Paper, Chip } from '@mui/material';
import { useToastConfirm } from '@/context/ToastConfirmContext';
import { statusMeaning } from '@/components/common/StatusChip';
import EmptyState from '@/components/common/EmptyState';
import VerbDialog, { VerbAsk } from './VerbDialog';
import {
  BOARD_COLUMNS, Complaint, Options, VERB_REQUEST, TransitionSpec,
  ago, isOverdue, sendVerb, refusal,
} from './shared';

/**
 * The board — complaints as columns, moved by dragging.
 *
 * A manager's actual question is "what is stuck and with whom", and a table
 * answers it one row at a time. Dragging a card is also the shortest honest
 * path through the state machine: the full happy path used to be eight clicks
 * and twenty-one requests, and disposing of a junk ticket was impossible
 * directly (§IV-1.4).
 *
 * **A column only accepts a card the server would accept.** The drop target is
 * resolved against the published transition table — `transitions[from]` filtered
 * to the specs a manager may use — so a card that cannot legally move there
 * simply will not drop, rather than dropping and bouncing back with a 403. The
 * two `unless` guards (community-only "me too", the pause cap) are functions
 * and do not survive JSON, so those still come back from the server as a plain
 * sentence about the ticket; that is a 400 stating a fact, not a permissions
 * error, and it is worth the honesty.
 */

/**
 * What a manager may do from this status, read off the published table.
 *
 * `ANYONE` is included because that is what the server's own `roleMatches`
 * does; leaving it out would hide "me too" from the one person who can see
 * every community complaint.
 */
const managerVerbs = (specs: TransitionSpec[] = []) =>
  specs.filter(s => s.who.includes('MANAGER') || s.who.includes('ANYONE')).map(s => s.verb);

export default function Board({
  rows, options, onChanged,
}: {
  rows: Complaint[];
  options: Options | null;
  onChanged: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToastConfirm();
  const [dragging, setDragging] = useState<Complaint | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [ask, setAsk] = useState<VerbAsk | null>(null);

  const columns = useMemo(() => BOARD_COLUMNS.map(status => ({
    status,
    label: statusMeaning(status).label,
    cards: rows.filter(r => r.status === status),
  })), [rows]);

  /** The verb that would move `row` into `status`, or nothing. */
  const moveInto = (row: Complaint | null, status: string): TransitionSpec | undefined => {
    if (!row || row.status === status) return undefined;
    const allowed = managerVerbs(options?.transitions?.[row.status]);
    return (options?.transitions?.[row.status] || [])
      .find(s => s.to === status && allowed.includes(s.verb) && VERB_REQUEST[s.verb]);
  };

  const drop = async (status: string) => {
    const row = dragging;
    setDragging(null); setOver(null);
    const spec = moveInto(row, status);
    if (!row || !spec) return;

    // Anything the verb needs is asked for first — a hold with no reason, or a
    // rejection with no explanation, is the thing this module exists to stop.
    if (VERB_REQUEST[spec.verb].needs) {
      setAsk({ verb: spec.verb, complaint: row, label: spec.label });
      return;
    }
    try {
      showToast(await sendVerb(row._id, spec.verb), 'success');
      onChanged();
    } catch (e: unknown) {
      showToast(refusal(e), 'error');
    }
  };

  if (!rows.length) {
    return (
      <EmptyState
        title="Nothing on the board"
        message="Nothing is waiting on anybody right now. Switch to All above to see complaints that have been finished."
      />
    );
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {columns.map(col => {
          const takes = !!moveInto(dragging, col.status);
          return (
            <div
              key={col.status}
              onDragOver={e => { if (takes) { e.preventDefault(); setOver(col.status); } }}
              onDragLeave={() => setOver(o => (o === col.status ? null : o))}
              onDrop={e => { e.preventDefault(); drop(col.status); }}
              className={`w-64 shrink-0 rounded-2xl border p-2 transition-colors ${
                over === col.status
                  ? 'border-blue-400 bg-blue-50/60'
                  : takes
                    ? 'border-dashed border-blue-300 bg-slate-50/60'
                    : 'border-slate-200 bg-slate-50/40'
              }`}
            >
              <div className="flex items-center justify-between px-1 pb-2">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 truncate">
                  {col.label}
                </p>
                <span className="text-[11px] font-bold text-slate-400 tabular-nums">{col.cards.length}</span>
              </div>

              <div className="space-y-2 min-h-[3rem]">
                {col.cards.map(card => (
                  <Paper
                    key={card._id}
                    elevation={0}
                    draggable
                    onDragStart={() => setDragging(card)}
                    onDragEnd={() => { setDragging(null); setOver(null); }}
                    onClick={() => router.push(`/dashboard/complaints/${card._id}`)}
                    className="rounded-xl border border-slate-200 bg-white p-2.5 cursor-grab active:cursor-grabbing"
                  >
                    <p className="text-xs font-bold text-slate-800 line-clamp-2">{card.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                      Complaint no. {card.ticketCode} · {card.flatLabel || card.blockName || 'Common area'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {card.priority === 'EMERGENCY' && (
                        <Chip size="small" label="Emergency" color="error" sx={{ height: 18, fontSize: 10 }} />
                      )}
                      {isOverdue(card) && (
                        <span className="text-[10px] font-bold text-amber-700 flex items-center gap-0.5">
                          <AlertTriangle className="w-3 h-3" />past its time
                        </span>
                      )}
                      {card.reopenCount > 0 && (
                        <span className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5">
                          <RefreshCw className="w-3 h-3" />{card.reopenCount}×
                        </span>
                      )}
                      {!!card.photoKeys?.length && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <Camera className="w-3 h-3" />{card.photoKeys.length}
                        </span>
                      )}
                      {!!card.meTooUserIds?.length && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                          <Users className="w-3 h-3" />{card.meTooUserIds.length + 1}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 truncate">
                      {card.assigneeName || card.assigneeVendorName || 'nobody assigned'} · {ago(card.createdAt)}
                    </p>
                  </Paper>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <VerbDialog
        ask={ask}
        options={options}
        onClose={() => setAsk(null)}
        onSend={async (verb, body) => {
          try {
            showToast(await sendVerb(ask!.complaint._id, verb, body), 'success');
            onChanged();
          } catch (e: unknown) {
            showToast(refusal(e), 'error');
            throw e;
          }
        }}
      />
    </>
  );
}
