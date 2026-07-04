'use client';

import React, { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth, IModulePermission } from '../../context/AuthContext';
import { cn } from '../../lib/utils';
import {
  ChevronRight,
  X
} from 'lucide-react';
import { getSidebarLinks, SidebarLink } from './sidebarContent';
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

  const links: SidebarLink[] =
    activeProfile?.role === 'SYSTEM_EMPLOYEE' && employeePermissions
      ? filterLinksByPermissions(rawLinks, employeePermissions)
      : rawLinks;

  const renderSidebarLinks = (items: SidebarLink[], depth = 0) => {
    return items.map((link, idx) => {
      const hasChildren = link.children && link.children.length > 0;
      const isExpanded = expandedMenus[depth] === link.label;

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
              <ChevronRight
                className={cn(
                  "w-4 h-4 text-slate-400 transition-transform duration-300",
                  isExpanded ? "rotate-90 text-blue-700" : "group-hover:translate-x-0.5 group-hover:text-slate-600"
                )}
              />
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
              <span className="truncate tracking-wide">{link.label}</span>
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

  const SidebarContent = () => (
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
        <SidebarContent />
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
          <SidebarContent />
        </aside>
      </div>
    </>
  );
}

