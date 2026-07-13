import React from 'react';
import {
  LayoutDashboard,
  Settings,
  Building,
  DollarSign,
  UsersRound,
  Store,
  Megaphone,
  ShieldCheck,
  Home,
  Landmark
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
        label: 'Resismart Housing',
        icon: <Megaphone className="w-5 h-5" />,
        moduleKey: 'marketplace',
        permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'],
        children: [
          { label: 'Map View', href: '/owner/marketplace/map', moduleKey: 'marketplace_map', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
          { label: 'Enquiries', href: '/owner/marketplace/leads', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
          { label: 'Revenue', href: '/owner/marketplace/revenue', moduleKey: 'marketplace_revenue', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
          { label: 'All Listings', href: '/owner/marketplace/listings', moduleKey: 'marketplace_listings', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
          { label: 'Settings', href: '/owner/marketplace/settings', moduleKey: 'marketplace_settings', permittedUserType: ['SYSTEM_OWNER', 'SYSTEM_EMPLOYEE'] },
        ],
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
        label: 'My Settings',
        icon: <Settings className="w-5 h-5" />,
        moduleKey: 'society_settings',
        children: [
          { label: 'Blocks', href: '/dashboard/blocks' },
          { label: 'Flat Sizes', href: '/dashboard/flat-sizes' }
        ]
      },
      {
        label: 'Flats',
        icon: <Building className="w-5 h-5" />,
        href: '/dashboard/flats'
      },
      {
        label: 'Approvals',
        icon: <ShieldCheck className="w-5 h-5" />,
        href: '/dashboard/approvals'
      },
      {
        label: 'Committee',
        icon: <Landmark className="w-5 h-5" />,
        href: '/dashboard/committee'
      },
      {
        label: 'Resismart Housing',
        icon: <Megaphone className="w-5 h-5" />,
        children: [
          { label: 'Browse', href: '/dashboard/marketplace/browse' },
          { label: 'My Listings', href: '/dashboard/marketplace' },
          { label: 'Leads', href: '/dashboard/marketplace/leads' },
          { label: 'Saved', href: '/dashboard/marketplace/saved' },
        ],
      },
      {
        label: 'Billing & Subscription',
        icon: <DollarSign className="w-5 h-5" />,
        href: '/dashboard/billing'
      }
    ];
  }

  // Resident (flat owner / tenant / family) links
  if (role.startsWith('RESIDENT_') || role === 'FAMILY_MEMBER') {
    return [
      ...defaultLinks,
      {
        label: 'My Flat',
        icon: <Home className="w-5 h-5" />,
        href: '/dashboard/my-flat'
      },
      {
        label: 'Approvals',
        icon: <ShieldCheck className="w-5 h-5" />,
        href: '/dashboard/approvals'
      },
      {
        label: 'Resismart Housing',
        icon: <Megaphone className="w-5 h-5" />,
        children: [
          { label: 'Browse', href: '/dashboard/marketplace/browse' },
          { label: 'My Listings', href: '/dashboard/marketplace' },
          { label: 'Leads', href: '/dashboard/marketplace/leads' },
        ],
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
