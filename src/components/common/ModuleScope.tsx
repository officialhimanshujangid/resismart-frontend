'use client';

import React from 'react';
import { Building2, Store } from 'lucide-react';

/**
 * A small chip that makes the module scope explicit (e.g. "Societies").
 * When the Shop modules are added later, render <ModuleScope scope="shop" />
 * so the two billing/plan/settings areas stay visually distinct.
 */
export default function ModuleScope({ scope = 'society' }: { scope?: 'society' | 'shop' }) {
  const isShop = scope === 'shop';
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
        isShop
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-blue-50 text-blue-700 border-blue-200'
      }`}
    >
      {isShop ? <Store className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
      {isShop ? 'Shops module' : 'Societies module'}
    </span>
  );
}
