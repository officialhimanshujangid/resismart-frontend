import React from 'react';
import {
  LayoutDashboard,
  Settings,
  Building,
  DollarSign,
  UsersRound,
  Store
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
          { label: 'All Societies', href: '/dashboard/societies', moduleKey: 'societies_manage', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
          { label: 'Pending Approvals', href: '/owner/societies', moduleKey: 'societies_pending', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
          { label: 'Trial Societies', href: '/dashboard/societies?life=trial', moduleKey: 'societies_manage', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
          { label: 'Subscribed', href: '/dashboard/societies?life=subscribed', moduleKey: 'societies_manage', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
          { label: 'Expired Plans', href: '/dashboard/societies?life=expired', moduleKey: 'societies_manage', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
          { 
            label: 'Society Billing', 
            moduleKey: 'billing',
            permittedUserType: ['SYSTEM_OWNER'],
            children: [
              { label: 'Plans & Pricing', href: '/owner/plans?scope=society', moduleKey: 'billing_plans', permittedUserType: ['SYSTEM_OWNER'] },
              { label: 'Subscriptions', href: '/owner/subscriptions?scope=society', moduleKey: 'billing_subscriptions', permittedUserType: ['SYSTEM_OWNER'] },
            ]
          },
          { label: 'Society Settings', href: '/dashboard/settings?scope=society', moduleKey: 'settings_general', permittedUserType: ['SYSTEM_OWNER'] },
        ]
      },
      {
        label: 'Shops',
        icon: <Store className="w-5 h-5" />,
        moduleKey: 'shops',
        permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'],
        children: [
          { label: 'All Shops', href: '/owner/shops', moduleKey: 'shops_manage', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
          { label: 'Pending Approvals', href: '/owner/approvals/shops', moduleKey: 'shops_pending', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
          { label: 'Trial Shops', href: '/owner/shops?life=trial', moduleKey: 'shops_manage', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
          { label: 'Subscribed', href: '/owner/shops?life=subscribed', moduleKey: 'shops_manage', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
          { label: 'Expired Plans', href: '/owner/shops?life=expired', moduleKey: 'shops_manage', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
          { 
            label: 'Shop Billing', 
            moduleKey: 'billing',
            permittedUserType: ['SYSTEM_OWNER'],
            children: [
              { label: 'Plans & Pricing', href: '/owner/plans?scope=shop', moduleKey: 'billing_plans', permittedUserType: ['SYSTEM_OWNER'] },
              { label: 'Subscriptions', href: '/owner/subscriptions?scope=shop', moduleKey: 'billing_subscriptions', permittedUserType: ['SYSTEM_OWNER'] },
            ]
          },
          { label: 'Shop Settings', href: '/dashboard/settings?scope=shop', moduleKey: 'settings_general', permittedUserType: ['SYSTEM_OWNER'] },
        ]
      },
      {
        label: 'Global Setup',
        icon: <Settings className="w-5 h-5" />,
        moduleKey: 'settings_general',
        permittedUserType: ['SYSTEM_OWNER'],
        children: [
          { label: 'System Invoices', href: '/owner/invoices', moduleKey: 'billing_invoices', permittedUserType: ['SYSTEM_OWNER'] },
        ],
      },
    ];
    return rawLinks.filter(link => !link.permittedUserType || link.permittedUserType.some(r => role === r || (r === 'RESIDENT_OWNER' && role.startsWith('RESIDENT_'))));
  }

  // Society Admin Links
  if (role.startsWith('SOCIETY_')) {
    return [
      ...defaultLinks,
      {
        label: 'Blocks',
        icon: <Building className="w-5 h-5" />,
        href: '/dashboard/blocks'
      },
      {
        label: 'Flats',
        icon: <Building className="w-5 h-5" />,
        href: '/dashboard/flats'
      },
      {
        label: 'Billing & Subscription',
        icon: <DollarSign className="w-5 h-5" />,
        href: '/dashboard/billing'
      }
    ];
  }

  // Shop Admin Links
  if (role.startsWith('SHOP_')) {
    return [
      ...defaultLinks,
      {
        label: 'Shop Settings',
        icon: <Settings className="w-5 h-5" />,
        href: '/dashboard/shop-settings'
      },
      {
        label: 'Billing & Subscription',
        icon: <DollarSign className="w-5 h-5" />,
        href: '/dashboard/billing'
      }
    ];
  }

  return defaultLinks;
};
