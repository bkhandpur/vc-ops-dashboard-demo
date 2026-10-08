"use client";
import { escapeCsv } from "@/lib/csv";

import { ArrowDown, ArrowUp, Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AggregateResult, TableRow } from "@/lib/aggregate";
import { Button, Segmented, cx } from "../ui";

type SortKey = "theme" | "canonicalSector" | "subSector" | "companies" | "pctOfTotal";

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "theme", label: "Theme" },
  { key: "canonicalSector", label: "Canonical Sector" },
  { key: "subSector", label: "Sub-Sector" },
  { key: "companies", label: "# Companies", numeric: true },
  { key: "pctOfTotal", label: "% of total", numeric: true },
];

type Density = "compact" | "full";

export function StatsTable({ result }: { result: AggregateResult }) {
  const [sortKey, setSortKey] = useState<SortKey>("companies");
  const [ascending, setAscending] = useState(false);
  const [density, setDensity] = useState<Density>("compact");

  const rows = useMemo(() => {
    const sorted = [...result.rows].sort((a, b) => compare(a, b, sortKey));
    return ascending ? sorted : sorted.reverse();
  }, [result.rows, sortKey, ascending]);

  /**
   * Compact mode drops round columns that are genuinely zero for EVERY row in scope.
   *
   * This is an honest reduction, not a layout trick: a hidden column contains no data at
   * all under the current filters, so nothing is being concealed. It is the difference
   * between "Series D is empty for this whole view" and "Series D is off-screen" — the
   * first is worth removing, the second would be hiding data. Switch to Full to see the
   * complete round set including the empty ones.
   */
  const visibleRounds = useMemo(() => {
    if (density === "full") return result.roundColumns;
    return result.roundColumns.filter((round) => rows.some((row) => (row.rounds[round] ?? 0) > 0));
  }, [density, result.roundColumns, rows]);

  const hiddenRoundCount = result.roundColumns.length - visibleRounds.length;

  // ── Scroll affordance ────────────────────────────────────────────────────
  // A plain overflow-x container gives no hint that columns exist beyond the edge, which
  // is exactly how Series D went unnoticed. A scroll listener toggling two gradient
  // overlays is enough — no library, and it costs one passive listener.
  const scroller = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setEdges({
      left: el.scrollLeft > 2,
      right: maxScroll > 2 && el.scrollLeft < maxScroll - 2,
    });
  }, []);

  useEffect(() => {
    measure();
    const el = scroller.current;
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure, visibleRounds.length, rows.length]);

  function toggle(key: SortKey) {
    if (key === sortKey) {
      setAscending((a) => !a);
    } else {
      setSortKey(key);
      // Numeric columns are most useful largest-first.
      setAscending(key === "theme" || key === "canonicalSector" || key === "subSector");
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        {hiddenRoundCount > 0 && (
          <span className="mr-auto text-[11px] text-ink-subtle">
            {hiddenRoundCount} round {hiddenRoundCount === 1 ? "column is" : "columns are"} empty
            under these filters and hidden.
          </span>
        )}
        <Segmented<Density>
          ariaLabel="Table density"
          value={density}
          onChange={setDensity}
          options={[
            {
              value: "compact",
              label: "Compact",
              title: "Hide round columns that are empty for every row in scope",
            },
            {
              value: "full",
              label: "All rounds",
              title: "Show every round column, including empty ones",
            },
          ]}
        />
        <Button variant="secondary" onClick={() => downloadCsv(rows, result, visibleRounds)}>
          <Download className="size-3.5" />
          Export CSV
        </Button>
      </div>

      <div className="relative">
        {/* Edge fades. pointer-events-none so they can never swallow a click on a cell.
            They sit above the sticky column's own z-index deliberately on the right only;
            on the left the sticky column IS the affordance. */}
        <div
          aria-hidden
          className={cx(
            "pointer-events-none absolute inset-y-0 right-0 z-20 w-10 bg-gradient-to-l from-surface to-transparent transition-opacity duration-[var(--dur-quick)]",
            edges.right ? "opacity-100" : "opacity-0",
          )}
        />
        <div ref={scroller} className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-left">
                {COLUMNS.map((column, columnIndex) => (
                  <th
                    key={column.key}
                    className={cx(
                      "px-3 py-2 font-medium text-ink-muted",
                      column.numeric && "text-right",
                      // The label column stays put so a horizontally scrolled row never
                      // loses the thing that identifies it.
                      columnIndex === 0 &&
                        "sticky left-0 z-30 bg-surface after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-line-strong",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(column.key)}
                      className={`inline-flex items-center gap-1 hover:text-ink ${
                        column.numeric ? "flex-row-reverse" : ""
                      }`}
                    >
                      {column.label}
                      {sortKey === column.key &&
                        (ascending ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        ))}
                    </button>
                  </th>
                ))}
                {visibleRounds.map((round) => (
                  <th
                    key={round}
                    className="px-2 py-2 text-right font-medium whitespace-nowrap text-ink-subtle"
                  >
                    {round}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={COLUMNS.length + visibleRounds.length}
                    className="px-3 py-8 text-center text-ink-subtle"
                  >
                    No companies match the current filters.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr
                  key={`${row.theme}|${row.canonicalSector}|${row.subSector}`}
                  className="group border-b border-line/60 hover:bg-surface-sunken"
                >
                  {/* Solid background is load-bearing: a transparent sticky cell lets the
                    scrolled columns slide visibly underneath the label. It has to track
                    the row hover too, or the frozen cell stays pale while its row
                    highlights. Both surface tokens are mode-aware, so this is correct in
                    dark mode without a second rule. */}
                  <td className="sticky left-0 z-10 bg-surface px-3 py-1.5 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-line-strong group-hover:bg-surface-sunken">
                    {row.theme}
                  </td>
                  <td className="px-3 py-1.5">{row.canonicalSector}</td>
                  <td className="px-3 py-1.5">{row.subSector}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{row.companies}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-ink-muted">
                    {row.pctOfTotal.toFixed(1)}%
                  </td>
                  {visibleRounds.map((round) => (
                    <td key={round} className="px-2 py-1.5 text-right tabular-nums text-ink-muted">
                      {row.rounds[round] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-ink-subtle">
        Sub-Sector is a multiselect, so a company with several sub-sectors appears in one row per
        sub-sector. The “# Companies” column can therefore sum above the {result.total} distinct
        companies in scope. “% of total” is measured against that distinct count. Companies with no
        value fall into “Unclassified”; rounds with no value fall into “Unknown”.
      </p>
    </div>
  );
}

/**
 * Export exactly what is on screen: current sort, current filters and the same columns, so a
 * number quoted from the CSV always matches the number someone saw in the UI.
 */
function downloadCsv(
  rows: TableRow[],
  result: AggregateResult,
  // Passed in so the export matches the columns currently on screen.
  roundColumns: string[],
): void {
  const header = [
    "Theme",
    "Canonical Sector",
    "Sub-Sector",
    "Companies",
    "% of total",
    ...roundColumns,
  ];

  const body = rows.map((row) => [
    row.theme,
    row.canonicalSector,
    row.subSector,
    String(row.companies),
    row.pctOfTotal.toFixed(1),
    ...roundColumns.map((round) => String(row.rounds[round] ?? 0)),
  ]);

  const csv = [header, ...body].map((cells) => cells.map(escapeCsv).join(",")).join("\r\n");

  const stamp = new Date().toISOString().slice(0, 10);
  const stages = result.stagesIncluded.join("-") || "none";
  triggerDownload(
    new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }),
    `vc-ops-taxonomy-${stages}-${stamp}.csv`,
  );
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function compare(a: TableRow, b: TableRow, key: SortKey): number {
  const left = a[key];
  const right = b[key];
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right));
}
