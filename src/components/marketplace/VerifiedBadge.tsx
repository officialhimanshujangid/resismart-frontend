'use client';

import React from 'react';
import { BadgeCheck } from 'lucide-react';
import { Tooltip } from '@mui/material';

/** Trust badge shown when a listing's ownership is verified from the flat record. */
export default function VerifiedBadge({ status, size = 'sm' }: { status?: string; size?: 'sm' | 'md' }) {
  if (status !== 'VERIFIED') return null;
  const px = size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[10px] px-2 py-0.5';
  return (
    <Tooltip title="Ownership verified from society records">
      <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 font-bold ${px}`}>
        <BadgeCheck className={size === 'md' ? 'w-4 h-4' : 'w-3 h-3'} /> Verified
      </span>
    </Tooltip>
  );
}
