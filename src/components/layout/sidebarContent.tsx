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
  Landmark,
  KeyRound,
  DoorOpen,
  HardHat,
  MessageSquareWarning,
  Wrench
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
  /**
   * Hides this item unless the signed-in person's society role grants the
   * module. A **third** field, and deliberately so:
   *
   *   moduleKey     — ResiSmart's own staff, platform-wide
   *   financeModule — whether the SOCIETY uses a feature at all
   *   accessModule  — whether THIS PERSON may use it
   *
   * A society can have complaints switched on, and still not want the
   * gatekeeper to see them. Three questions, three fields.
   *
   * Convenience only. Every route enforces its own permission — a filtered
   * menu is not a boundary, and this codebase already learned that the hard
   * way with `PermissionRole`.
   */
  accessModule?: string;
  /**
   * Hides this item unless the society has switched the operations module on.
   *
   * The operations twin of `financeModule`. Kept separate rather than merged
   * into one `module` field because the two lists are independent — a society
   * can run finance without a gate, or a gate without finance — and one field
   * holding both namespaces would make a typo in either silently hide a screen.
   */
  opsModule?: string;
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

/**
 * Drop operations screens the society has switched off.
 *
 * Same shape and same reasoning as `filterLinksByFinanceModules`, against the
 * other module list. Untagged links always survive.
 */
export const filterLinksByOpsModules = (items: SidebarLink[], enabled: string[]): SidebarLink[] =>
  items.reduce<SidebarLink[]>((acc, link) => {
    if (link.opsModule && !enabled.includes(link.opsModule)) return acc;
    acc.push(link.children ? { ...link, children: filterLinksByOpsModules(link.children, enabled) } : link);
    return acc;
  }, []);

/**
 * Drop screens this person's society role does not grant.
 *
 * `NONE` hides; `READ` and `FULL` both show — a view-only member should still
 * find the screen, and the page itself greys out what they cannot change.
 *
 * The admin passes everything: `resolveAccess` hands them a FULL grid, so no
 * special case is needed here. Untagged links (My Flat, notices, the resident's
 * own bills) always survive — they are not governed by roles at all.
 */
export const filterLinksByAccess = (
  items: SidebarLink[],
  permissions: Record<string, string>,
): SidebarLink[] =>
  items.reduce<SidebarLink[]>((acc, link) => {
    if (link.accessModule && (permissions[link.accessModule] ?? 'NONE') === 'NONE') return acc;
    const next = link.children ? { ...link, children: filterLinksByAccess(link.children, permissions) } : link;
    // A parent whose children were all filtered away is an empty menu that
    // opens onto nothing — drop it rather than leave a dead heading.
    if (next.children && next.children.length === 0 && !next.href) return acc;
    acc.push(next);
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
          { label: 'Flat Sizes', href: '/dashboard/flat-sizes' },
          // No accessModule: the page decides what each visitor may do, and a
          // displaced admin has to be able to reach it in order to object.
          { label: 'Admin Handover', href: '/dashboard/settings/admin-transfer' }
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
        href: '/dashboard/committee',
        accessModule: 'COMMITTEE_MANAGE',
      },
      {
        label: 'Who Can Do What',
        icon: <KeyRound className="w-5 h-5" />,
        href: '/dashboard/access-roles',
        accessModule: 'ACCESS_MANAGE',
      },
      {
        label: 'Gate',
        icon: <DoorOpen className="w-5 h-5" />,
        /**
         * `opsModule` sits on the CHILDREN here, not on the group — and that
         * is load-bearing rather than fussy.
         *
         * Operations Settings is where the modules themselves are switched on
         * and off. Gate it on GATE, and an admin who turns the gate off has
         * locked the only door back in: the screen that could undo it is the
         * screen that just disappeared. So every gate screen is gated, and the
         * settings page never is.
         */
        children: [
          // The console itself is the guard's whole world, so it comes first
          // and carries the permission a guard actually holds.
          { label: 'Gate Console', href: '/dashboard/gate', opsModule: 'GATE', accessModule: 'GATE_CONSOLE' },
          // No accessModule: answering comes from having been asked, not from a
          // permission. A committee member with no gate rights still gets asked
          // about their own visitors.
          { label: 'Approvals', href: '/dashboard/gate/approvals', opsModule: 'GATE' },
          { label: 'Scan a Pass', href: '/dashboard/gate/scan', opsModule: 'GATE', accessModule: 'GATE_CONSOLE' },
          { label: 'Gate Records', href: '/dashboard/gate/log', opsModule: 'GATE', accessModule: 'GATE_LOGS' },
          // Issuing is a resident's act, so this carries no permission — a
          // committee member inviting their own guest is not doing gate work.
          { label: 'Gate Passes', href: '/dashboard/gate/passes', opsModule: 'GATE' },
          { label: 'My Preferences', href: '/dashboard/gate/preferences', opsModule: 'GATE' },
          { label: 'Operations Settings', href: '/dashboard/gate/settings', accessModule: 'OPS_SETTINGS' },
        ],
      },
      {
        label: 'Staff',
        icon: <HardHat className="w-5 h-5" />,
        href: '/dashboard/staff',
        opsModule: 'STAFF',
        accessModule: 'STAFF_VIEW',
      },
      {
        label: 'Complaints',
        icon: <MessageSquareWarning className="w-5 h-5" />,
        href: '/dashboard/complaints',
        opsModule: 'COMPLAINTS',
        // COMPLAINTS_OWN, not COMPLAINTS_MANAGE: a technician who only ever sees
        // their own queue still needs the link. The page itself asks the server
        // what to show, so a manager and a plumber land on the same href and
        // get different lists.
        accessModule: 'COMPLAINTS_OWN',
      },
      {
        label: 'Equipment',
        icon: <Wrench className="w-5 h-5" />,
        href: '/dashboard/assets',
        opsModule: 'ASSETS',
        accessModule: 'COMPLAINTS_MANAGE',
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
          // Bulk entry is a button ON the expenses page, not a sibling of it —
          // "record one" and "record twenty" are the same job at two sizes.
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
          // ONE entry for everything a society says once: its opening position,
          // its imported data, and the manual voucher for a treasurer who wants
          // it. This used to be three separate links, and nobody could tell
          // which of them they were supposed to be in.
          //
          // Deliberately NOT gated on a financeModule: it must stay reachable
          // when every other finance screen is locked, because it is where a
          // society lands when it cannot record anything yet.
          { label: 'Setup & Opening Balances', href: '/dashboard/finance/setup' },
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
        label: 'Complaints',
        icon: <MessageSquareWarning className="w-5 h-5" />,
        href: '/dashboard/complaints',
        opsModule: 'COMPLAINTS',
        // No accessModule: a resident holds no AccessRole. The page shows them
        // their own flat's complaints and the community ones, and the server
        // decides that — not this menu.
      },
      {
        label: 'Gate',
        icon: <DoorOpen className="w-5 h-5" />,
        opsModule: 'GATE',
        children: [
          { label: 'Approvals', href: '/dashboard/gate/approvals' },
          { label: 'Invite Someone', href: '/dashboard/gate/passes' },
          { label: 'Who Came', href: '/dashboard/gate/log' },
          { label: 'My Preferences', href: '/dashboard/gate/preferences' },
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
