'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth, IModulePermission } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import api from '../../lib/api';
import {
  ChevronRight,
  X
} from 'lucide-react';
import { getSidebarLinks, filterLinksByFinanceModules, filterLinksByOpsModules, filterLinksByAccess, SidebarLink } from './sidebarContent';
import { ResiSmartLogo } from './ResiSmartLogo';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
  const { activeProfile, employeePermissions } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expandedMenus, setExpandedMenus] = useState<Record<number, string>>({});
  const [pendingConfirmations, setPendingConfirmations] = useState(0);
  // null = not answered yet. Distinct from an empty list, which is a real answer
  // meaning "this society uses none of the optional modules".
  const [financeModules, setFinanceModules] = useState<string[] | null>(null);
  // null = not answered yet, same reasoning as financeModules above: filtering
  // on a half-loaded answer flashes a truncated menu.
  const [accessPermissions, setAccessPermissions] = useState<Record<string, string> | null>(null);
  const [opsModules, setOpsModules] = useState<string[] | null>(null);

  const role = activeProfile?.role;

  // Society admins land here with an empty Confirmations inbox most days; a badge saves
  // them from clicking in to find out. One fetch once the role is known — no polling.
  useEffect(() => {
    if (!role?.startsWith('SOCIETY_')) { setPendingConfirmations(0); return; }
    let cancelled = false;
    api.get('/finance/society/collections/pending')
      .then(res => { if (!cancelled) setPendingConfirmations(Array.isArray(res.data) ? res.data.length : 0); })
      .catch(() => { if (!cancelled) setPendingConfirmations(0); }); // Stay silent on error — the badge is a hint, not a feature.
    return () => { cancelled = true; };
  }, [role]);

  // Which optional finance screens this society uses. On failure we show
  // everything: a menu that is too long is a nuisance, a menu missing the screen
  // you need is a fault.
  const loadFinanceModules = useCallback(() => {
    if (!role?.startsWith('SOCIETY_')) { setFinanceModules(null); return undefined; }
    let cancelled = false;
    api.get('/finance/society/modules')
      .then(res => { if (!cancelled) setFinanceModules(Array.isArray(res.data?.modules) ? res.data.modules : null); })
      .catch(() => { if (!cancelled) setFinanceModules(null); });
    return () => { cancelled = true; };
  }, [role]);

  useEffect(() => loadFinanceModules(), [loadFinanceModules]);

  // What THIS person may do — distinct from what the society has switched on.
  // On failure we filter nothing: the routes refuse anyway, so the worst case
  // is a link that 403s, which is far better than hiding a screen someone needs
  // because one request happened to fail.
  useEffect(() => {
    if (!role?.startsWith('SOCIETY_')) { setAccessPermissions(null); return; }
    let cancelled = false;
    api.get('/access-roles/me')
      .then(res => { if (!cancelled) setAccessPermissions(res.data?.data?.permissions || null); })
      .catch(() => { if (!cancelled) setAccessPermissions(null); });
    return () => { cancelled = true; };
  }, [role]);

  // Which optional operations screens this society uses. Same fail-open rule as
  // finance: a menu that is too long is a nuisance, one missing the screen you
  // need is a fault.
  const loadOpsModules = useCallback(() => {
    // Residents included, deliberately: they have Complaints in their menu, and
    // it has to disappear when the society switches the module off. This is the
    // cut-down endpoint, so nobody reads gate settings just to draw a menu.
    if (!role?.startsWith('SOCIETY_') && !role?.startsWith('RESIDENT_') && role !== 'FAMILY_MEMBER') {
      setOpsModules(null); return;
    }
    api.get('/gate/modules')
      .then(res => setOpsModules(res.data?.data?.modules || null))
      .catch(() => setOpsModules(null));
  }, [role]);

  useEffect(() => { loadOpsModules(); }, [loadOpsModules]);

  // The menu has to change the moment the admin saves, not on their next hard
  // reload — a toggle that appears to do nothing reads as broken. Same window-event
  // pattern the API layer already uses for 'auth-logout'.
  useEffect(() => {
    const refetchFinance = () => { loadFinanceModules(); };
    const refetchOps = () => { loadOpsModules(); };
    window.addEventListener('finance-modules-changed', refetchFinance);
    window.addEventListener('ops-modules-changed', refetchOps);
    return () => {
      window.removeEventListener('finance-modules-changed', refetchFinance);
      window.removeEventListener('ops-modules-changed', refetchOps);
    };
  }, [loadFinanceModules, loadOpsModules]);

  const toggleMenu = (label: string, depth: number) => {
    setExpandedMenus(prev => {
      const newExpanded = { ...prev };
      if (newExpanded[depth] === label) {
        delete newExpanded[depth];
      } else {
        newExpanded[depth] = label;
      }
      Object.keys(newExpanded).forEach(key => {
        if (Number(key) > depth) delete newExpanded[Number(key)];
      });
      return newExpanded;
    });
  };

  const filterLinksByPermissions = (items: SidebarLink[], perms: IModulePermission[]): SidebarLink[] => {
    return items.reduce<SidebarLink[]>((acc, link) => {
      const moduleKey = link.moduleKey;
      if (!moduleKey || moduleKey === 'overview') {
        acc.push(link);
        return acc;
      }
      const perm = perms.find(p => p.module === moduleKey);
      if (!perm?.canRead) return acc;

      if (link.children) {
        const filteredChildren = filterLinksByPermissions(link.children, perms);
        acc.push({ ...link, children: filteredChildren });
      } else {
        acc.push(link);
      }
      return acc;
    }, []);
  };

  const rawLinks = activeProfile ? getSidebarLinks(activeProfile.role) : [];

  const permissionFiltered: SidebarLink[] =
    activeProfile?.role === 'SYSTEM_EMPLOYEE' && employeePermissions
      ? filterLinksByPermissions(rawLinks, employeePermissions)
      : rawLinks;

  const moduleFiltered: SidebarLink[] = financeModules
    ? filterLinksByFinanceModules(permissionFiltered, financeModules)
    : permissionFiltered;

  const opsFiltered: SidebarLink[] = opsModules
    ? filterLinksByOpsModules(moduleFiltered, opsModules)
    : moduleFiltered;

  const links: SidebarLink[] = accessPermissions
    ? filterLinksByAccess(opsFiltered, accessPermissions)
    : opsFiltered;

  const badgeCounts: Record<string, number> = { financePendingConfirmations: pendingConfirmations };

  // A collapsed group hides its children, so roll descendant counts up to the parent —
  // otherwise the badge only appears once you've already clicked in to look.
  const badgeFor = (link: SidebarLink): number =>
    (link.badgeKey ? badgeCounts[link.badgeKey] || 0 : 0) +
    (link.children || []).reduce((sum, child) => sum + badgeFor(child), 0);

  const renderBadge = (count: number, onDarkActiveRow: boolean) => (
    <span className={cn(
      "shrink-0 min-w-[20px] px-1.5 py-0.5 rounded-full text-[10px] font-black text-center leading-4",
      onDarkActiveRow ? "bg-white text-blue-700" : "bg-red-500 text-white"
    )}>
      {count > 99 ? '99+' : count}
    </span>
  );

  const renderSidebarLinks = (items: SidebarLink[], depth = 0) => {
    return items.map((link, idx) => {
      const hasChildren = link.children && link.children.length > 0;
      const isExpanded = expandedMenus[depth] === link.label;
      const badgeCount = badgeFor(link);

      let isActive = false;
      if (link.href) {
        const linkUrl = new URL(link.href, 'http://localhost');
        const linkPath = linkUrl.pathname;
        const linkParams = Object.fromEntries(linkUrl.searchParams.entries());

        isActive = pathname === linkPath;
        if (isActive) {
          // Check that all link params exist in the URL and match exactly
          for (const [key, value] of Object.entries(linkParams)) {
            if (searchParams.get(key) !== value) {
              isActive = false;
              break;
            }
          }
          
          // Prevent base links (e.g. 'All Societies') from being active when a specific tab (like 'life=subscribed') is selected
          if (isActive) {
            const exclusiveParams = ['life', 'scope'];
            for (const key of exclusiveParams) {
              if (searchParams.has(key) && !linkParams[key]) {
                isActive = false;
                break;
              }
            }
          }
        }
      }

      // Indentation base for the hierarchy
      const paddingLeftValue = 16 + depth * 16;
      const itemStyle = { paddingLeft: `${paddingLeftValue}px`, paddingRight: '16px' };

      return (
        <div key={`${depth}-${idx}`} className="flex flex-col mb-1 relative">
          {hasChildren ? (
            <button
              onClick={() => toggleMenu(link.label, depth)}
              className={cn(
                "flex items-center justify-between w-full py-2.5 rounded-xl text-sm transition-all duration-300 group outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50",
                isExpanded
                  ? "bg-blue-100 text-blue-800 font-semibold shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium"
              )}
              style={itemStyle}
            >
              <div className="flex items-center space-x-3">
                {link.icon ? (
                  <span className={cn(
                    "transition-all duration-300",
                    isExpanded ? "text-blue-700 scale-110" : "text-slate-400 group-hover:text-blue-600 group-hover:scale-110"
                  )}>
                    {link.icon}
                  </span>
                ) : (
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full transition-all duration-300",
                    isExpanded ? "bg-blue-700 scale-125" : "bg-slate-300 group-hover:bg-blue-600 group-hover:scale-125"
                  )} />
                )}
                <span className="truncate tracking-wide">{link.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Once expanded the child carries its own badge — showing both is just noise. */}
                {badgeCount > 0 && !isExpanded && renderBadge(badgeCount, false)}
                <ChevronRight
                  className={cn(
                    "w-4 h-4 text-slate-400 transition-transform duration-300",
                    isExpanded ? "rotate-90 text-blue-700" : "group-hover:translate-x-0.5 group-hover:text-slate-600"
                  )}
                />
              </div>
            </button>
          ) : (
            <Link
              href={link.href || '#'}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center space-x-3 py-2.5 rounded-xl text-sm transition-all duration-300 group outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 relative overflow-hidden",
                isActive && depth === 0
                  ? "bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-lg shadow-blue-600/40 font-semibold translate-x-1"
                  : isActive && depth > 0
                  ? "bg-blue-100 text-blue-800 font-semibold shadow-sm"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium hover:translate-x-1"
              )}
              style={itemStyle}
            >
              {isActive && depth === 0 && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/40 rounded-r-full" />
              )}
              {link.icon ? (
                <span className={cn(
                  "transition-all duration-300",
                  isActive && depth === 0 ? "text-white scale-110" : isActive ? "text-blue-700 scale-110" : "text-slate-400 group-hover:text-blue-600 group-hover:scale-110"
                )}>
                  {link.icon}
                </span>
              ) : (
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-300",
                  isActive && depth === 0 ? "bg-white scale-125" : isActive ? "bg-blue-700 scale-125" : "bg-slate-300 group-hover:bg-blue-600 group-hover:scale-125"
                )} />
              )}
              <span className="truncate tracking-wide flex-1">{link.label}</span>
              {badgeCount > 0 && renderBadge(badgeCount, isActive && depth === 0)}
            </Link>
          )}

          {hasChildren && (
            <div className={cn(
              "grid transition-all duration-300 ease-in-out",
              isExpanded ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"
            )}>
              <div className="overflow-hidden flex flex-col space-y-1 relative before:absolute before:left-[1.6rem] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
                {renderSidebarLinks(link.children!, depth + 1)}
              </div>
            </div>
          )}
        </div>
      );
    });
  };

  const sidebarContentNode = (
    <div className="flex flex-col h-full bg-white/90 backdrop-blur-xl">
      <div className="h-16 flex items-center justify-center border-b border-slate-200/60 shrink-0">
        <ResiSmartLogo href="/dashboard" variant="full" />
      </div>
      <div className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar">
        <div className="space-y-1">
          {renderSidebarLinks(links)}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[280px] bg-white border-r border-slate-200/50 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 flex-shrink-0">
        {sidebarContentNode}
      </aside>

      {/* Mobile Drawer Sidebar */}
      <div className={cn(
        "lg:hidden fixed inset-0 z-50 flex transition-all duration-300",
        mobileOpen ? "pointer-events-auto visible" : "pointer-events-none invisible"
      )}>
        <div
          className={cn(
            "fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMobileOpen(false)}
        />
        <aside className={cn(
          "relative flex flex-col w-[280px] max-w-[80vw] bg-white shadow-2xl transition-transform duration-300 ease-out h-full",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-4 top-6 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors z-10 animate-in fade-in zoom-in-75 duration-300 shadow-sm"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {sidebarContentNode}
        </aside>
      </div>
    </>
  );
}

