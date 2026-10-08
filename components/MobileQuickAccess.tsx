"use client";

import { FileText, Search, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCommandPalette } from "./command-palette/CommandPaletteProvider";
import { useGlobalSearch } from "./search/SearchProvider";
import { useSidebar } from "./SidebarState";

/**
 * The three things a partner opening this on a phone actually wants.
 *
 * ── WHY THIS EXISTS, AND WHY IT ADDS NOTHING NEW ─────────────────────────────
 * Below 640px the sidebar is behind a hamburger, so the first thing on screen is
 * whatever page you landed on — most likely the Statistics radial chart, which is the
 * least useful thing on a 380px screen and the slowest to read.
 *
 * Someone opening this on a phone is almost always doing one of three things minutes
 * before a call: looking a company up, pulling its quick summary, or checking what
 * moved this week. So those three get first billing on a narrow screen.
 *
 * Nothing is removed. These cards use the existing search, summary and digest routes. The
 * full page set stays one hamburger tap away. This is purely about what is above the
 * fold when the viewport is small.
 *
 * Renders only in the "overlay" layout (<640px) and never on the digest page itself,
 * where the third card would point at the page you are already reading.
 */
export function MobileQuickAccess() {
  const { layout } = useSidebar();
  const { openSearch } = useGlobalSearch();
  const { openPalette } = useCommandPalette();
  const pathname = usePathname();

  if (layout !== "overlay") return null;

  const tile =
    "flex flex-col items-start gap-1.5 rounded-[var(--radius-panel)] border border-line bg-surface p-3 text-left shadow-[var(--shadow-panel)] active:scale-[0.99] transition-transform duration-[var(--dur-quick)]";

  return (
    <div className="ws-enter mb-5 grid grid-cols-2 gap-2">
      <button type="button" onClick={openSearch} className={tile}>
        <Search className="size-4 text-accent" />
        <span className="text-[13px] font-medium text-ink">Search</span>
        <span className="text-[11px] text-ink-subtle">Companies, founders, investors</span>
      </button>

      <button type="button" onClick={openPalette} className={tile}>
        <Zap className="size-4 text-accent" />
        <span className="text-[13px] font-medium text-ink">Quick summary</span>
        <span className="text-[11px] text-ink-subtle">Call prep for one company</span>
      </button>

      {pathname !== "/digest" && (
        <Link href="/digest" className={`${tile} col-span-2`}>
          <FileText className="size-4 text-accent" />
          <span className="text-[13px] font-medium text-ink">This week&rsquo;s digest</span>
          <span className="text-[11px] text-ink-subtle">Illustrative history and sample edits</span>
        </Link>
      )}
    </div>
  );
}
