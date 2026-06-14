'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import {
  Building,
  Users,
  DollarSign,
  Activity,
  ShieldAlert,
  FileText,
  ArrowUpRight,
  CheckCircle,
  Clock,
  Sparkles,
  ShoppingBag
} from 'lucide-react';
import api from '../../../lib/api';

interface AuditLog {
  action: string;
  resource: string;
  userName: string;
  ipAddress: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { user, activeProfile } = useAuth();
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(false);

  useEffect(() => {
    const fetchAudits = async () => {
      if (!activeProfile) return;
      try {
        setLoadingAudits(true);
        // Attempt to load audit logs from API. Fallback to dummy data if not seeded yet
        const response = await api.get('/audits').catch(() => null);
        if (response && response.data) {
          const logsData = Array.isArray(response.data) ? response.data : (response.data.logs || []);
          setAudits(logsData.slice(0, 5));
        } else {
          // Setup rich placeholder logs based on roles
          setAudits(getPlaceholderAudits(activeProfile.role));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingAudits(false);
      }
    };

    fetchAudits();
  }, [activeProfile]);

  const getPlaceholderAudits = (role: string): AuditLog[] => {
    const baseDate = new Date();
    const subMin = (m: number) => new Date(baseDate.getTime() - m * 60000).toISOString();

    if (role.startsWith('SYSTEM_')) {
      return [
        { action: 'SOCIETY_CREATE', resource: 'Society', userName: 'System Owner', ipAddress: '192.168.1.1', createdAt: subMin(12) },
        { action: 'SHOP_ASSIGN_OWNER', resource: 'Shop', userName: 'System Admin', ipAddress: '192.168.1.5', createdAt: subMin(45) },
        { action: 'SYSTEM_SETTINGS_UPDATE', resource: 'Config', userName: 'System Owner', ipAddress: '192.168.1.1', createdAt: subMin(90) },
        { action: 'USER_ROLE_REVOKE', resource: 'User', userName: 'System Owner', ipAddress: '192.168.1.1', createdAt: subMin(210) },
      ];
    }
    if (role === 'SOCIETY_ADMIN' || role === 'SOCIETY_COMMITTEE') {
      return [
        { action: 'FLAT_MEMBER_ADD', resource: 'Flat', userName: user?.name || 'Admin', ipAddress: '127.0.0.1', createdAt: subMin(5) },
        { action: 'RENTAL_PROFILE_CREATE', resource: 'Rental', userName: user?.name || 'Admin', ipAddress: '127.0.0.1', createdAt: subMin(18) },
        { action: 'MAINTENANCE_RECORD_UPDATE', resource: 'Billing', userName: 'Committee Member', ipAddress: '192.168.2.14', createdAt: subMin(60) },
        { action: 'NOTICE_BOARD_POST', resource: 'SocietyNotice', userName: user?.name || 'Admin', ipAddress: '127.0.0.1', createdAt: subMin(180) },
      ];
    }
    return [
      { action: 'MEMBER_LOGIN_SUCCESS', resource: 'Session', userName: user?.name || 'Resident', ipAddress: '192.168.1.42', createdAt: subMin(1) },
      { action: 'BILL_PAYMENT_SUBMIT', resource: 'Invoice', userName: user?.name || 'Resident', ipAddress: '192.168.1.42', createdAt: subMin(1440) },
      { action: 'RENTAL_CONTRACT_VIEW', resource: 'RentalAgreement', userName: user?.name || 'Resident', ipAddress: '192.168.1.42', createdAt: subMin(2880) },
    ];
  };

  const getDashboardDetails = (role: string) => {
    switch (role) {
      case 'SYSTEM_OWNER':
      case 'SYSTEM_EMPLOYEE':
        return {
          title: 'System Control Dashboard',
          description: 'Global administrator panel monitoring cloud nodes, multi-tenant databases, and platform logs.',
          stats: [
            { label: 'Active Societies', value: '18', change: '+2 this month', icon: <Building className="w-5 h-5 text-violet-400" /> },
            { label: 'Registered Shops', value: '144', change: '+12 this week', icon: <ShoppingBag className="w-5 h-5 text-indigo-400" /> },
            { label: 'Total Users', value: '4,890', change: '+182 daily active', icon: <Users className="w-5 h-5 text-emerald-400" /> },
            { label: 'Cloud API Status', value: '99.98%', change: 'All systems online', icon: <CheckCircle className="w-5 h-5 text-teal-400" /> },
          ]
        };
      case 'SOCIETY_ADMIN':
      case 'SOCIETY_COMMITTEE':
        return {
          title: 'Society Executive Hub',
          description: 'Local panel handling flats allocation, rental agreements, notice boards, and maintenance payments.',
          stats: [
            { label: 'Society Flats', value: '128', change: '104 Occupied', icon: <Building className="w-5 h-5 text-emerald-400" /> },
            { label: 'Active Tenants', value: '38', change: '8 pending approval', icon: <Users className="w-5 h-5 text-teal-400" /> },
            { label: 'Collected Dues', value: '$12,400', change: '82% collected this month', icon: <DollarSign className="w-5 h-5 text-green-400" /> },
            { label: 'Open Grievances', value: '4', change: '2 marked high-priority', icon: <ShieldAlert className="w-5 h-5 text-amber-400" /> },
          ]
        };
      case 'RESIDENT_OWNER':
      case 'RESIDENT_TENANT':
      case 'FAMILY_MEMBER':
        return {
          title: 'Resident Portal Home',
          description: 'Manage flat directory profiles, issue maintenance receipts, and sign rental contracts.',
          stats: [
            { label: 'My Flat Context', value: 'B-404', change: 'Active Occupancy', icon: <Building className="w-5 h-5 text-cyan-400" /> },
            { label: 'Monthly Maintenance', value: 'Paid', change: 'Next due in 22 days', icon: <DollarSign className="w-5 h-5 text-emerald-400" /> },
            { label: 'Rental Agreements', value: '1 Active', change: 'Expires Dec 2026', icon: <FileText className="w-5 h-5 text-violet-400" /> },
            { label: 'New Announcements', value: '3 notices', change: 'Read notice board', icon: <Activity className="w-5 h-5 text-amber-400" /> },
          ]
        };
      case 'SHOP_OWNER':
        return {
          title: 'Retail Store Dashboard',
          description: 'Track visiting clients logs, manage employees registers, and monitor store dues.',
          stats: [
            { label: 'Store Code', value: 'G-12', change: 'Lower Level Mall', icon: <Building className="w-5 h-5 text-amber-400" /> },
            { label: 'Active Staff', value: '4 Members', change: 'All signed in', icon: <Users className="w-5 h-5 text-cyan-400" /> },
            { label: 'Client Visited Logs', value: '82 entries', change: '+14 today', icon: <Activity className="w-5 h-5 text-violet-400" /> },
            { label: 'Store Maintenance', value: 'Paid', change: 'Invoice #10492', icon: <DollarSign className="w-5 h-5 text-emerald-400" /> },
          ]
        };
      default:
        return {
          title: 'Welcome to ResiSmart',
          description: 'Workspace context loaded. Explore portal actions via the sidebar.',
          stats: [
            { label: 'Portal Status', value: 'Authorized', change: 'Session active', icon: <CheckCircle className="w-5 h-5 text-violet-400" /> },
          ]
        };
    }
  };

  const dashboardData = activeProfile ? getDashboardDetails(activeProfile.role) : getDashboardDetails('');

  const formatLogAction = (action: string) => {
    return action
      .split('_')
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  };

  const formatTimeAgo = (isoString: string) => {
    const diffMs = new Date().getTime() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return new Date(isoString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Welcome Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-violet-600/10 via-indigo-600/5 to-slate-100 p-6 md:p-8 border border-slate-200/60 shadow-lg shadow-slate-100/50">
        <div className="absolute inset-0 bg-grid-slate-900/[0.01] bg-[size:30px_30px]" />
        <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] rounded-full bg-violet-500/5 blur-[90px] pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center space-x-2 bg-violet-50 border border-violet-200/60 rounded-full px-3 py-1 w-fit">
            <Sparkles className="w-4 h-4 text-violet-600 animate-pulse" />
            <span className="text-xs font-bold text-violet-700">ResiSmart Workspaces v1.0</span>
          </div>

          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-800 mb-2">
              Hello, {user?.name || 'Portal User'}!
            </h2>
            <p className="text-slate-600 text-sm max-w-2xl leading-relaxed">
              {dashboardData.description}
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Key Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardData.stats.map((stat, idx) => (
          <Card key={idx} className="bg-white border-slate-200/60 shadow-md hover:shadow-lg transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
              <span className="text-sm font-semibold text-slate-500">{stat.label}</span>
              <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg">
                {stat.icon}
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="text-2xl font-extrabold text-slate-850 tracking-tight">{stat.value}</div>
              <p className="text-xs text-slate-400 mt-1 font-medium">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lower Dashboard Blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Logs Audit logs */}
        <Card className="lg:col-span-2 bg-white border-slate-200/60 shadow-md">
          <CardHeader className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-extrabold text-slate-800 flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-violet-600" />
                  Active Security Logs
                </CardTitle>
                <CardDescription className="text-slate-500 text-xs mt-0.5">
                  Recent activities under your active workspace context
                </CardDescription>
              </div>
              <ArrowUpRight className="w-5 h-5 text-slate-400 cursor-pointer hover:text-primary transition-colors" />
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            {loadingAudits ? (
              <p className="text-sm text-slate-400 animate-pulse py-8 text-center">Loading audit events...</p>
            ) : audits.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No logs generated yet in this context.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {audits.map((log, idx) => (
                  <div key={idx} className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0">
                    <div className="flex items-center space-x-3.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-violet-600/50 shadow-[0_0_8px_rgba(139,92,246,0.3)]" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {formatLogAction(log.action)}
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Resource: {log.resource} &bull; Actor: {log.userName}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-mono text-slate-400 block">
                        IP: {log.ipAddress}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center justify-end mt-0.5 font-medium">
                        <Clock className="w-3 h-3 mr-1 opacity-70" />
                        {formatTimeAgo(log.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notices Board / Panel */}
        <Card className="bg-white border-slate-200/60 shadow-md flex flex-col">
          <CardHeader className="p-6">
            <CardTitle className="text-lg font-extrabold text-slate-800 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-indigo-600" />
              Notices Board
            </CardTitle>
            <CardDescription className="text-slate-500 text-xs">
              Latest broadcast and community bulletins
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0 flex-1 space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 font-bold">
                  Important Notice
                </span>
                <span className="text-[10px] text-slate-400 font-medium">2 hours ago</span>
              </div>
              <p className="text-sm font-bold text-slate-800">Elevator Maintenance Schedule</p>
              <p className="text-xs text-slate-600 leading-normal">
                Block A elevators will undergo elevator testing and inspections on Friday between 10:00 AM and 2:00 PM.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100 font-bold">
                  Community Update
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Yesterday</span>
              </div>
              <p className="text-sm font-bold text-slate-800">Monsoon Waterproofing Work</p>
              <p className="text-xs text-slate-600 leading-normal">
                Society waterproofing work on structural parapet ledges has commenced. Please ensure balconies are cleared of clutter.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
