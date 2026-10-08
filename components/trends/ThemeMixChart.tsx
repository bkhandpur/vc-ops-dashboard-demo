"use client";

import { CHROME, fillFor } from "@/components/statistics/colors";
import { useColorMode } from "@/components/theme/ThemeProvider";

import type { StackedPoint } from "@/lib/trends";

/**
 * Theme mix over time, as stacked bands.
 *
 * Colour here IS identity — each band is a `thesis_theme` — so it uses the validated
 * theme ramps at depth 0, exactly as the sunburst and bars do. A theme keeps its hue in
 * every view, which is the whole point of the rule in colors.ts.
 *
 * Shares are drawn rather than counts, because the question is "is the mix drifting?",
 * and a stacked count chart answers "is the pipeline growing?" instead — which the line
 * chart above it already answers better. The `to - from` share is normalised per point,
 * so the stack always fills the plot and drift is legible even as the total changes.
 *
 * A 2px surface-coloured gap separates adjacent bands, per the project's mark spec.
 */
export function ThemeMixChart({
  points,
  themes,
  height = 260,
}: {
  points: StackedPoint[];
  themes: string[];
  height?: number;
}) {
  const mode = useColorMode();
  if (points.length < 2) return null;

  /**
   * A wide viewBox (roughly 4.6:1) rather than the 3.6:1 the line charts use. This chart
   * spans the full content width, and at the narrower ratio it scaled to ~325px tall —
   * three enormous slabs that read as decoration rather than as a mix. The SVG scales to
   * its container, so the ratio here *is* the rendered height.
   */
  const width = 1200;
  const padding = { top: 12, right: 12, bottom: 26, left: 44 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const x = (i: number) => padding.left + (i / (points.length - 1)) * plotW;
  const y = (share: number) => padding.top + plotH - share * plotH;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`Theme mix over time: ${themes.join(", ")}`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(t)}
              y2={y(t)}
              stroke={CHROME.gridline}
              strokeWidth={1}
            />
            <text
              x={padding.left - 8}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill={CHROME.inkMuted}
            >
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}

        {themes.map((theme) => {
          // Build the band as a closed polygon: along the top edge, back along the bottom.
          const top: string[] = [];
          const bottom: string[] = [];
          let seen = false;

          points.forEach((point, i) => {
            const band = point.bands.find((b) => b.theme === theme);
            if (!band) return;
            seen = true;
            top.push(`${x(i).toFixed(1)} ${y(band.to).toFixed(1)}`);
            bottom.unshift(`${x(i).toFixed(1)} ${y(band.from).toFixed(1)}`);
          });

          if (!seen || top.length < 2) return null;

          return (
            <path
              key={theme}
              d={`M ${top.join(" L ")} L ${bottom.join(" L ")} Z`}
              fill={fillFor(theme, 0, mode)}
              // The 2px surface gap between stacked segments, per the mark spec.
              stroke={CHROME.surface}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          );
        })}

        <text x={padding.left} y={height - 6} fontSize={10} fill={CHROME.inkMuted}>
          {shortDate(points[0]?.at)}
        </text>
        <text
          x={width - padding.right}
          y={height - 6}
          textAnchor="end"
          fontSize={10}
          fill={CHROME.inkMuted}
        >
          {shortDate(points[points.length - 1]?.at)}
        </text>
      </svg>

      {/* Legend is always present for ≥2 series — identity is never colour-alone. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {themes.map((theme) => {
          const latest = points[points.length - 1]?.bands.find((b) => b.theme === theme);
          return (
            <span key={theme} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
              <span
                aria-hidden
                className="inline-block size-2.5 rounded-[2px]"
                style={{ backgroundColor: fillFor(theme, 0, mode) }}
              />
              {theme}
              {latest && (
                <span className="ws-nums text-ink-subtle">
                  {Math.round((latest.to - latest.from) * 100)}%
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function shortDate(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}
