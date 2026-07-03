'use client';

import React from 'react';
import { Building2, Store, Settings } from 'lucide-react';

/**
 * A small chip that makes the module scope explicit (e.g. "Societies").
 * When the Shop modules are added later, render <ModuleScope scope="shop" />
 * so the two billing/plan/settings areas stay visually distinct.
 */
export default function ModuleScope({ scope = 'society' }: { scope?: 'society' | 'shop' | 'system' }) {
  const isShop = scope === 'shop';
  const isSystem = scope === 'system';
  
  let colors = 'bg-blue-50 text-blue-700 border-blue-200';
  let Icon = Building2;
  let label = 'Societies module';

  if (isShop) {
    colors = 'bg-amber-50 text-amber-700 border-amber-200';
    Icon = Store;
    label = 'Shops module';
  } else if (isSystem) {
    colors = 'bg-purple-50 text-purple-700 border-purple-200';
    Icon = Settings;
    label = 'System module';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${colors}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
