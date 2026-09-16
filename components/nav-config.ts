/**
 * ── THE SIDEBAR IS CONFIGURED HERE ───────────────────────────────────────────
 * Add a sidebar item by appending to NAV_GROUPS. Nothing else needs touching:
 * Sidebar.tsx renders whatever is in this array.
 *
 *   kind: "route"  → a normal page link (create app/<route>/page.tsx)
 *   kind: "action" → not a page; triggers app-level UI (search, command palette)
 *
 * Phase 2 took this from four flat items to eleven, which is past the point where a flat
 * list is scannable — hence the grouping. The groups are by *what you are doing*, not by
 * which CRM object the data comes from, because nobody opens a dashboard thinking "I
 * would like to look at the people object today".
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  Activity,
  BarChart2,
  FileStack,
  FileText,
  Grid3x3,
  Handshake,
  Rocket,
  ScanSearch,
  HeartPulse,
  HelpCircle,
  Send,
  TrendingUp,
  UserSearch,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface NavRouteItem {
  kind: "route";
  label: string;
  icon: LucideIcon;
  route: string;
}

export interface NavActionItem {
  kind: "action";
  label: string;
  icon: LucideIcon;
  action: "open-command-palette";
  /** Rendered as a keyboard hint on the right of the row. */
  shortcut?: string;
}

export type NavItem = NavRouteItem | NavActionItem;

export interface NavGroup {
  /** null renders the items with no heading (used for the actions at the bottom). */
  label: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Analyze",
    items: [
      { kind: "route", label: "Statistics", icon: BarChart2, route: "/statistics" },
      { kind: "route", label: "Trends", icon: TrendingUp, route: "/trends" },
      { kind: "route", label: "Momentum", icon: Activity, route: "/momentum" },
      { kind: "route", label: "Data Health", icon: HeartPulse, route: "/data-health" },
      {
        kind: "route",
        label: "Investor Cross-Check",
        icon: ScanSearch,
        route: "/data-health/cross-check",
      },
    ],
  },
  {
    label: "Explore",
    items: [
      { kind: "route", label: "Portfolio", icon: Grid3x3, route: "/portfolio" },
      { kind: "route", label: "Tear Sheets", icon: FileStack, route: "/tear-sheets" },
      { kind: "route", label: "Stealth Founders", icon: UserSearch, route: "/founders" },
      { kind: "route", label: "Outreach Queue", icon: Send, route: "/founders/queue" },
      { kind: "route", label: "Launch Signals", icon: Rocket, route: "/founders/launches" },
      { kind: "route", label: "Co-Investors", icon: Users, route: "/co-investors" },
      { kind: "route", label: "Matchmaking", icon: Handshake, route: "/co-investors/match" },
    ],
  },
  {
    label: "Operate",
    items: [
      { kind: "route", label: "Weekly Digest", icon: FileText, route: "/digest" },
      { kind: "route", label: "Help", icon: HelpCircle, route: "/help" },
    ],
  },
  {
    label: null,
    items: [
      /**
       * The "Search" entry that used to sit here was removed during the UX audit.
       *
       * It opened the exact same overlay as the search box in the top bar, so the app
       * had two controls doing one thing — and the usability pass flagged it as
       * genuinely confusing rather than merely redundant. The top bar is the better
       * home (it is where a search box is expected) and ⌘/ still works from anywhere,
       * so the duplicate simply goes. The read/write split it was part of is unchanged:
       * ⌘/ reads, ⌘K writes, and only the palette carries the Plus badge.
       */
      {
        kind: "action",
        label: "Command Palette",
        icon: Zap,
        action: "open-command-palette",
        shortcut: "⌘K",
      },
    ],
  },
];

/** Flat list, for anything that just needs every route (e.g. active-state matching). */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

const ROUTES_BY_SPECIFICITY = NAV_ITEMS.filter(
  (item): item is NavRouteItem => item.kind === "route",
)
  .map((item) => item.route)
  .sort((a, b) => b.length - a.length);

/** Resolve one active navigation item. Nested pages must not also light their parent. */
export function activeRoute(pathname: string | null): string | null {
  if (!pathname) return null;
  return (
    ROUTES_BY_SPECIFICITY.find(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    ) ?? null
  );
}
