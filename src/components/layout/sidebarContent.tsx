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
  DoorOpen,
  MessageSquareWarning,
  Bell
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

/**
 * Drop entries this kind of user is not meant to see.
 *
 * Recursive, and that is the fix rather than a flourish. The system branch used
 * to filter with a single `rawLinks.filter(...)` over the top level only, so
 * every `permittedUserType` on a nested entry was decorative — a SYSTEM_EMPLOYEE
 * was shown "Society Billing → Plans & Pricing", marked owner-only, and found
 * out it was owner-only by being refused when they clicked it.
 *
 * Not a boundary. Every route enforces its own permission; this only stops the
 * menu from advertising doors that will not open.
 */
export const filterLinksByUserType = (items: SidebarLink[], role: string): SidebarLink[] =>
  items.reduce<SidebarLink[]>((acc, link) => {
    const allowed = !link.permittedUserType
      || link.permittedUserType.some(r => role === r || (r === 'RESIDENT_OWNER' && role.startsWith('RESIDENT_')));
    if (!allowed) return acc;
    const next = link.children ? { ...link, children: filterLinksByUserType(link.children, role) } : link;
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
    return filterLinksByUserType(rawLinks, role);
  }

  // Society Admin Links
  //
  // Shaped as five top-level groups — Property, Operations, Finance, Housing,
  // Society — because the flat version had forty-nine entries at one level and
  // twenty-two of them were Finance. Nothing was gained by the flatness: a
  // person hunting for Charge Heads scrolled past Bank Reconciliation either
  // way. Grouping costs one click and makes the menu readable at a glance.
  if (role.startsWith('SOCIETY_')) {
    return [
      ...defaultLinks,
      {
        label: 'Property',
        icon: <Building className="w-5 h-5" />,
        children: [
          { label: 'Flats', href: '/dashboard/flats' },
          { label: 'Blocks', href: '/dashboard/blocks' },
          { label: 'Flat Sizes', href: '/dashboard/flat-sizes' },
          // "Approvals" plain was one of two entries by that name — this one is
          // residents asking to join a flat, the other is a visitor at the gate.
          // Two unrelated jobs sharing a word is how a menu stops being read.
          { label: 'Resident Requests', href: '/dashboard/approvals' },
        ],
      },
      {
        label: 'Operations',
        icon: <DoorOpen className="w-5 h-5" />,
        children: [
          // First, because it is what a new society needs and the only place
          // that explains why the console might be refusing them.
          { label: 'Setting Up', href: '/dashboard/operations/setup', accessModule: 'OPS_SETTINGS' },
          {
            label: 'Gate',
            opsModule: 'GATE',
            children: [
              // The console itself is the guard's whole world, so it comes first
              // and carries the permission a guard actually holds.
              { label: 'Gate Console', href: '/dashboard/gate', accessModule: 'GATE_CONSOLE' },
              // No accessModule: answering comes from having been asked, not from a
              // permission. A committee member with no gate rights still gets asked
              // about their own visitors.
              { label: 'Visitor Approvals', href: '/dashboard/gate/approvals' },
              { label: 'Scan a Pass', href: '/dashboard/gate/scan', accessModule: 'GATE_CONSOLE' },
              { label: 'Gate Records', href: '/dashboard/gate/log', accessModule: 'GATE_LOGS' },
              // Issuing is a resident's act, so this carries no permission — a
              // committee member inviting their own guest is not doing gate work.
              { label: 'Gate Passes', href: '/dashboard/gate/passes' },
              { label: 'Resident Vehicles', href: '/dashboard/gate/vehicles', accessModule: 'GATE_CONSOLE' },
              { label: 'Blocklist', href: '/dashboard/gate/blocklist', accessModule: 'GATE_CONSOLE' },
              { label: 'Gates', href: '/dashboard/gate/gates', accessModule: 'GATE_CONSOLE' },
              { label: 'My Preferences', href: '/dashboard/gate/preferences' },
            ],
          },
          {
            label: 'Staff',
            opsModule: 'STAFF',
            accessModule: 'STAFF_VIEW',
            children: [
              { label: 'The Roll', href: '/dashboard/staff' },
              { label: 'Who Covers What', href: '/dashboard/staff/coverage' },
            ],
          },
          {
            label: 'Complaints',
            href: '/dashboard/complaints',
            opsModule: 'COMPLAINTS',
            // COMPLAINTS_OWN, not COMPLAINTS_MANAGE: a technician who only ever sees
            // their own queue still needs the link. The page itself asks the server
            // what to show, so a manager and a plumber land on the same href and
            // get different lists.
            accessModule: 'COMPLAINTS_OWN',
          },
          {
            label: 'Complaint Categories',
            href: '/dashboard/complaints/categories',
            opsModule: 'COMPLAINTS',
            accessModule: 'COMPLAINTS_MANAGE',
          },
          {
            label: 'Equipment',
            href: '/dashboard/assets',
            // `ASSETS` also names a FINANCE module (fixed assets in the balance
            // sheet). They are different fields read by different filters, so
            // there is no collision at runtime — but the two are genuinely
            // different things and the shared word has confused every reader of
            // this file so far. See the Fixed Assets entry below.
            opsModule: 'ASSETS',
            accessModule: 'COMPLAINTS_MANAGE',
          },
          /**
           * Operations Settings carries NO `opsModule`, and that is
           * load-bearing rather than an oversight.
           *
           * This is where the modules themselves are switched on and off. Gate
           * it on any of them and an admin who turns the gate off has locked
           * the only door back in: the screen that could undo it is the screen
           * that just vanished. Its group carries no `opsModule` either, for
           * the same reason — a society with every operations module off must
           * still see Operations, containing exactly this one link.
           */
          // Gate + complaints figures over a period. `GET /gate/report` existed
          // from the start with no screen calling it.
          { label: 'How Things Went', href: '/dashboard/operations/report', accessModule: 'GATE_LOGS' },
          { label: 'Operations Settings', href: '/dashboard/gate/settings', accessModule: 'OPS_SETTINGS' },
        ],
      },
      {
        label: 'Finance',
        icon: <Landmark className="w-5 h-5" />,
        children: [
          {
            label: 'Day to Day',
            children: [
              // The unmarked ones are the core a society cannot bill without —
              // they are never hidden.
              { label: 'Overview', href: '/dashboard/finance/overview' },
              { label: 'Invoices', href: '/dashboard/finance/invoices' },
              { label: 'Collections', href: '/dashboard/finance/collections' },
              { label: 'Confirmations', href: '/dashboard/finance/confirmations', badgeKey: 'financePendingConfirmations' },
              { label: 'Defaulter Notices', href: '/dashboard/finance/notices', financeModule: 'NOTICES' },
              { label: 'Post-dated Cheques', href: '/dashboard/finance/pdc', financeModule: 'PDC' },
              { label: 'Refunds', href: '/dashboard/finance/refunds', financeModule: 'REFUNDS' },
              // Bulk entry is a button ON the expenses page, not a sibling of it —
              // "record one" and "record twenty" are the same job at two sizes.
              { label: 'Expenses', href: '/dashboard/finance/expenses', financeModule: 'EXPENSES' },
              { label: 'Vendors', href: '/dashboard/finance/vendors', financeModule: 'EXPENSES' },
            ],
          },
          {
            label: 'Reports & Registers',
            children: [
              { label: 'Reports', href: '/dashboard/finance/reports' },
              { label: 'Budget', href: '/dashboard/finance/budget', financeModule: 'BUDGET' },
              { label: 'Members & Shares', href: '/dashboard/finance/shares', financeModule: 'SHARES' },
              // The society's own building, lifts and generators as accounting
              // entries — depreciated, shown on the balance sheet. NOT the same
              // as Operations → Equipment, which is the maintenance record for
              // the very same lift. One answers the auditor, the other answers
              // the resident stuck between floors.
              { label: 'Fixed Assets', href: '/dashboard/finance/assets', financeModule: 'ASSETS' },
              { label: 'Fixed Deposits', href: '/dashboard/finance/investments', financeModule: 'INVESTMENTS' },
            ],
          },
          {
            label: 'Setup',
            children: [
              // ONE entry for everything a society says once: its opening position,
              // its imported data, and the manual voucher for a treasurer who wants
              // it. This used to be three separate links, and nobody could tell
              // which of them they were supposed to be in.
              //
              // Deliberately NOT gated on a financeModule: it must stay reachable
              // when every other finance screen is locked, because it is where a
              // society lands when it cannot record anything yet.
              { label: 'Setup & Opening Balances', href: '/dashboard/finance/setup' },
              { label: 'Charge Heads', href: '/dashboard/finance/charge-heads' },
              { label: 'Funds', href: '/dashboard/finance/funds', financeModule: 'FUNDS' },
              { label: 'Chart of Accounts', href: '/dashboard/finance/chart-of-accounts', financeModule: 'ACCOUNTING' },
              { label: 'Vouchers & Journal', href: '/dashboard/finance/journal', financeModule: 'ACCOUNTING' },
              { label: 'Bank Reconciliation', href: '/dashboard/finance/bank-reconciliation', financeModule: 'BANKING' },
              { label: 'Settlement', href: '/dashboard/finance/settlement' },
              { label: 'Settings', href: '/dashboard/finance/settings' },
            ],
          },
        ],
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
        label: 'Society',
        icon: <Landmark className="w-5 h-5" />,
        children: [
          { label: 'Committee', href: '/dashboard/committee', accessModule: 'COMMITTEE_MANAGE' },
          { label: 'Who Can Do What', href: '/dashboard/access-roles', accessModule: 'ACCESS_MANAGE' },
          // No accessModule: the page decides what each visitor may do, and a
          // displaced admin has to be able to reach it in order to object.
          { label: 'Admin Handover', href: '/dashboard/settings/admin-transfer' },
          { label: 'Billing & Subscription', href: '/dashboard/billing' },
        ],
      },
      {
        label: 'Notifications',
        icon: <Bell className="w-5 h-5" />,
        href: '/dashboard/notifications',
      },
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
        label: 'Requests',
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
          // Worded as a resident would say them, not as the module names them.
          { label: 'Someone at the Gate', href: '/dashboard/gate/approvals' },
          { label: 'Invite Someone', href: '/dashboard/gate/passes' },
          { label: 'Who Came', href: '/dashboard/gate/log' },
          { label: 'My Preferences', href: '/dashboard/gate/preferences' },
        ],
      },
      {
        label: 'My Bills',
        icon: <DollarSign className="w-5 h-5" />,
        href: '/dashboard/finance/my-bills'
      },
      {
        label: 'Notifications',
        icon: <Bell className="w-5 h-5" />,
        href: '/dashboard/notifications',
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
