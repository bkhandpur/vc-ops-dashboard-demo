"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import type { StatsNode } from "@/lib/aggregate";
import { fillFor } from "./colors";
import { useColorMode } from "../theme/ThemeProvider";
import { cx } from "../ui";

/**
 * Length-encoded view of the same numbers as the sunburst. Bars beat arcs for
 * "which of these is bigger" and they cope with long names like
 * "Chronic Disease Management", so this is the precise-comparison view.
 *
 * Hue = theme (same scale as the sunburst). Length = company count.
 */

const MAX_ROWS = 14;

export function ConcentrationBars({
  tree,
  path,
  onDrill,
}: {
  tree: StatsNode[];
  path: string[];
  onDrill: (path: string[]) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const mode = useColorMode();
  /**
   * Bars grow from zero once the level is on screen. Keyed on the drill path so changing
   * level re-runs it — the growth is what makes a level change read as a transition
   * rather than a swap. The final width is applied on the next frame, so the CSS
   * transition has something to animate from.
   */
  const [grown, setGrown] = useState(false);
  const pathKey = path.join("/");
  useEffect(() => {
    setGrown(false);
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, [pathKey]);

  const { level, themeOfLevel, walked } = resolveLevel(tree, path);
  const levelTotal = level.reduce((sum, n) => sum + n.value, 0);
  const max = level.reduce((m, n) => Math.max(m, n.value), 0);
  const shown = level.slice(0, MAX_ROWS);
  const hiddenCount = level.length - shown.length;
  // Sub-sector is a multiselect, so at that depth the numbers are tags, not companies.
  const showsSubSectors = walked.length >= 2;
  const canDrill = walked.length < 2;

  if (level.length === 0) {
    return (
      <div className="flex h-[380px] items-center justify-center text-[13px] text-ink-subtle">
        No companies match the current filters.
      </div>
    );
  }

  return (
    <div className="min-h-[380px]">
      <p className="mb-2 px-2 text-[11px] tracking-wide text-ink-subtle uppercase">
        {showsSubSectors
          ? "Sub-sector tags · a company with several sub-sectors counts in each"
          : "Distinct companies"}
      </p>

      <ul className="space-y-1">
        {shown.map((node, index) => {
          const theme = themeOfLevel ?? node.name;
          const drillable = canDrill && Boolean(node.children?.length);
          const isHovered = hovered === node.name;
          const pct = levelTotal === 0 ? 0 : (node.value / levelTotal) * 100;

          return (
            <li key={node.name}>
              <button
                type="button"
                disabled={!drillable}
                onMouseEnter={() => setHovered(node.name)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(node.name)}
                onBlur={() => setHovered(null)}
                onClick={() => drillable && onDrill([...path, node.name])}
                className={cx(
                  "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors",
                  drillable ? "cursor-pointer" : "cursor-default",
                  isHovered ? "bg-surface-sunken" : "bg-transparent",
                )}
              >
                <span
                  className="w-44 shrink-0 truncate text-[12.5px] text-ink"
                  title={node.name}
                >
                  {node.name}
                </span>

                <span className="relative h-3.5 min-w-0 flex-1">
                  <span
                    className="absolute inset-y-0 left-0 block"
                    style={{
                      width: grown && max > 0 ? `${(node.value / max) * 100}%` : "0%",
                      // Matches the sunburst: inner-ring levels use the base step,
                      // the sub-sector level uses the lighter one.
                      backgroundColor: fillFor(theme, showsSubSectors ? 1 : 0, mode),
                      // 4px rounded data-end, square at the baseline.
                      borderRadius: "0 4px 4px 0",
                      // Staggered, but capped: 14 rows must not become a 14-step queue.
                      transition: "width 420ms cubic-bezier(0.22, 1, 0.36, 1)",
                      transitionDelay: `${Math.min(index, 10) * 24}ms`,
                    }}
                  />
                </span>

                <span className="w-10 shrink-0 text-right text-[12.5px] tabular-nums text-ink">
                  {node.value}
                </span>
                <span className="w-11 shrink-0 text-right text-[11px] tabular-nums text-ink-subtle">
                  {pct < 1 ? pct.toFixed(1) : Math.round(pct)}%
                </span>
                <span className="w-3.5 shrink-0">
                  {drillable && (
                    <ChevronRight
                      className={cx(
                        "size-3.5 transition-colors",
                        isHovered ? "text-ink-muted" : "text-ink-subtle/50",
                      )}
                    />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {hiddenCount > 0 && (
        <p className="mt-3 px-2 text-[11px] text-ink-subtle">
          Showing the {MAX_ROWS} largest of {level.length}. The table below lists every
          row.
        </p>
      )}
    </div>
  );
}

/** Walk the drill path, tolerating a stale path after a filter change. */
export function resolveLevel(
  tree: StatsNode[],
  path: string[],
): { level: StatsNode[]; themeOfLevel: string | null; walked: string[] } {
  let level = tree;
  let themeOfLevel: string | null = null;
  const walked: string[] = [];

  for (const name of path) {
    const next = level.find((n) => n.name === name);
    if (!next?.children?.length) break;
    themeOfLevel ??= name;
    level = next.children;
    walked.push(name);
  }

  return { level, themeOfLevel, walked };
}
