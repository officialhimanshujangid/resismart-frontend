'use client';

import React, { useMemo } from 'react';
import { useAuth, IContext } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';
import { ResiSmartLogo } from './ResiSmartLogo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuGroup
} from '../ui/dropdown-menu';
import {
  Menu,
  User,
  ChevronDown,
  RefreshCw,
  LogOut,
  Home,
  Store,
  Building2
} from 'lucide-react';

interface HeaderProps {
  setMobileOpen: (open: boolean) => void;
  setSwitching: (switching: boolean) => void;
}

const formatRoleName = (role: string) =>
  role.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');

const getRoleBadgeStyle = (role: string) => {
  if (role.startsWith('SYSTEM_')) return 'bg-violet-500/10 text-violet-700 border-violet-500/20';
  if (role.startsWith('SOCIETY_') || role.startsWith('RESIDENT_') || role === 'FAMILY_MEMBER')
    return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
  return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
};

const ContextIcon = ({ ctx, className }: { ctx: IContext; className?: string }) => {
  if (ctx.kind === 'SHOP') return <Store className={className} />;
  if (ctx.kind === 'SOCIETY_UNIT') return <Home className={className} />;
  return <Building2 className={className} />;
};

export function Header({ setMobileOpen, setSwitching }: HeaderProps) {
  const { user, activeContext, availableContexts, switchContext, logout } = useAuth();
  const router = useRouter();

  const otherContexts = useMemo(
    () => availableContexts.filter((c) => c.contextId !== activeContext?.contextId),
    [availableContexts, activeContext]
  );

  const handleSwitchContext = async (ctx: IContext) => {
    try {
      setSwitching(true);
      const res = await switchContext(ctx.contextId);
      if (res.success) {
        // Full reload so every page re-scopes to the new unit's token.
        window.location.href = '/dashboard';
      } else {
        alert(res.error || 'Failed to switch workspace');
        setSwitching(false);
      }
    } catch (err) {
      console.error(err);
      setSwitching(false);
    }
  };

  const activeLabel = activeContext
    ? (activeContext.unitLabel || activeContext.tenantName)
    : '';

  return (
    <header className="h-16 bg-white/90 backdrop-blur-2xl border-b border-slate-200/60 flex items-center justify-between px-4 sm:px-6 relative z-10 sticky top-0 shadow-sm">
      <div className="flex items-center space-x-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="lg:hidden p-2 -ml-1 rounded-xl bg-white shadow-sm border border-slate-200/50 hover:bg-slate-50 transition-colors"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>

        {/* Mobile Logo — visible only when the sidebar is collapsed on small screens */}
        <div className="lg:hidden">
          <ResiSmartLogo href="/dashboard" variant="compact" />
        </div>

        {activeContext && (
          <div className="hidden lg:flex flex-row items-center space-x-3">
            <span className={`text-[10px] sm:text-xs px-3 py-1.5 rounded-full border font-black uppercase tracking-wider shadow-sm ${getRoleBadgeStyle(activeContext.role)}`}>
              {formatRoleName(activeContext.role)}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-600 font-bold bg-slate-100/70 px-3 py-1.5 rounded-full">
              <ContextIcon ctx={activeContext} className="w-3.5 h-3.5 text-[#0a5bd7]" />
              <span className="truncate max-w-[220px]">{activeLabel}</span>
              {activeContext.unitLabel && (
                <span className="text-slate-400 font-medium hidden xl:inline">· {activeContext.tenantName}</span>
              )}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-3 sm:space-x-5">
        {/* Switch unit / workspace */}
        {otherContexts.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="hidden sm:flex border-white/60 bg-white/60 backdrop-blur-md text-xs font-bold text-slate-700 hover:bg-white hover:text-slate-900 rounded-full px-5 py-5 shadow-sm hover:shadow transition-all">
                <RefreshCw className="w-4 h-4 mr-2 text-[#0a5bd7]" />
                Switch Unit
                <ChevronDown className="w-4 h-4 ml-2 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72 align-end p-2 rounded-2xl shadow-xl border-slate-100/50 bg-white/90 backdrop-blur-xl max-h-[70vh] overflow-y-auto">
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 pt-1 pb-2">Your Units &amp; Workspaces</DropdownMenuLabel>
              {otherContexts.map((ctx) => (
                <DropdownMenuItem
                  key={ctx.contextId}
                  onClick={() => handleSwitchContext(ctx)}
                  className="flex items-start gap-3 p-3 rounded-xl cursor-pointer hover:bg-slate-50 focus:bg-slate-50 transition-colors mb-1"
                >
                  <span className="mt-0.5 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <ContextIcon ctx={ctx} className="w-4 h-4 text-[#0a5bd7]" />
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-slate-800 text-sm truncate">
                      {ctx.unitLabel || ctx.tenantName}
                    </span>
                    <span className="text-[11px] text-slate-500 font-semibold truncate">
                      {ctx.unitLabel ? ctx.tenantName : formatRoleName(ctx.role)}
                    </span>
                    <span className={`mt-1 self-start text-[9px] px-2 py-0.5 rounded-md border font-black uppercase tracking-wider ${getRoleBadgeStyle(ctx.role)}`}>
                      {formatRoleName(ctx.role)}
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* User Info Avatar dropdown */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center space-x-3 p-1.5 pr-4 rounded-full bg-white shadow-sm border border-slate-200/50 hover:shadow-md transition-all outline-none group">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0a5bd7] to-[#2691f5] flex items-center justify-center font-bold text-white text-sm shadow-inner group-hover:scale-105 transition-transform overflow-hidden">
                  {user.profileImage ? (
                    <img src={user.profileImage} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <span className="text-sm font-bold text-slate-700 hidden md:block">{user.name}</span>
                <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block group-hover:text-slate-600 transition-colors" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 align-end p-2 rounded-3xl shadow-2xl border-slate-100/50 bg-white/90 backdrop-blur-xl">
              <DropdownMenuLabel className="flex flex-col space-y-1 p-3">
                <span className="text-slate-900 font-extrabold text-base">{user.name}</span>
                <span className="text-xs text-slate-500 font-bold truncate">{user.email}</span>
                {user.phone && <span className="text-xs text-slate-400 font-semibold truncate">{user.phone}</span>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1 bg-slate-100" />

              <DropdownMenuItem className="p-3 rounded-2xl cursor-pointer font-bold text-slate-700 focus:bg-slate-50" onClick={() => router.push('/dashboard/profile')}>
                <User className="w-4 h-4 mr-3 text-[#0a5bd7]" />
                My Profile
              </DropdownMenuItem>

              {otherContexts.length > 0 && (
                <DropdownMenuPortal>
                  <DropdownMenuGroup className="sm:hidden">
                    <DropdownMenuSeparator className="my-1 bg-slate-100" />
                    <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 pt-2 pb-1">Switch Unit</DropdownMenuLabel>
                    {otherContexts.map((ctx) => (
                      <DropdownMenuItem
                        key={ctx.contextId}
                        onClick={() => handleSwitchContext(ctx)}
                        className="p-3 rounded-2xl cursor-pointer font-bold text-slate-700 focus:bg-slate-50 mb-1"
                      >
                        <ContextIcon ctx={ctx} className="w-4 h-4 mr-3 text-slate-400" />
                        <div className="flex flex-col">
                          <span className="truncate">{ctx.unitLabel || ctx.tenantName}</span>
                          <span className="text-[9px] text-slate-400 uppercase tracking-wider">{ctx.unitLabel ? ctx.tenantName : formatRoleName(ctx.role)}</span>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuPortal>
              )}

              <DropdownMenuSeparator className="my-1 bg-slate-100" />
              <DropdownMenuItem onClick={logout} className="p-3 rounded-2xl cursor-pointer font-bold text-red-600 focus:bg-red-50 focus:text-red-700">
                <LogOut className="w-4 h-4 mr-3" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
