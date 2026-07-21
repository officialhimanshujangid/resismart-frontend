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
import { getSidebarLinks, filterLinksByFinanceModules, filterLinksByOpsModules, filterLinksByAccess, filterLinksByResidentFeature, SidebarLink } from './sidebarContent';
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
  // Gate 4. Held here so a resident-facing link can be hidden when the society
  // handles that thing at the office instead.
  const [residentFeatures, setResidentFeatures] = useState<Record<string, boolean>>({});
  // True when the one entitlement call failed. The menu is then empty ON
  // PURPOSE, and the shell says so rather than letting it look broken.
  const [entitlementsFailed, setEntitlementsFailed] = useState(false);

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

  /**
   * All four gates, in one call, and it FAILS CLOSED.
   *
   * This used to be three separate requests — `/finance/society/modules`,
   * `/gate/modules` and `/access-roles/me` — and every one of them fell back to
   * `null` on error, where `null` meant "apply no filtering at all". So a
   * single slow or failed response showed a resident the entire society-admin
   * menu. The reasoning at the time was that a missing screen is worse than an
   * extra one, and for the *finance* toggles that was true; it stopped being
   * true the moment the same mechanism decided whether somebody sees their
   * neighbours' data.
   *
   * `/me/entitlements` never throws server-side: it returns everything switched
   * off when it cannot resolve. So an error here means an empty menu and a
   * retry, not an open one. `entitlementsFailed` is what the shell uses to say
   * so out loud, rather than leaving somebody staring at a menu with one item
   * wondering what happened.
   */
  const loadEntitlements = useCallback(() => {
    if (!role?.startsWith('SOCIETY_') && !role?.startsWith('RESIDENT_') && role !== 'FAMILY_MEMBER') {
      setFinanceModules(null); setOpsModules(null); setAccessPermissions(null);
      setEntitlementsFailed(false);
      return;
    }
    api.get('/me/entitlements')
      .then(res => {
        const d = res.data?.data;
        setFinanceModules(Array.isArray(d?.financeModules) ? d.financeModules : []);
        setOpsModules(Array.isArray(d?.opsModules) ? d.opsModules : []);
        setAccessPermissions(d?.permissions || {});
        setResidentFeatures(d?.residentFeatures || {});
        setEntitlementsFailed(false);
      })
      .catch(() => {
        // Closed, not open. Empty arrays filter everything out; `null` would
        // have filtered nothing, which is the bug this replaces.
        setFinanceModules([]); setOpsModules([]); setAccessPermissions({});
        setResidentFeatures({});
        setEntitlementsFailed(true);
      });
  }, [role]);

  useEffect(() => { loadEntitlements(); }, [loadEntitlements]);

  // The menu has to change the moment the admin saves, not on their next hard
  // reload — a toggle that appears to do nothing reads as broken. Same window-event
  // pattern the API layer already uses for 'auth-logout'.
  useEffect(() => {
    const refetch = () => { loadEntitlements(); };
    window.addEventListener('finance-modules-changed', refetch);
    window.addEventListener('ops-modules-changed', refetch);
    window.addEventListener('entitlements-changed', refetch);
    return () => {
      window.removeEventListener('finance-modules-changed', refetch);
      window.removeEventListener('ops-modules-changed', refetch);
      window.removeEventListener('entitlements-changed', refetch);
    };
  }, [loadEntitlements]);

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

  const accessFiltered: SidebarLink[] = accessPermissions
    ? filterLinksByAccess(opsFiltered, accessPermissions)
    : opsFiltered;

  // Gate 4, and only for residents — the office reaches these screens through
  // permissions, and a switch about what RESIDENTS may do says nothing about
  // what the desk may do.
  const isResident = role?.startsWith('RESIDENT_') || role === 'FAMILY_MEMBER';
  const links: SidebarLink[] = isResident
    ? filterLinksByResidentFeature(accessFiltered, residentFeatures)
    : accessFiltered;

  /**
   * The groups that lead to the page you are actually on.
   *
   * Without this, arriving at a URL directly — a bookmark, a link in a
   * notification, a browser reload, anything that is not a click in the menu
   * itself — drew every group collapsed. The current page was highlighted
   * inside a box that was shut, so the sidebar looked as though nothing was
   * selected at all. That was tolerable when Finance was a flat list; with the
   * menu now three deep it would be the first thing anybody noticed.
   *
   * Returns the labels from the outermost group inwards, e.g.
   * ['Finance', 'Setup'] for /dashboard/finance/charge-heads.
   */
  const trailTo = useCallback((items: SidebarLink[], target: string): string[] | null => {
    for (const item of items) {
      if (item.href && new URL(item.href, 'http://x').pathname === target) return [];
      if (item.children) {
        const deeper = trailTo(item.children, target);
        if (deeper) return [item.label, ...deeper];
      }
    }
    return null;
  }, []);

  const activeTrail = trailTo(links, pathname) || [];
  // Joined rather than passed as an array: a fresh array every render would
  // re-run the effect forever, and the string is the whole of what matters.
  const trailKey = activeTrail.join('>');

  useEffect(() => {
    if (!trailKey) return;
    // Merged into whatever is already open rather than replacing it, so a group
    // the reader opened by hand does not snap shut when they navigate.
    setExpandedMenus(prev => {
      const next = { ...prev };
      trailKey.split('>').forEach((label, depth) => { next[depth] = label; });
      return next;
    });
  }, [trailKey]);

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
        <div
          key={`${depth}-${idx}`}
          className={cn(
            "flex flex-col mb-1 relative",
            // Only at the top level. Nested items sit inside a group that
            // already has a left rail drawn through it, and a second horizontal
            // rule inside that reads as a broken box rather than a divider.
            link.separatorBefore && depth === 0 && "mt-3 pt-3 border-t border-slate-200"
          )}
        >
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
        {/*
          The menu now fails CLOSED, so a failed entitlement call leaves it
          nearly empty. Say so. Without this the safe behaviour is
          indistinguishable from "my society took my access away", which is a
          worse support call than the one it prevents.
        */}
        {entitlementsFailed && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
            <p className="text-[13px] font-semibold text-amber-900">Menu didn&apos;t load</p>
            <p className="mt-0.5 text-[12px] leading-snug text-amber-800">
              We couldn&apos;t check what you have access to, so we&apos;re showing less rather than more.
            </p>
            <button
              onClick={() => loadEntitlements()}
              className="mt-2 text-[12px] font-semibold text-amber-900 underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}
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

