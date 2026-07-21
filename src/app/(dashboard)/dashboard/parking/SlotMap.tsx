'use client';

import React, { useMemo, useState } from 'react';
import { Box, ButtonBase, Paper, Popover, Typography } from '@mui/material';
import { Accessibility, Zap, Bike } from 'lucide-react';
import {
  MapSlot, Zone, SLOT_TOKENS, tokenFor, VEHICLE_KIND_LABEL, sinceWhen, squash, fmtDate,
} from './parking-types';

/**
 * The floor, drawn.
 *
 * A CSS grid built from each slot's `row`/`col`, bounded by the zone's
 * `layout`. **Cells with no slot are left empty on purpose** — that is what
 * makes the picture match the real basement, where a ramp up the middle and a
 * pillar in the corner are simply places with no bay. Modelling aisles as their
 * own objects would mean a society had to draw its ramps before it could park a
 * car in them.
 *
 * Colour is status and nothing else, from the one token map. Names and plates
 * arrive only when the viewer holds PARKING_VIEW — the server omits them
 * otherwise, and this component never invents a fallback, because a popover
 * that quietly said "occupied by A-102" to everybody would turn a screen whose
 * stated purpose is "is B1-14 free?" into a directory of who owns which car.
 */

const CELL = 64;

export interface SlotMapProps {
  zone: Zone;
  slots: MapSlot[];
  canSeeHolders: boolean;
  /** Flat number, plate or slot code. Matches pulse; everything else dims. */
  query?: string;
  onPick: (slot: MapSlot) => void;
  selectedId?: string | null;
}

/** Does this slot answer what was typed? */
function matches(slot: MapSlot, needle: string): boolean {
  if (!needle) return false;
  if (squash(slot.code).includes(needle)) return true;
  const h = slot.holder;
  if (!h) return false;
  return squash(h.flatLabel).includes(needle)
    || squash(h.plate).includes(needle)
    || squash(h.residentName).includes(needle);
}

export default function SlotMap({ zone, slots, canSeeHolders, query, onPick, selectedId }: SlotMapProps) {
  const [hover, setHover] = useState<{ el: HTMLElement; slot: MapSlot } | null>(null);

  const needle = squash(query);
  const searching = needle.length > 0;

  const hits = useMemo(
    () => new Set(searching ? slots.filter(s => matches(s, needle)).map(s => s._id) : []),
    [slots, needle, searching],
  );

  const cols = Math.max(1, zone.layout?.cols || 1);
  const rows = Math.max(1, zone.layout?.rows || 1);

  return (
    <div className="space-y-3">
      {searching && (
        <p className="text-xs font-semibold text-slate-500">
          {hits.size === 0
            ? `Nothing in ${zone.name} matches “${query}”.`
            : `${hits.size} slot${hits.size > 1 ? 's' : ''} in ${zone.name} match${hits.size > 1 ? '' : 'es'} “${query}”.`}
        </p>
      )}

      {/* Its own scroller. On a phone the grid keeps its shape and slides
          sideways instead of squeezing sixteen bays into a thumb's width. */}
      <Box
        className="overflow-x-auto overflow-y-hidden rounded-2xl border border-slate-200/70 p-3"
        sx={{
          // The floor between the bays. A flat grey would read as "nothing
          // loaded"; the hatch reads as tarmac, which is what it is.
          backgroundColor: '#f8fafc',
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(148,163,184,0.10) 0 6px, transparent 6px 12px)',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, minmax(${CELL - 8}px, 1fr))`,
            gridTemplateRows: `repeat(${rows}, ${CELL}px)`,
            gap: '6px',
            minWidth: cols * CELL,
          }}
        >
          {slots.map(slot => {
            const t = tokenFor(slot.status);
            const dimmed = searching && !hits.has(slot._id);
            const lit = searching && hits.has(slot._id);
            const picked = selectedId === slot._id;

            return (
              <ButtonBase
                key={slot._id}
                focusRipple
                onClick={() => onPick(slot)}
                onMouseEnter={e => setHover({ el: e.currentTarget, slot })}
                onMouseLeave={() => setHover(null)}
                aria-label={`${slot.code} — ${t.label}`}
                sx={{
                  gridColumn: Math.min(slot.col, cols),
                  gridRow: Math.min(slot.row, rows),
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'center',
                  borderRadius: '10px',
                  position: 'relative',
                  px: 0.5,
                  bgcolor: t.bg,
                  color: t.fg,
                  border: `1.5px solid ${picked ? '#0a5bd7' : t.border}`,
                  boxShadow: picked ? '0 0 0 3px rgba(10,91,215,0.18)' : 'none',
                  opacity: dimmed ? 0.28 : 1,
                  transition: 'opacity 180ms ease, box-shadow 180ms ease, transform 120ms ease',
                  '&:hover': { transform: 'translateY(-1px)' },
                  '@keyframes slotPulse': {
                    '0%, 100%': { boxShadow: '0 0 0 0 rgba(10,91,215,0.55)' },
                    '50%': { boxShadow: '0 0 0 7px rgba(10,91,215,0)' },
                  },
                  ...(lit ? { animation: 'slotPulse 1.3s ease-in-out infinite' } : {}),
                }}
              >
                <Typography component="span" sx={{ fontSize: 11, fontWeight: 800, lineHeight: 1.1 }} noWrap>
                  {slot.code}
                </Typography>
                {slot.holder?.flatLabel && (
                  <Typography component="span" sx={{ fontSize: 9.5, fontWeight: 600, opacity: 0.8, lineHeight: 1.2 }} noWrap>
                    {slot.holder.flatLabel}
                  </Typography>
                )}

                {/* Corner glyphs. Small, and never the only thing carrying the
                    meaning — the drawer says all three in words. */}
                <Box sx={{ position: 'absolute', top: 3, right: 3, display: 'flex', gap: '2px', opacity: 0.75 }}>
                  {slot.isAccessible && <Accessibility className="w-3 h-3" aria-hidden />}
                  {slot.hasEvCharger && <Zap className="w-3 h-3" aria-hidden />}
                  {slot.vehicleKind === 'BIKE' && <Bike className="w-3 h-3" aria-hidden />}
                </Box>
                {slot.isMine && (
                  <Box sx={{
                    position: 'absolute', bottom: 3, left: 4, fontSize: 8, fontWeight: 900,
                    letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.85,
                  }}>
                    Yours
                  </Box>
                )}
              </ButtonBase>
            );
          })}
        </Box>
      </Box>

      {/* --------------------------------------------------------- the legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {(['AVAILABLE', 'ALLOCATED', 'RESERVED', 'BLOCKED'] as const).map(s => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: SLOT_TOKENS[s].dot }} />
            <span className="text-[11px] font-semibold text-slate-500">{SLOT_TOKENS[s].label}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
          <Accessibility className="w-3.5 h-3.5" /> Easy to reach
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
          <Zap className="w-3.5 h-3.5" /> Charging point
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
          <Bike className="w-3.5 h-3.5" /> Two-wheeler
        </span>
      </div>

      {/* ------------------------------------------------------- hover detail */}
      <Popover
        open={!!hover}
        anchorEl={hover?.el}
        onClose={() => setHover(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        // A hover popover must not take the caret out of the search box.
        // Without these three, moving the mouse over the map while typing a
        // flat number steals focus and the next keystroke goes nowhere.
        disableAutoFocus
        disableEnforceFocus
        disableRestoreFocus
        sx={{ pointerEvents: 'none' }}
        slotProps={{ paper: { elevation: 8, sx: { borderRadius: '14px', p: 0 } } }}
      >
        {hover && <SlotCard slot={hover.slot} canSeeHolders={canSeeHolders} />}
      </Popover>
    </div>
  );
}

/** The popover body. Also used by the drawer, so the two can never disagree. */
export function SlotCard({ slot, canSeeHolders }: { slot: MapSlot; canSeeHolders: boolean }) {
  const t = tokenFor(slot.status);
  const h = slot.holder;
  return (
    <Paper elevation={0} className="p-3 min-w-[210px] max-w-[280px]">
      <div className="flex items-center justify-between gap-3">
        <span className="font-black text-slate-900 tracking-tight">{slot.code}</span>
        <Box component="span" sx={{
          px: 1, py: '2px', borderRadius: '999px', fontSize: 10.5, fontWeight: 800,
          bgcolor: t.bg, color: t.fg, border: `1px solid ${t.border}`,
        }}>
          {t.label}
        </Box>
      </div>

      <p className="text-[11px] text-slate-500 mt-1">
        {VEHICLE_KIND_LABEL[slot.vehicleKind]}
        {slot.isAccessible && ' · easy to reach'}
        {slot.hasEvCharger && ' · charging point'}
      </p>

      {h ? (
        <div className="mt-2 space-y-0.5 border-t border-slate-100 pt-2">
          <p className="text-xs font-bold text-slate-800">{h.flatLabel || 'A flat'}</p>
          {canSeeHolders && h.residentName && (
            <p className="text-[11px] text-slate-600">{h.residentName}</p>
          )}
          {canSeeHolders && h.plate && (
            <p className="text-[11px] font-mono text-slate-600">{h.plate}</p>
          )}
          <p className="text-[11px] text-slate-400">
            Since {fmtDate(h.since)} · {sinceWhen(h.since)}
          </p>
          {!h.chargeable && <p className="text-[11px] text-slate-400">Not charged</p>}
          {!canSeeHolders && (
            <p className="text-[10px] text-slate-400 leading-snug">
              Who parks here is only shown to the committee.
            </p>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-slate-500 mt-2 border-t border-slate-100 pt-2 leading-snug">{t.hint}</p>
      )}
    </Paper>
  );
}
