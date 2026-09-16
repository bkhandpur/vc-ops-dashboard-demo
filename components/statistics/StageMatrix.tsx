"use client";

import { useState } from "react";

import { crossTabByStage, type StagedCompany } from "@/lib/aggregate";
import { STAGE_LABELS, type StageKey } from "@/lib/constants";
import { cx } from "../ui";
import { fillFor, heatFill, heatRamp, inkOn } from "./colors";
import { useColorMode } from "../theme/ThemeProvider";

/**
 * Current drill level × list membership. Answers the question the radial and bar views
 * structurally cannot: we source a lot of X — have we actually invested in it?
 *
 * Colour here is SEQUENTIAL (one hue, more-is-darker) because the cells encode
 * magnitude, not identity. Row identity still comes from the theme swatch beside the
 * label, so the theme hue keeps its meaning.
 *
 * Every cell prints its number, so nothing is gated behind hover.
 */
export function StageMatrix({
  companies,
  stages,
  path,
}: {
  companies: StagedCompany[];
  /** Selects both the scope and which columns exist. */
  stages: StageKey[];
  path: string[];
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const mode = useColorMode();
  const { rows, max, columnTotals, total } = crossTabByStage(companies, stages, path);

  if (rows.length === 0 || stages.length === 0) {
    return (
      <div className="flex h-[380px] items-center justify-center text-[13px] text-ink-subtle">
        {stages.length === 0
          ? "Select at least one stage to build the matrix."
          : "No companies match the current filters."}
      </div>
    );
  }

  const columns = (["pipeline", "portfolio", "archive"] as StageKey[]).filter((s) =>
    stages.includes(s),
  );

  return (
    <div className="min-h-[380px]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <caption className="mb-2 caption-top text-left text-[11px] tracking-wide text-ink-subtle uppercase">
            Distinct companies by {path.length === 0 ? "theme" : "canonical sector"} and list
          </caption>
          <thead>
            <tr>
              <th className="w-52 px-2 py-1.5 text-left font-medium text-ink-muted">
                {path.length === 0 ? "Theme" : "Canonical Sector"}
              </th>
              {columns.map((stage) => (
                <th
                  key={stage}
                  className="px-2 py-1.5 text-center font-medium whitespace-nowrap text-ink-muted"
                >
                  {STAGE_LABELS[stage]}
                </th>
              ))}
              <th className="px-2 py-1.5 text-right font-medium text-ink-muted">Distinct</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.name}
                onMouseEnter={() => setHovered(row.name)}
                onMouseLeave={() => setHovered(null)}
                className={cx(hovered === row.name && "bg-surface-sunken")}
              >
                <td className="px-2 py-1">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: fillFor(row.theme, 0, mode) }}
                    />
                    <span className="truncate text-ink" title={row.name}>
                      {row.name}
                    </span>
                  </span>
                </td>

                {columns.map((stage) => {
                  const value = row.countsByStage[stage];
                  const fill = heatFill(value, max, mode);
                  return (
                    <td key={stage} className="p-0.5">
                      <span
                        className="flex h-8 items-center justify-center rounded-md text-[12.5px] tabular-nums"
                        style={
                          fill
                            ? { backgroundColor: fill, color: inkOn(fill) }
                            : {
                                // Absence reads as empty surface, not as a pale value.
                                border: "1px solid var(--color-line)",
                                color: "var(--color-ink-subtle)",
                              }
                        }
                        title={`${row.name} · ${STAGE_LABELS[stage]}: ${value}`}
                      >
                        {value === 0 ? "—" : value}
                      </span>
                    </td>
                  );
                })}

                <td className="px-2 py-1 text-right font-medium tabular-nums text-ink">
                  {row.total}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line">
              <td className="px-2 py-1.5 text-[12px] text-ink-muted">All rows</td>
              {columns.map((stage) => (
                <td
                  key={stage}
                  className="px-2 py-1.5 text-center text-[12px] tabular-nums text-ink-muted"
                >
                  {columnTotals[stage]}
                </td>
              ))}
              <td className="px-2 py-1.5 text-right text-[12px] font-medium tabular-nums text-ink">
                {total}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-2">
          <span className="text-[11px] text-ink-subtle">Fewer</span>
          <span className="flex gap-0.5">
            {heatRamp(mode).map((step) => (
              <span
                key={step}
                aria-hidden
                className="size-3 rounded-sm"
                style={{ backgroundColor: step }}
              />
            ))}
          </span>
          <span className="text-[11px] text-ink-subtle">More (max {max})</span>
        </span>
        <span className="text-[11px] text-ink-subtle">
          A company can sit on two lists, so a row’s cells can sum above its distinct count.
        </span>
      </div>
    </div>
  );
}
