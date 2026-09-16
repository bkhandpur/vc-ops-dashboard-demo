"use client";

import { AlertCircle, Check, Menu, RefreshCw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { useGlobalSearch } from "./search/SearchProvider";
import { useSidebar } from "./SidebarState";
import { cx } from "./ui";
import { useAsyncAction } from "./useAsyncAction";

/**
 * A persistent bar above the page content, holding the two things that belong to the
 * whole app rather than to any one page: the search entry point, and the freshness of
 * the cached snapshot everything is reading.
 *
 * The refresh button moved here from the Statistics page. Every view reads the same
 * snapshot, so a "Refresh" that only appeared on one page implied it only refreshed
 * that page. One button, one snapshot, visible everywhere.
 *
 * This is the only search entry point in the app chrome. It also carries the mobile
 * navigation control and reports refresh completion through `useAsyncAction`.
 */
export function TopBar({ snapshotGeneratedAt }: { snapshotGeneratedAt: string | null }) {
  const { openSearch } = useGlobalSearch();
  const { layout, openOverlay } = useSidebar();
  const router = useRouter();

  const refresh = useAsyncAction(
    useCallback(async () => {
      const res = await fetch("/api/stats/refresh", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Refresh failed (${res.status})`);
      }
      // Re-render every server component with the new snapshot.
      router.refresh();
    }, [router]),
  );

  return (
    <header
      data-app-chrome
      className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-4 py-2 sm:gap-3 sm:px-6 lg:px-7"
    >
      {layout === "overlay" && (
        <button
          type="button"
          onClick={openOverlay}
          aria-label="Open navigation"
          className="shrink-0 rounded-[var(--radius-control)] border border-line bg-surface p-1.5 text-ink-muted hover:border-line-strong hover:text-ink"
        >
          <Menu className="size-4" />
        </button>
      )}

      <button
        type="button"
        onClick={openSearch}
        className="group flex min-w-0 max-w-[720px] flex-1 items-center gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2.5 py-1.5 text-left transition-colors duration-[var(--dur-quick)] hover:border-accent"
      >
        <Search className="size-3.5 shrink-0 text-ink-subtle" />
        <span className="flex-1 truncate text-[12px] text-ink-subtle">
          <span className="hidden sm:inline">Search companies, founders and co-investors</span>
          <span className="sm:hidden">Search</span>
        </span>
        <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-subtle sm:inline">
          ⌘/
        </kbd>
      </button>

      {/* Snapshot age is context, not an action — first thing to go on a narrow screen. */}
      <span className="ml-auto hidden shrink-0 text-[10px] text-ink-subtle lg:inline">
        {snapshotGeneratedAt ? (
          <>Snapshot {new Date(snapshotGeneratedAt).toLocaleString()}</>
        ) : (
          <>No snapshot yet</>
        )}
      </span>

      {refresh.status === "error" && (
        <span
          className="flex shrink-0 items-center gap-1 text-[11px] text-negative"
          title={refresh.error ?? undefined}
        >
          <AlertCircle className="size-3.5" />
          <span className="hidden max-w-[16rem] truncate md:inline">{refresh.error}</span>
        </span>
      )}

      <button
        type="button"
        onClick={() => void refresh.run()}
        disabled={refresh.busy}
        title="Rebuild the demo snapshot"
        className={cx(
          "flex shrink-0 items-center gap-1.5 rounded-[var(--radius-control)] border px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-[var(--dur-quick)] disabled:cursor-not-allowed disabled:opacity-60",
          refresh.status === "success"
            ? "border-positive/30 bg-positive/10 text-positive"
            : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
        )}
      >
        {refresh.status === "success" ? (
          <Check className="size-3.5" />
        ) : (
          <RefreshCw className={cx("size-3.5", refresh.busy && "animate-spin")} />
        )}
        <span className="hidden sm:inline">
          {refresh.status === "success"
            ? "Updated"
            : refresh.busy
              ? "Refreshing…"
              : "Refresh"}
        </span>
      </button>
    </header>
  );
}
