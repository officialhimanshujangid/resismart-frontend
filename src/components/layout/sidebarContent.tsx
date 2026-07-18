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
  /** Names a live counter the Sidebar resolves and renders as a badge. Hidden when 0/unknown. */
  badgeKey?: 'financePendingConfirmations';
  /**
   * Hides this item unless the society has switched the module on in Finance →
   * Settings. Visibility only — the screen and its data are untouched, so
   * turning a module back on brings it straight back.
   *
   * Deliberately NOT `moduleKey`: that one gates system-employee permissions, and
   * borrowing it would make finance disappear for an employee who simply lacks a
   * permission. Different question, different field.
   */
  financeModule?: string;
}

/**
 * Drop finance screens the society has switched off in Finance → Settings.
 *
 * Items with no `financeModule` are the core a society cannot bill without and
 * always survive. Lives here rather than in the Sidebar so it can be tested
 * against the real menu without standing up an authenticated page.
 */
export const filterLinksByFinanceModules = (items: SidebarLink[], enabled: string[]): SidebarLink[] =>
  items.reduce<SidebarLink[]>((acc, link) => {
    if (link.financeModule && !enabled.includes(link.financeModule)) return acc;
    acc.push(link.children ? { ...link, children: filterLinksByFinanceModules(link.children, enabled) } : link);
    return acc;
  }, []);

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
      },
      {
        label: 'Finance Management',
        icon: <Landmark className="w-5 h-5" />,
        // Ordered day-to-day → output → setup. The renderer has no section-label or
        // divider support, so the grouping is expressed by order alone.
        children: [
          // Day-to-day. The unmarked ones are the core a society cannot bill
          // without — they are never hidden.
          { label: 'Overview', href: '/dashboard/finance/overview' },
          { label: 'Invoices', href: '/dashboard/finance/invoices' },
          { label: 'Collections', href: '/dashboard/finance/collections' },
          { label: 'Defaulter Notices', href: '/dashboard/finance/notices', financeModule: 'NOTICES' },
          { label: 'Post-dated Cheques', href: '/dashboard/finance/pdc', financeModule: 'PDC' },
          { label: 'Confirmations', href: '/dashboard/finance/confirmations', badgeKey: 'financePendingConfirmations' },
          { label: 'Refunds', href: '/dashboard/finance/refunds', financeModule: 'REFUNDS' },
          { label: 'Expenses', href: '/dashboard/finance/expenses', financeModule: 'EXPENSES' },
          { label: 'Vendors', href: '/dashboard/finance/vendors', financeModule: 'EXPENSES' },
          { label: 'Fixed Assets', href: '/dashboard/finance/assets', financeModule: 'ASSETS' },
          { label: 'Fixed Deposits', href: '/dashboard/finance/investments', financeModule: 'INVESTMENTS' },
          // Output
          { label: 'Reports', href: '/dashboard/finance/reports' },
          { label: 'Budget', href: '/dashboard/finance/budget', financeModule: 'BUDGET' },
          // Setup
          { label: 'Members & Shares', href: '/dashboard/finance/shares', financeModule: 'SHARES' },
          { label: 'Charge Heads', href: '/dashboard/finance/charge-heads' },
          { label: 'Funds', href: '/dashboard/finance/funds', financeModule: 'FUNDS' },
          { label: 'Opening Balances', href: '/dashboard/finance/opening-balances', financeModule: 'ACCOUNTING' },
          { label: 'Bulk Import', href: '/dashboard/finance/bulk-import', financeModule: 'IMPORT' },
          { label: 'Chart of Accounts', href: '/dashboard/finance/chart-of-accounts', financeModule: 'ACCOUNTING' },
          { label: 'Vouchers & Journal', href: '/dashboard/finance/journal', financeModule: 'ACCOUNTING' },
          { label: 'Bank Reconciliation', href: '/dashboard/finance/bank-reconciliation', financeModule: 'BANKING' },
          { label: 'Settlement', href: '/dashboard/finance/settlement' },
          { label: 'Settings', href: '/dashboard/finance/settings' }
        ]
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
      },
      {
        label: 'My Bills',
        icon: <DollarSign className="w-5 h-5" />,
        href: '/dashboard/finance/my-bills'
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
