'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth, IModulePermission } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import {
  Building,
  ChevronRight,
  X
} from 'lucide-react';
import { getSidebarLinks, SidebarLink } from './sidebarContent';

interface SidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export function Sidebar({ mobileOpen, setMobileOpen }: SidebarProps) {
  const { activeProfile, logout, employeePermissions } = useAuth();
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<Record<number, string>>({});

  const toggleMenu = (label: string, depth: number) => {
    setExpandedMenus(prev => {
      // If opening a new menu at this depth, close others. If clicking the same, toggle it off.
      const newExpanded = { ...prev };
      if (newExpanded[depth] === label) {
        delete newExpanded[depth];
      } else {
        newExpanded[depth] = label;
      }
      // Also close any deeper menus
      Object.keys(newExpanded).forEach(key => {
        if (Number(key) > depth) delete newExpanded[Number(key)];
      });
      return newExpanded;
    });
  };

  // Filter sidebar based on employee permissions
  const filterLinksByPermissions = (items: SidebarLink[], perms: IModulePermission[]): SidebarLink[] => {
    return items.reduce<SidebarLink[]>((acc, link) => {
      const moduleKey = link.moduleKey;
      // Always show overview
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

  // SYSTEM_EMPLOYEE: filter by assigned permissions; SYSTEM_OWNER: show all
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
          const currentSearchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
          for (const [key, value] of Object.entries(linkParams)) {
            if (currentSearchParams.get(key) !== value) {
              isActive = false;
              break;
            }
          }
        }
      }

      // Cumulative indentation: 12px basic + 14px per depth level
      const paddingLeftValue = 12 + depth * 14;
      const itemStyle = { paddingLeft: `${paddingLeftValue}px`, paddingRight: '12px' };

      return (
        <div key={`${depth}-${idx}`} className="flex flex-col">
          {hasChildren ? (
            <button
              onClick={() => toggleMenu(link.label, depth)}
              className={`flex items-center justify-between w-full py-2.5 my-0.5 rounded-xl text-sm transition-all group ${isExpanded
                  ? 'bg-blue-50/50 text-[#0a5bd7] font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                }`}
              style={itemStyle}
            >
              <div className="flex items-center space-x-3">
                {link.icon ? (
                  <span className={isExpanded ? 'text-[#0a5bd7]' : 'text-slate-400 group-hover:text-[#0a5bd7] transition-colors'}>
                    {link.icon}
                  </span>
                ) : (
                  <span className={`w-1.5 h-1.5 rounded-full ${isExpanded ? 'bg-[#0a5bd7]' : 'bg-slate-300 group-hover:bg-[#0a5bd7] transition-colors'}`} />
                )}
                <span className="truncate">{link.label}</span>
              </div>
              <ChevronRight
                className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-[#0a5bd7]' : ''}`}
              />
            </button>
          ) : (
            <Link
              href={link.href || '#'}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center space-x-3 py-2.5 my-0.5 rounded-xl text-sm transition-all group ${isActive && depth === 0
                  ? 'bg-[#407BFF] text-white shadow-md shadow-blue-500/20 font-bold'
                  : isActive && depth > 0
                  ? 'bg-blue-50 text-[#0a5bd7] font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                }`}
              style={itemStyle}
            >
              {link.icon ? (
                <span className={isActive && depth === 0 ? 'text-white' : isActive ? 'text-[#0a5bd7]' : 'text-slate-400 group-hover:text-[#0a5bd7] transition-colors'}>
                  {link.icon}
                </span>
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full ${isActive && depth === 0 ? 'bg-white' : isActive ? 'bg-[#0a5bd7]' : 'bg-slate-300 group-hover:bg-[#0a5bd7] transition-colors'}`} />
              )}
              <span className="truncate">{link.label}</span>
            </Link>
          )}

          {hasChildren && isExpanded && (
            <div className="flex flex-col mt-1 mb-1 space-y-0.5 animate-in slide-in-from-top-2 fade-in duration-300 relative before:absolute before:left-[1.35rem] before:top-0 before:bottom-0 before:w-px before:bg-slate-100">
              {renderSidebarLinks(link.children!, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const SidebarContent = () => (
    <>
      <div className="h-16 flex items-center px-5 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0a5bd7] to-[#2691f5] flex items-center justify-center shadow-md shadow-[#0a5bd7]/20 mr-3">
          <Building className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-black bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent tracking-tight">
          Resismart
        </span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {renderSidebarLinks(links)}
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-white border-r border-slate-200/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-20 flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer Sidebar */}
      <div className={cn(
        "lg:hidden fixed inset-0 z-50 flex transition-all duration-300",
        mobileOpen ? "pointer-events-auto visible" : "pointer-events-none invisible"
      )}>
        <div
          className={cn(
            "fixed inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={() => setMobileOpen(false)}
        />
        <aside className={cn(
          "relative flex flex-col w-[280px] max-w-[80vw] bg-white shadow-2xl transition-transform duration-300 ease-in-out h-full",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-4 top-6 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors z-10 animate-in fade-in zoom-in-75 duration-300"
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
