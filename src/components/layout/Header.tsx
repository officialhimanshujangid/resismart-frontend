'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, IUserProfile } from '../../context/AuthContext';
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
  LogOut
} from 'lucide-react';

interface HeaderProps {
  setMobileOpen: (open: boolean) => void;
  setSwitching: (switching: boolean) => void;
}

export function Header({ setMobileOpen, setSwitching }: HeaderProps) {
  const { user, activeProfile, switchProfileContext, logout } = useAuth();
  const [otherProfiles, setOtherProfiles] = useState<IUserProfile[]>([]);
  const router = useRouter();

  useEffect(() => {
    const cachedProfiles = localStorage.getItem('availableProfiles');
    if (cachedProfiles && activeProfile) {
      try {
        const list = JSON.parse(cachedProfiles) as IUserProfile[];
        const filtered = list.filter(
          (p) => !(p.tenantId === activeProfile.tenantId && p.role === activeProfile.role)
        );
        setOtherProfiles(filtered);
      } catch (_) {}
    }
  }, [activeProfile]);

  const handleSwitchContext = async (profile: IUserProfile) => {
    try {
      setSwitching(true);
      const res = await switchProfileContext(profile.tenantId, profile.role);
      if (res.success) {
        // reload window slightly to reset context deeply if preferred, or rely on state. 
        // We will just let the state update. The DashboardLayout router.push was used previously.
        window.location.href = '/dashboard';
      } else {
        alert(res.error || 'Failed to switch context');
        setSwitching(false);
      }
    } catch (err) {
      console.error(err);
      setSwitching(false);
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    if (role.startsWith('SYSTEM_')) return 'bg-violet-500/10 text-violet-700 border-violet-500/20';
    if (role.startsWith('SOCIETY_') || role.startsWith('RESIDENT_')) return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
    return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
  };

  const formatRoleName = (role: string) => {
    return role
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  };

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
        
        {activeProfile && (
          <div className="hidden lg:flex flex-row items-center space-x-3">
            <span className={`text-[10px] sm:text-xs px-3 py-1.5 rounded-full border font-black uppercase tracking-wider shadow-sm ${getRoleBadgeStyle(activeProfile.role)}`}>
              {formatRoleName(activeProfile.role)}
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden md:inline bg-slate-100/50 px-2 py-1 rounded-md">
              {activeProfile.tenantType} ID: {activeProfile.tenantId.substring(0, 6)}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-3 sm:space-x-5">
        {/* Switch context option */}
        {otherProfiles.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="hidden sm:flex border-white/60 bg-white/60 backdrop-blur-md text-xs font-bold text-slate-700 hover:bg-white hover:text-slate-900 rounded-full px-5 py-5 shadow-sm hover:shadow transition-all">
                <RefreshCw className="w-4 h-4 mr-2 text-[#0a5bd7]" />
                Switch Workspace
                <ChevronDown className="w-4 h-4 ml-2 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 align-end p-2 rounded-2xl shadow-xl border-slate-100/50 bg-white/90 backdrop-blur-xl">
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 pt-1 pb-2">Available Workspaces</DropdownMenuLabel>
              {otherProfiles.map((profile, idx) => (
                <DropdownMenuItem
                  key={idx}
                  onClick={() => handleSwitchContext(profile)}
                  className="flex flex-col items-start p-3 rounded-xl cursor-pointer hover:bg-slate-50 focus:bg-slate-50 transition-colors mb-1"
                >
                  <span className="font-bold text-slate-800 text-sm">
                    {formatRoleName(profile.role)}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 bg-slate-100 px-2 py-0.5 rounded-md">
                    {profile.tenantType} • {profile.tenantId.substring(0, 8)}
                  </span>
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
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1 bg-slate-100" />
              
              <DropdownMenuItem className="p-3 rounded-2xl cursor-pointer font-bold text-slate-700 focus:bg-slate-50" onClick={() => router.push('/dashboard/profile')}>
                <User className="w-4 h-4 mr-3 text-[#0a5bd7]" />
                My Profile
              </DropdownMenuItem>
              
              {otherProfiles.length > 0 && (
                <DropdownMenuPortal>
                  <DropdownMenuGroup className="sm:hidden">
                    <DropdownMenuSeparator className="my-1 bg-slate-100" />
                    <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-3 pt-2 pb-1">Switch Workspace</DropdownMenuLabel>
                    {otherProfiles.map((profile, idx) => (
                      <DropdownMenuItem
                        key={idx}
                        onClick={() => handleSwitchContext(profile)}
                        className="p-3 rounded-2xl cursor-pointer font-bold text-slate-700 focus:bg-slate-50 mb-1"
                      >
                        <RefreshCw className="w-4 h-4 mr-3 text-slate-400" />
                        <div className="flex flex-col">
                           <span>{formatRoleName(profile.role)}</span>
                           <span className="text-[9px] text-slate-400 uppercase tracking-wider">{profile.tenantType}</span>
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
