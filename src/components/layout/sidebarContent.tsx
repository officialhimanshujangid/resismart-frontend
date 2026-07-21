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
  Bell,
  ClipboardList
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
  accessModule?: string | string[];
  /**
   * Hides this item unless the society has switched the operations module on.
   *
   * The operations twin of `financeModule`. Kept separate rather than merged
   * into one `module` field because the two lists are independent — a society
   * can run finance without a gate, or a gate without finance — and one field
   * holding both namespaces would make a typo in either silently hide a screen.
   */
  opsModule?: string;
  /**
   * Gate 4 — a `SocietyOpsPolicy.residentFeatures` key. Present only on
   * resident-facing links, and only consulted for residents.
   */
  residentFeature?: string;
  /**
   * Draws a hairline above this entry. Purely visual, and only honoured at the
   * top level.
   *
   * Used to fence the configuration groups off from the daily ones. A menu
   * that runs Overview → … → Settings as one unbroken column reads as a list of
   * equals, so people hunt through Operations looking for a setting that lives
   * at the bottom. One rule turns "eleven items" into "the work, then the
   * setup", which is how everybody already thinks about it.
   */
  separatorBefore?: boolean;
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
    const next = link.children ? { ...link, children: filterLinksByFinanceModules(link.children, enabled) } : link;
    // Same rule the access filter has always had: a group whose every child was
    // filtered away is a heading that opens onto nothing. It only started
    // mattering here once Settings moved out to its own group and stopped
    // propping the others up.
    if (next.children && next.children.length === 0 && !next.href) return acc;
    acc.push(next);
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
    const next = link.children ? { ...link, children: filterLinksByOpsModules(link.children, enabled) } : link;
    // See the note in the finance filter. A society with every operations module
    // switched off used to keep an Operations group alive because the settings
    // link lived inside it; that link is now in Settings, so without this an
    // empty "Operations" heading would sit in the menu doing nothing.
    if (next.children && next.children.length === 0 && !next.href) return acc;
    acc.push(next);
    return acc;
  }, []);

/**
 * Gate 4 — drop what this society does not offer its RESIDENTS.
 *
 * A separate axis from `accessModule` on purpose. Permissions answer "which of
 * the office may touch this"; this answers "does the society let residents do
 * this themselves at all", which is a question about the society's habits, not
 * about any individual. Plenty of societies want every visitor cleared at the
 * desk rather than by the flat, and had no way to say so.
 *
 * A missing key means yes: a society that has never opened the settings screen
 * gets the sensible defaults, not an empty menu.
 */
export const filterLinksByResidentFeature = (
  items: SidebarLink[],
  features: Record<string, boolean>,
): SidebarLink[] =>
  items.reduce<SidebarLink[]>((acc, link) => {
    if (link.residentFeature && features[link.residentFeature] === false) return acc;
    acc.push(link.children
      ? { ...link, children: filterLinksByResidentFeature(link.children, features) }
      : link);
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
    if (link.accessModule) {
      const modules = Array.isArray(link.accessModule) ? link.accessModule : [link.accessModule];
      if (!modules.some(m => (permissions[m] ?? 'NONE') !== 'NONE')) return acc;
    }
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

  // ResiSmart's own staff.
  //
  // Ordered by what the job actually is: the two books of customers first
  // (Societies, Shops), then the listings business, then the internal org
  // chart, then setup. Team Management used to sit at the top — above every
  // customer — which put the least-visited screen in the most valuable slot.
  //
  // `moduleKey` values are deliberately untouched by the reshuffle: the
  // Permission Roles screen derives its whole grid from this tree, and every
  // saved PermissionRole document stores those keys. Reordering is free;
  // renaming a key would silently orphan a role somebody already configured.
  if (role.startsWith('SYSTEM_')) {
    const rawLinks: SidebarLink[] = [
      ...defaultLinks,
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
      teamManagementMenu,
      {
        /**
         * Everything an owner sets once, in the one place they will look for it.
         *
         * Society Settings and Shop Settings used to hang off the bottom of the
         * Societies and Shops groups respectively — two entries called
         * "…Settings" in two different places, both landing on the SAME page
         * (`/dashboard/settings`) with only a `?scope=` to tell them apart.
         * Nobody found them, and the pair that did read as duplicates.
         *
         * Marketplace settings deliberately did NOT move here: it is the one
         * settings screen a SYSTEM_EMPLOYEE can hold (`marketplace_settings`),
         * and hoisting it into an owner-only group would both hide it from them
         * and drop its key out of the Permission Roles grid.
         */
        label: 'Settings',
        icon: <Settings className="w-5 h-5" />,
        moduleKey: 'settings_general',
        permittedUserType: ['SYSTEM_OWNER'],
        separatorBefore: true,
        children: [
          { label: 'Society Settings', href: '/dashboard/settings?scope=society', permittedUserType: ['SYSTEM_OWNER'] },
          { label: 'Shop Settings', href: '/dashboard/settings?scope=shop', permittedUserType: ['SYSTEM_OWNER'] },
          { label: 'System Invoices', href: '/owner/invoices', moduleKey: 'billing_invoices', permittedUserType: ['SYSTEM_OWNER'] },
        ],
      },
    ];
    return filterLinksByUserType(rawLinks, role);
  }

  // Society Admin Links
  //
  // Grouped, because the flat version had forty-nine entries at one level and
  // twenty-two of them were Finance. Nothing was gained by the flatness: a
  // person hunting for Charge Heads scrolled past Bank Reconciliation either
  // way. Grouping costs one click and makes the menu readable at a glance.
  //
  // ORDERED BY HOW OFTEN A SOCIETY TOUCHES IT, which is the only ordering a
  // reader can predict:
  //
  //   Overview → My Work → Operations → Finance → Residents & Flats →
  //   Housing → Notifications → ┄┄ → Settings
  //
  // Operations and Finance are the daily grind — the gate register, complaints,
  // this month's collections. Residents & Flats sits below them because a flat
  // is created once and read for years; it used to sit ABOVE both, so the two
  // screens an admin opens every morning were the two they had to scroll for.
  //
  // Everything configured once now lives in Settings at the bottom, behind a
  // rule. That group is assembled from what used to be six different places —
  // see the note on it below.
  if (role.startsWith('SOCIETY_')) {
    const rawLinks: SidebarLink[] = [
      ...defaultLinks,
      {
        /**
         * A staff member's own home, and the FIRST thing they see.
         *
         * Note what is missing: no `accessModule`. A watchman holds no staff
         * permission at all — the seeded "Security guard" role gives him the
         * gate console and nothing else — so gating this behind `STAFF_VIEW`
         * would hide the one screen in the product that is about him, which is
         * exactly the state this replaces. He landed on `/dashboard`, got the
         * society-ADMIN dashboard (the branch is a bare `startsWith('SOCIETY_')`)
         * and read three billing panels that 403 into empty boxes.
         *
         * The page shows only his own record, resolved server-side from his own
         * login, so there is nothing here for a menu to leak.
         */
        label: 'My Work',
        href: '/dashboard/staff/my-work',
        icon: <ClipboardList className="w-5 h-5" />,
        opsModule: 'STAFF',
        permittedUserType: ['SOCIETY_EMPLOYEE'],
      },
      {
        label: 'Operations',
        icon: <DoorOpen className="w-5 h-5" />,
        children: [
          {
            // "Gate" named the PLACE rather than the job, and half the module
            // was already called visitor-something. The href, the `opsModule`
            // value and every permission below keep their old names on purpose:
            // those are DB enum values in live AccessRole documents.
            label: 'Visitor Management',
            opsModule: 'GATE',
            children: [
              // The console itself is the guard's whole world, so it comes first
              // and carries the permission a guard actually holds. "Gate Desk"
              // keeps the word "gate" because here it IS the physical post.
              { label: 'Gate Desk', href: '/dashboard/visitors/gate-desk', accessModule: 'GATE_CONSOLE' },
              // No accessModule: answering comes from having been asked, not from a
              // permission. A committee member with no gate rights still gets asked
              // about their own visitors.
              { label: 'Visitor Approvals', href: '/dashboard/visitors/approvals', permittedUserType: ['SOCIETY_ADMIN', 'SOCIETY_COMMITTEE'] },
              { label: 'Scan a Pass', href: '/dashboard/visitors/scan', accessModule: 'GATE_CONSOLE' },
              { label: 'Visitor Log', href: '/dashboard/visitors/log', accessModule: 'GATE_LOGS' },
              // Issuing is a resident's act, so this carries no permission — a
              // committee member inviting their own guest is not doing gate work.
              { label: 'Visitor Passes', href: '/dashboard/visitors/passes', permittedUserType: ['SOCIETY_ADMIN', 'SOCIETY_COMMITTEE'] },
              { label: 'Resident Vehicles', href: '/dashboard/visitors/vehicles', accessModule: 'GATE_CONSOLE' },
              { label: 'Not Allowed Inside', href: '/dashboard/visitors/blocklist', accessModule: 'GATE_CONSOLE' },
              { label: 'Gates', href: '/dashboard/visitors/gates', accessModule: 'GATE_CONSOLE' },
              { label: 'My Gate Settings', href: '/dashboard/visitors/preferences', permittedUserType: ['SOCIETY_ADMIN', 'SOCIETY_COMMITTEE'] },
            ],
          },
          {
            // Complaints and its categories used to be two siblings at this
            // level, so "Complaint Categories" — a screen touched once a year —
            // sat in the menu with exactly as much weight as the queue itself.
            // Nested, the daily screen leads and the setup follows it.
            label: 'Complaints',
            opsModule: 'COMPLAINTS',
            // COMPLAINTS_OWN or COMPLAINTS_MANAGE: a technician who only ever sees
            // their own queue still needs the link, but so does a manager who only oversees.
            // The page itself asks the server what to show.
            accessModule: ['COMPLAINTS_OWN', 'COMPLAINTS_MANAGE'],
            children: [
              { label: 'All Complaints', href: '/dashboard/complaints' },
              { label: 'Categories', href: '/dashboard/complaints/categories', accessModule: 'COMPLAINTS_MANAGE' },
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
            // Off until a society asks for it — unlike the others, a parking map
            // means nothing until somebody has drawn the bays. The settings page
            // is where they are created, so it stays reachable through
            // Operations Settings even before the module is switched on.
            label: 'Parking',
            opsModule: 'PARKING',
            accessModule: ['PARKING_VIEW', 'PARKING_MANAGE'],
            children: [
              { label: 'Parking Map', href: '/dashboard/parking' },
              { label: 'Who Parks Where', href: '/dashboard/parking/allocations' },
              { label: 'Requests', href: '/dashboard/parking/requests' },
            ],
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
          // Gate + complaints figures over a period. `GET /gate/report` existed
          // from the start with no screen calling it.
          { label: 'How Things Went', href: '/dashboard/operations/report', accessModule: 'GATE_LOGS' },
        ],
      },
      {
        label: 'Finance',
        icon: <Landmark className="w-5 h-5" />,
        accessModule: 'FINANCE_VIEW',
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
            ],
          },
        ],
      },
      {
        // Was "Property", which named the asset class rather than the job. An
        // admin opening this is nearly always looking for a PERSON — who lives
        // in 402, who is asking to move in — and the flat is how they find
        // them. Naming the people first matches what they came for.
        label: 'Residents & Flats',
        icon: <Building className="w-5 h-5" />,
        accessModule: 'RESIDENTS_VIEW',
        children: [
          { label: 'Flats', href: '/dashboard/flats' },
          // "Approvals" plain was one of two entries by that name — this one is
          // residents asking to join a flat, the other is a visitor at the gate.
          // Two unrelated jobs sharing a word is how a menu stops being read.
          // Promoted above Blocks: it is the only entry here that goes stale.
          { label: 'Resident Requests', href: '/dashboard/approvals' },
          { label: 'Blocks', href: '/dashboard/blocks' },
          { label: 'Flat Sizes', href: '/dashboard/flat-sizes' },
        ],
      },
      {
        label: 'Resismart Housing',
        icon: <Megaphone className="w-5 h-5" />,
        permittedUserType: ['SOCIETY_ADMIN', 'SOCIETY_COMMITTEE'],
        children: [
          { label: 'Browse', href: '/dashboard/marketplace/browse' },
          { label: 'My Listings', href: '/dashboard/marketplace' },
          { label: 'Leads', href: '/dashboard/marketplace/leads' },
          { label: 'Saved', href: '/dashboard/marketplace/saved' },
        ],
      },
      {
        label: 'Notifications',
        icon: <Bell className="w-5 h-5" />,
        href: '/dashboard/notifications',
      },
      {
        /**
         * Every "set this once" screen, in one place, below a rule.
         *
         * Assembled from SIX different homes. Before this, an admin asking a
         * question as ordinary as "where do I turn parking on" had to know that:
         *
         *   - who's on the committee            lived under Society
         *   - who may touch what                lived under Society
         *   - which ops modules are on          lived under Operations
         *   - which finance modules are on      lived under Finance → Setup,
         *                                       as a link called just "Settings"
         *   - the parking bay setup             lived NOWHERE — reachable only
         *                                       by a button on another page
         *   - what the plan allows              lived under Society, named
         *                                       "What Your Plan Includes"
         *
         * Two of those (`/dashboard/operations/modules`, `/dashboard/parking/settings`)
         * had no menu entry at all and were reachable only by clicking through
         * from a sibling screen — so a society that never opened the setup
         * wizard could not find them a second time.
         *
         * The group itself carries NO gate of any kind, and that is
         * load-bearing rather than an oversight. This is where the modules are
         * switched on and off; gate the group on any of them and an admin who
         * turns a module off has locked the only door back in. Each child
         * carries its own permission, and `filterLinksByAccess` drops the group
         * if every one of them is filtered away.
         */
        label: 'Settings',
        icon: <Settings className="w-5 h-5" />,
        separatorBefore: true,
        children: [
          // --- the society itself
          { label: 'Committee', href: '/dashboard/committee', accessModule: 'COMMITTEE_MANAGE' },
          { label: 'Who Can Do What', href: '/dashboard/access-roles', accessModule: 'ACCESS_MANAGE' },
          // No accessModule: the page decides what each visitor may do, and a
          // displaced admin has to be able to reach it in order to object.
          { label: 'Admin Handover', href: '/dashboard/settings/admin-transfer', permittedUserType: ['SOCIETY_ADMIN', 'SOCIETY_COMMITTEE'] },

          // --- what the society uses
          // The switchboard. Was unreachable from the menu entirely.
          { label: 'What This Society Uses', href: '/dashboard/operations/modules', accessModule: 'OPS_SETTINGS' },
          // Kept at exactly this label and href: `verify-modules.ts` asserts
          // this line exists and is ungated, because it is the door back in.
          { label: 'Operations Settings', href: '/dashboard/visitors/settings', accessModule: 'OPS_SETTINGS' },
          // Renamed from a bare "Settings" — inside a group already called
          // Settings, that read as "Settings → Settings". The backend's
          // sidebar-contract check knows this label; see verify-modules.ts.
          { label: 'Finance Settings', href: '/dashboard/finance/settings', accessModule: 'FINANCE_VIEW' },
          /**
           * Where the bays are drawn — and it IS behind `opsModule: 'PARKING'`,
           * which looks like the trap described above but is the opposite.
           *
           * `opsModules` from `/me/entitlements` is already plan ∩ society, so
           * an untagged link here would show this screen to a society whose
           * PLAN never sold them parking. `accessModule` cannot save it: a
           * SOCIETY_ADMIN resolves to `ALL_FULL()`, so every permission tag is
           * a no-op for the very person most likely to click it. They would
           * open the bay editor and meet a 402 — precisely the failure
           * `entitlement.service.ts` was written to end.
           *
           * The door back in is not this link, it is "What This Society Uses"
           * above, which is ungated AND reads `plan.limits` itself — so it can
           * say "not part of your plan" instead of pretending. This entry is
           * only a shortcut for societies that already have parking running.
           */
          { label: 'Parking Setup', href: '/dashboard/parking/settings', opsModule: 'PARKING', accessModule: 'PARKING_MANAGE' },
          // Last, because it is what a NEW society needs and an established one
          // never opens again.
          { label: 'Setting Up', href: '/dashboard/operations/setup', accessModule: 'OPS_SETTINGS' },

          // --- the plan
          // The read-only "what your plan includes" panel. Without this line the
          // page existed and no society user could reach it — which is how an
          // admin discovers a limit at a 402 instead of on a screen that told
          // them beforehand.
          { label: 'What Your Plan Includes', href: '/dashboard/settings', permittedUserType: ['SOCIETY_ADMIN', 'SOCIETY_COMMITTEE'] },
          { label: 'Billing & Subscription', href: '/dashboard/billing', permittedUserType: ['SOCIETY_ADMIN', 'SOCIETY_COMMITTEE'] },
        ],
      },
    ];
    return filterLinksByUserType(rawLinks, role);
  }

  // Resident (flat owner / tenant / family) links
  //
  // Same principle as the society menu, with a resident's day substituted for
  // an admin's: the gate rings while they are at work, the bill arrives once a
  // month, and they ask to join a flat exactly once — so that is the order.
  // "Requests" used to sit third, directly under My Flat, which gave the
  // rarest screen in the resident's product the most prominent slot.
  if (role.startsWith('RESIDENT_') || role === 'FAMILY_MEMBER') {
    return [
      ...defaultLinks,
      {
        label: 'My Flat',
        icon: <Home className="w-5 h-5" />,
        href: '/dashboard/my-flat'
      },
      {
        label: 'Visitor Management',
        icon: <DoorOpen className="w-5 h-5" />,
        opsModule: 'GATE',
        children: [
          // Worded as a resident would say them, not as the module names them.
          // Each carries the switch its own screen is governed by, so a society
          // that clears visitors at the desk does not show residents an
          // approvals queue that will always be empty.
          { label: "Someone's Here", href: '/dashboard/visitors/approvals', residentFeature: 'visitorApprove' },
          { label: 'Invite Someone', href: '/dashboard/visitors/passes', residentFeature: 'visitorInvite' },
          { label: 'Who Came', href: '/dashboard/visitors/log', residentFeature: 'visitorHistory' },
          { label: 'My Gate Settings', href: '/dashboard/visitors/preferences', residentFeature: 'visitorPreferences' },
        ],
      },
      {
        label: 'My Bills',
        icon: <DollarSign className="w-5 h-5" />,
        href: '/dashboard/finance/my-bills'
      },
      {
        label: 'Complaints',
        icon: <MessageSquareWarning className="w-5 h-5" />,
        href: '/dashboard/complaints',
        opsModule: 'COMPLAINTS',
        residentFeature: 'complaintRaise',
        // No accessModule: a resident holds no AccessRole. The page shows them
        // their own flat's complaints and the community ones, and the server
        // decides that — not this menu.
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
        label: 'Notifications',
        icon: <Bell className="w-5 h-5" />,
        href: '/dashboard/notifications',
      },
      {
        // "Requests" alone read as an inbox of things asking for THEIR
        // attention. It is the opposite: requests they have made, to be let
        // into a flat. Named from the resident's side and moved to the bottom
        // with the other once-ever screens.
        label: 'My Requests',
        icon: <ShieldCheck className="w-5 h-5" />,
        href: '/dashboard/approvals',
        separatorBefore: true,
      },
    ];
  }

  // Shop Admin Links
  //
  // Only three entries, but the same rule applies for consistency's sake: the
  // configuration screen goes last, below the rule, so a shop owner moving
  // between this and a society context finds Settings in the same place.
  if (role.startsWith('SHOP_')) {
    return [
      ...defaultLinks,
      {
        label: 'Billing & Subscription',
        icon: <DollarSign className="w-5 h-5" />,
        href: '/dashboard/billing'
      },
      {
        label: 'Shop Settings',
        icon: <Settings className="w-5 h-5" />,
        href: '/dashboard/shop-settings',
        separatorBefore: true,
      },
    ];
  }

  return defaultLinks;
};
