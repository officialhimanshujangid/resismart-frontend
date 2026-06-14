'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, IUserProfile } from '../../context/AuthContext';
import ProtectedRoute from '../../components/auth/ProtectedRoute';
import { Button } from '../../components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuGroup
} from '../../components/ui/dropdown-menu';
import { 
  LayoutDashboard, 
  Users, 
  Home, 
  ShoppingBag, 
  ClipboardList, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  User, 
  ChevronDown, 
  RefreshCw,
  Building,
  DollarSign,
  Briefcase
} from 'lucide-react';

interface SidebarLink {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, activeProfile, switchProfileContext, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [otherProfiles, setOtherProfiles] = useState<IUserProfile[]>([]);
  const [switching, setSwitching] = useState(false);

  // Load available profiles to see if context switching dropdown is needed
  useEffect(() => {
    const cachedProfiles = localStorage.getItem('availableProfiles');
    if (cachedProfiles && activeProfile) {
      try {
        const list = JSON.parse(cachedProfiles) as IUserProfile[];
        // Filter out the active profile
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
        // Refresh page or push to dashboard to trigger layout updates
        router.push('/dashboard');
        // Close menus
        setSidebarOpen(false);
      } else {
        alert(res.error || 'Failed to switch context');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSwitching(false);
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    if (role.startsWith('SYSTEM_')) return 'bg-violet-500/10 text-violet-400 border-violet-500/25';
    if (role.startsWith('SOCIETY_') || role.startsWith('RESIDENT_')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
    return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
  };

  const formatRoleName = (role: string) => {
    return role
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  };

  // Get navigation links based on user role
  const getSidebarLinks = (role: string): SidebarLink[] => {
    const defaultLinks = [
      { label: 'Overview', href: '/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> }
    ];

    if (!role) return defaultLinks;

    if (role.startsWith('SYSTEM_')) {
      return [
        ...defaultLinks,
        { label: 'Societies', href: '#', icon: <Building className="w-5 h-5" /> },
        { label: 'Shops', href: '#', icon: <ShoppingBag className="w-5 h-5" /> },
        { label: 'Audit Logs', href: '#', icon: <ClipboardList className="w-5 h-5" /> },
        { label: 'System Settings', href: '#', icon: <Settings className="w-5 h-5" /> },
      ];
    }

    if (role === 'SOCIETY_ADMIN' || role === 'SOCIETY_COMMITTEE') {
      return [
        ...defaultLinks,
        { label: 'Flats & Residents', href: '#', icon: <Users className="w-5 h-5" /> },
        { label: 'Rental Profiles', href: '#', icon: <Home className="w-5 h-5" /> },
        { label: 'Audit Logs', href: '#', icon: <ClipboardList className="w-5 h-5" /> },
        { label: 'Society Settings', href: '#', icon: <Settings className="w-5 h-5" /> },
      ];
    }

    if (role.startsWith('RESIDENT_') || role === 'FAMILY_MEMBER') {
      return [
        ...defaultLinks,
        { label: 'My Flat Info', href: '#', icon: <Building className="w-5 h-5" /> },
        { label: 'My Rentals', href: '#', icon: <Home className="w-5 h-5" /> },
        { label: 'Maintenance Bills', href: '#', icon: <DollarSign className="w-5 h-5" /> },
      ];
    }

    if (role === 'SHOP_OWNER') {
      return [
        ...defaultLinks,
        { label: 'My Shop Details', href: '#', icon: <ShoppingBag className="w-5 h-5" /> },
        { label: 'My Staff', href: '#', icon: <Briefcase className="w-5 h-5" /> },
        { label: 'Client Logs', href: '#', icon: <ClipboardList className="w-5 h-5" /> },
      ];
    }

    return defaultLinks;
  };

  const links = activeProfile ? getSidebarLinks(activeProfile.role) : [];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
        {/* Switching context loader */}
        {switching && (
          <div className="fixed inset-0 bg-white/85 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-200">
            <RefreshCw className="w-10 h-10 text-primary animate-spin" />
            <p className="text-slate-800 text-sm font-semibold">Switching workspace context...</p>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Desktop Sidebar (visible on md+) */}
          <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200/60 relative z-20">
            <div className="h-16 flex items-center px-6 border-b border-slate-100">
              <span className="text-lg font-extrabold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                ResiSmart Portal
              </span>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
              {links.map((link, idx) => {
                const isActive = pathname === link.href;
                return (
                  <a
                    key={idx}
                    href={link.href}
                    className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive 
                        ? 'bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/10' 
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span className={isActive ? 'text-primary-foreground' : 'text-slate-400 group-hover:text-slate-600'}>
                      {link.icon}
                    </span>
                    <span>{link.label}</span>
                  </a>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <Button
                variant="ghost"
                onClick={logout}
                className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50/80 px-4 font-semibold transition-colors"
              >
                <LogOut className="w-5 h-5 mr-3 text-red-500/80" />
                Logout
              </Button>
            </div>
          </aside>

          {/* Mobile Sidebar Navigation Drawer */}
          {sidebarOpen && (
            <div className="md:hidden fixed inset-0 z-50 flex">
              <div 
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={() => setSidebarOpen(false)}
              />
              <aside className="relative flex flex-col w-64 max-w-xs bg-white border-r border-slate-200/60 animate-in slide-in-from-left duration-250">
                <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100">
                  <span className="text-lg font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                    ResiSmart Portal
                  </span>
                  <button 
                    onClick={() => setSidebarOpen(false)}
                    className="p-1 rounded-lg hover:bg-slate-50"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
                <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
                  {links.map((link, idx) => {
                    const isActive = pathname === link.href;
                    return (
                      <a
                        key={idx}
                        href={link.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          isActive 
                            ? 'bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/10' 
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <span className={isActive ? 'text-primary-foreground' : 'text-slate-400 group-hover:text-slate-600'}>
                          {link.icon}
                        </span>
                        <span>{link.label}</span>
                      </a>
                    );
                  })}
                </nav>
                <div className="p-4 border-t border-slate-100">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSidebarOpen(false);
                      logout();
                    }}
                    className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50/80 px-4 font-semibold"
                  >
                    <LogOut className="w-5 h-5 mr-3 text-red-500/80" />
                    Logout
                  </Button>
                </div>
              </aside>
            </div>
          )}

          {/* Main App Container */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Header */}
            <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-4 md:px-6 relative z-10">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="md:hidden p-1.5 rounded-lg hover:bg-slate-50"
                >
                  <Menu className="w-6 h-6 text-slate-600" />
                </button>
                
                {activeProfile && (
                  <div className="flex items-center space-x-2.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-bold ${getRoleBadgeStyle(activeProfile.role)}`}>
                      {formatRoleName(activeProfile.role)}
                    </span>
                    <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                      ({activeProfile.tenantType} ID: {activeProfile.tenantId.substring(0, 6)})
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-4">
                {/* Switch context option if user has other profiles */}
                {otherProfiles.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="hidden sm:flex border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        <RefreshCw className="w-3.5 h-3.5 mr-2 text-primary" />
                        Switch Profile
                        <ChevronDown className="w-3 h-3 ml-1.5 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 align-end">
                      <DropdownMenuLabel>Available Workspaces</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {otherProfiles.map((profile, idx) => (
                        <DropdownMenuItem
                          key={idx}
                          onClick={() => handleSwitchContext(profile)}
                          className="flex flex-col items-start"
                        >
                          <span className="font-semibold text-slate-800 text-xs">
                            {formatRoleName(profile.role)}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            {profile.tenantType} - {profile.tenantId.substring(0, 8)}
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
                      <button className="flex items-center space-x-2.5 p-1 rounded-lg hover:bg-slate-50 outline-none">
                        <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm shadow-inner">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-slate-700 hidden md:inline">{user.name}</span>
                        <ChevronDown className="w-4 h-4 text-slate-500 hidden md:inline" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 align-end">
                      <DropdownMenuLabel className="flex flex-col space-y-0.5">
                        <span className="text-slate-800 font-semibold">{user.name}</span>
                        <span className="text-xs text-slate-400 truncate">{user.email}</span>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => alert('Profile options coming soon!')}>
                        <User className="w-4 h-4 mr-2 text-slate-500" />
                        My Profile
                      </DropdownMenuItem>
                      {otherProfiles.length > 0 && (
                        <DropdownMenuPortal>
                          <DropdownMenuGroup className="sm:hidden">
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Switch Workspace</DropdownMenuLabel>
                            {otherProfiles.map((profile, idx) => (
                              <DropdownMenuItem
                                key={idx}
                                onClick={() => handleSwitchContext(profile)}
                              >
                                <RefreshCw className="w-3.5 h-3.5 mr-2 text-slate-500" />
                                {formatRoleName(profile.role)}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuGroup>
                        </DropdownMenuPortal>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={logout} className="text-red-500 focus:bg-red-50 focus:text-red-600">
                        <LogOut className="w-4 h-4 mr-2" />
                        Logout
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </header>

            {/* Scrollable Dashboard Viewport */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/30 relative">
              <div className="max-w-7xl mx-auto space-y-6">
                {children}
              </div>
            </main>

            {/* Footer */}
            <footer className="h-10 bg-white/60 border-t border-slate-200/60 flex items-center justify-between px-6 text-xs text-slate-400">
              <span>&copy; {new Date().getFullYear()} ResiSmart Management.</span>
              <span>v1.0.0 (Beta)</span>
            </footer>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
