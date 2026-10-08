"use client";

import { useId, useState } from "react";

import { CHROME } from "@/components/statistics/colors";

import type { LineSeries } from "@/lib/trends";

/**
 * A small multi-line chart, hand-written SVG like every other chart in this app.
 *
 * Follows the project's chart rules: one y-axis only (never a dual axis), recessive
 * gridlines, thin 2px strokes, ≥8px markers, a legend whenever there is more than one
 * series, and direct labels on the last point so identity is never colour-alone.
 *
 * ── ON COLOUR ────────────────────────────────────────────────────────────────
 * These lines are NOT themes, so they must not borrow the theme ramps — hue means theme
 * and nothing else in this codebase. Pipeline and Portfolio are two ends of one process,
 * so they are drawn as two steps of the UI accent instead: same hue, different lightness
 * and different dash. That keeps identity readable without minting a new categorical
 * scale that was never validated.
 */
export function LineChart({
  series,
  height = 200,
  /** Formats the y value in the tooltip and axis. */
  format = (v: number) => v.toLocaleString("en-US"),
  /** Fix the y-axis to 0–100 for percentage charts. */
  percentage = false,
}: {
  series: LineSeries[];
  height?: number;
  format?: (value: number) => string;
  percentage?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const points = series[0]?.values.length ?? 0;
  if (points === 0) return null;

  const width = 720;
  const padding = { top: 12, right: 56, bottom: 26, left: 44 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const allValues = series.flatMap((s) => s.values.map((v) => v.value));
  const rawMax = Math.max(...allValues, 0);
  const max = percentage ? 100 : niceCeiling(rawMax);
  const min = 0;

  // A single point cannot describe a slope; the caller shows an empty state instead,
  // but guard the divide anyway.
  const x = (i: number) => padding.left + (points === 1 ? plotW / 2 : (i / (points - 1)) * plotW);
  const y = (v: number) => padding.top + plotH - ((v - min) / (max - min || 1)) * plotH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`Trend chart: ${series.map((s) => s.label).join(", ")}`}
        onMouseLeave={() => setHover(null)}
      >
        {/* Recessive gridlines. */}
        {ticks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={CHROME.gridline}
              strokeWidth={1}
            />
            <text
              x={padding.left - 8}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill={CHROME.inkMuted}
            >
              {percentage ? `${Math.round(tick)}%` : compact(tick)}
            </text>
          </g>
        ))}

        {series.map((line, seriesIndex) => {
          const stroke = seriesIndex === 0 ? "var(--color-accent)" : CHROME.inkSecondary;
          const d = line.values
            .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v.value).toFixed(1)}`)
            .join(" ");
          const last = line.values[line.values.length - 1];

          return (
            <g key={line.label}>
              <path
                d={d}
                fill="none"
                stroke={stroke}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={seriesIndex === 0 ? undefined : "5 4"}
              />
              {line.values.map((v, i) => (
                <circle
                  key={i}
                  cx={x(i)}
                  cy={y(v.value)}
                  r={hover === i ? 5 : 3.5}
                  fill={stroke}
                  stroke={CHROME.surface}
                  strokeWidth={2}
                />
              ))}
              {/* Direct label on the last point — identity without reading the legend. */}
              {last && (
                <text
                  x={width - padding.right + 8}
                  y={y(last.value)}
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill={CHROME.ink}
                >
                  {format(last.value)}
                </text>
              )}
            </g>
          );
        })}

        {/* Hover columns: full-height hit targets, far bigger than the 3.5px markers. */}
        {series[0]?.values.map((v, i) => (
          <rect
            key={i}
            x={x(i) - plotW / Math.max(points - 1, 1) / 2}
            y={padding.top}
            width={plotW / Math.max(points - 1, 1)}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}

        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={padding.top}
            y2={padding.top + plotH}
            stroke={CHROME.axis}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}

        {/* First and last date only — a label per point collides at eight weeks. */}
        <text x={padding.left} y={height - 6} fontSize={10} fill={CHROME.inkMuted}>
          {shortDate(series[0]?.values[0]?.at)}
        </text>
        <text
          x={width - padding.right}
          y={height - 6}
          textAnchor="end"
          fontSize={10}
          fill={CHROME.inkMuted}
        >
          {shortDate(series[0]?.values[points - 1]?.at)}
        </text>
      </svg>

      {hover !== null && (
        <div className="pointer-events-none absolute top-0 left-0 rounded-[var(--radius-control)] border border-line bg-surface-overlay px-2.5 py-1.5 text-[11px] shadow-[var(--shadow-raised)]">
          <p className="font-medium text-ink">{shortDate(series[0]?.values[hover]?.at)}</p>
          {series.map((line) => (
            <p key={line.label} className="ws-nums text-ink-muted">
              {line.label}:{" "}
              <strong className="text-ink">{format(line.values[hover]?.value ?? 0)}</strong>
            </p>
          ))}
        </div>
      )}

      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-4">
          {series.map((line, i) => (
            <span key={line.label} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
              <svg width={16} height={6} aria-hidden>
                <line
                  x1={0}
                  x2={16}
                  y1={3}
                  y2={3}
                  stroke={i === 0 ? "var(--color-accent)" : CHROME.inkSecondary}
                  strokeWidth={2}
                  strokeDasharray={i === 0 ? undefined : "5 4"}
                />
              </svg>
              {line.label}
            </span>
          ))}
        </div>
      )}
      <span className="sr-only" id={`chart-${uid}`} />
    </div>
  );
}

/** Round the axis top to something a human would choose. */
function niceCeiling(value: number): number {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

function compact(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  return Math.round(value).toString();
}

function shortDate(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
}
