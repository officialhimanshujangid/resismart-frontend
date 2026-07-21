'use client';

import React, { useEffect, useRef, useState } from 'react';
import { IconButton, TextField } from '@mui/material';
import { Search, X } from 'lucide-react';

/**
 * A search box whose URL keeps up but does not get in the way.
 *
 * The URL is the state everywhere in this dashboard, but pushing it on every
 * keystroke means a navigation per character — and on the map, where the
 * highlight has to feel instant, that reads as lag. So the box reports what was
 * typed straight away (`onChange`, which drives the highlight) and the URL
 * catches up 300ms later (`onCommit`, which makes the view shareable). That is
 * the same wait the gate desk already uses for its plate lookup.
 */
export default function SearchBox({
  value, onChange, onCommit, placeholder, className,
}: {
  /** The committed value, from the URL. */
  value: string;
  /** Every keystroke. Filter on this. */
  onChange: (v: string) => void;
  /** Settled — write it to the URL. */
  onCommit: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const committed = useRef(value);

  // A change that did not come from typing — a pasted link, or a tab switch
  // that cleared the filter — has to win over whatever is in the box.
  useEffect(() => {
    if (value === committed.current) return;
    committed.current = value;
    setDraft(value);
    onChange(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const type = (v: string) => {
    setDraft(v);
    onChange(v);
  };

  useEffect(() => {
    if (draft === committed.current) return;
    const t = setTimeout(() => { committed.current = draft; onCommit(draft); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <TextField
      size="small"
      placeholder={placeholder}
      value={draft}
      onChange={e => type(e.target.value)}
      className={className}
      slotProps={{
        input: {
          startAdornment: <Search className="w-4 h-4 text-slate-400 mr-2" />,
          endAdornment: draft
            ? (
              <IconButton size="small" onClick={() => type('')} aria-label="Clear search">
                <X className="w-4 h-4 text-slate-400" />
              </IconButton>
            )
            : undefined,
        },
      }}
    />
  );
}
