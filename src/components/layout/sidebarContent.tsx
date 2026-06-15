import React from 'react';
import {
  LayoutDashboard,
  Users,
  Home,
  ShoppingBag,
  ClipboardList,
  Settings,
  Building,
  DollarSign,
  Briefcase,
  UsersRound
} from 'lucide-react';

export interface SidebarLink {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  moduleKey?: string;  // Used for permission filtering
  permittedUserType?: string[];
  children?: SidebarLink[];
}

export const teamManagementMenu: SidebarLink = {
  label: 'Team Management',
  icon: <UsersRound className="w-5 h-5" />,
  moduleKey: 'team',
  permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'],
  children: [
    { label: 'My Team', href: '/dashboard/team/employees', moduleKey: 'team_employees', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
    { label: 'Hierarchy', href: '/dashboard/team/hierarchy', moduleKey: 'team_hierarchy', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
    { label: 'Designations', href: '/dashboard/team/designations', moduleKey: 'team_designations', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
    { label: 'Permission Roles', href: '/dashboard/team/permission-roles', moduleKey: 'team_roles', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
  ],
};

export const getSidebarLinks = (role: string): SidebarLink[] => {
  const defaultLinks: SidebarLink[] = [
    {
      label: 'Overview',
      href: '/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      moduleKey: 'overview',
      permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE', 'SOCIETY_ADMIN', 'SOCIETY_COMMITTEE', 'RESIDENT_OWNER', 'RESIDENT_TENANT', 'FAMILY_MEMBER', 'SHOP_OWNER']
    }
  ];

  if (!role) return defaultLinks;

  if (role.startsWith('SYSTEM_')) {
    const rawLinks: SidebarLink[] = [
      ...defaultLinks,
      teamManagementMenu,
      {
        label: 'Societies',
        icon: <Building className="w-5 h-5" />,
        moduleKey: 'societies',
        permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'],
        children: [
          { label: 'Manage Societies', href: '/dashboard/societies', moduleKey: 'societies_manage', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
          { label: 'Pending Approvals', href: '/dashboard/societies/pending', moduleKey: 'societies_pending', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] }
        ]
      },
      {
        label: 'Shops',
        icon: <ShoppingBag className="w-5 h-5" />,
        moduleKey: 'shops',
        permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'],
        children: [
          { label: 'Manage Shops', href: '/dashboard/shops', moduleKey: 'shops_manage', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
          { label: 'Categories', href: '/dashboard/shops/categories', moduleKey: 'shops_categories', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] }
        ]
      },
      {
        label: 'Audit Logs',
        href: '/dashboard/audit-logs',
        icon: <ClipboardList className="w-5 h-5" />,
        moduleKey: 'audit-logs',
        permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE']
      },
      {
        label: 'System Settings',
        icon: <Settings className="w-5 h-5" />,
        moduleKey: 'settings',
        permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'],
        children: [
          { label: 'General', href: '/dashboard/settings', moduleKey: 'settings_general', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
          { label: 'Security', href: '/dashboard/settings/security', moduleKey: 'settings_security', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] }
        ]
      },

    ];
    return rawLinks.filter(link => !link.permittedUserType || link.permittedUserType.some(r => role === r || (r === 'RESIDENT_OWNER' && role.startsWith('RESIDENT_'))));
  }


  return defaultLinks;
};
