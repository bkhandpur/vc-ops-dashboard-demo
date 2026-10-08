"use client";

import { useMemo, useState } from "react";

import type { StatsNode } from "@/lib/aggregate";
import { CHROME, fillFor, inkOn } from "./colors";
import { useColorMode } from "../theme/ThemeProvider";
import {
  arcPath,
  buildArcs,
  CENTER,
  innerLabel,
  LABEL_FONT_PX,
  truncate,
  VIEW,
  wrap,
  type Arc,
} from "./sunburst-geometry";

/**
 * Radial view of the taxonomy: inner ring = the current level, outer ring = one
 * level down, sized by company count.
 *
 * Two rings, not three, on purpose — see the validation note in colors.ts: these
 * hues only support two lightness steps that both clear contrast, and ~80
 * sub-sector arcs on one circle would be unreadable anyway. Click a theme to make
 * its sectors the inner ring and its sub-sectors the outer one.
 *
 * Hue = theme, at both depths and under every filter. Angle = share of companies.
 */

export function Sunburst({
  tree,
  path,
  onDrill,
}: {
  tree: StatsNode[];
  /** [] = themes/sectors. [themeName] = that theme's sectors/sub-sectors. */
  path: string[];
  onDrill: (path: string[]) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const mode = useColorMode();

  const { arcs, levelTotal } = useMemo(() => buildArcs(tree, path), [tree, path]);

  const active = hovered ? (arcs.find((a) => a.key === hovered) ?? null) : null;

  if (arcs.length === 0) {
    return (
      <div className="flex h-[380px] items-center justify-center text-[13px] text-ink-subtle">
        No companies match the current filters.
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="ws-arc-in h-[380px] w-[380px] max-w-full overflow-visible"
        // Re-keying on the drill path replays the ease-in when you change level, which
        // makes the transition legible instead of an abrupt swap.
        key={path.join("/") || "root"}
        role="group"
        aria-label={`Company count by ${
          path.length === 0 ? "theme and canonical sector" : "canonical sector and sub-sector"
        }. Exact values are in the table below.`}
        onMouseLeave={() => setHovered(null)}
      >
        {/* The whole ring eases in once. Staggering 30+ arcs individually would read as
            a loading spinner rather than a chart. */}
        {arcs.map((arc) => {
          const fill = fillFor(arc.theme, arc.depth, mode);
          const isActive = active?.key === arc.key;
          const dimmed = active !== null && !isActive;
          return (
            <path
              key={arc.key}
              d={arcPath(arc)}
              fill={fill}
              // Emphasis ring in the surface colour, not a border for separation.
              stroke={isActive ? CHROME.surface : "none"}
              strokeWidth={isActive ? 2 : 0}
              opacity={dimmed ? 0.35 : 1}
              style={{
                cursor: arc.drillable ? "pointer" : "default",
                transition: "opacity 120ms ease-out",
              }}
              tabIndex={0}
              role={arc.drillable ? "button" : "img"}
              aria-label={`${arc.name}: ${arc.valueLabel}, ${arc.shareLabel}`}
              onMouseEnter={() => setHovered(arc.key)}
              onFocus={() => setHovered(arc.key)}
              onBlur={() => setHovered(null)}
              onClick={() => arc.drillable && onDrill([...path, arc.name])}
              onKeyDown={(event) => {
                if (arc.drillable && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onDrill([...path, arc.name]);
                }
              }}
            />
          );
        })}

        {/* Direct labels ride the inner ring only, where there is room for them. */}
        {arcs
          .filter((arc) => arc.depth === 0)
          .map((arc) => {
            const label = innerLabel(arc);
            if (!label) return null;
            return (
              <text
                key={`label-${arc.key}`}
                x={label.x}
                y={label.y}
                transform={`rotate(${label.rotation} ${label.x} ${label.y})`}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={LABEL_FONT_PX}
                fontWeight={500}
                fill={inkOn(fillFor(arc.theme, 0, mode))}
                pointerEvents="none"
              >
                {label.text}
              </text>
            );
          })}

        <CentreReadout active={active} total={levelTotal} path={path} />
      </svg>
    </div>
  );
}

/** The hole in the middle is the readout: hero total, or details of the hovered arc. */
function CentreReadout({
  active,
  total,
  path,
}: {
  active: Arc | null;
  /** Distinct companies in the current level — the hero number. */
  total: number;
  path: string[];
}) {
  if (!active) {
    return (
      <>
        <text
          x={CENTER}
          y={CENTER - 6}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={46}
          fontWeight={600}
          fill={CHROME.ink}
        >
          {total}
        </text>
        <text x={CENTER} y={CENTER + 24} textAnchor="middle" fontSize={12} fill={CHROME.inkMuted}>
          {total === 1 ? "company" : "companies"}
        </text>
        {path.length > 0 && (
          <text x={CENTER} y={CENTER + 42} textAnchor="middle" fontSize={11} fill={CHROME.inkMuted}>
            in {truncate(path[path.length - 1]!, 18)}
          </text>
        )}
      </>
    );
  }

  const lines = wrap(active.name, 16, 2);
  const firstY = CENTER - 18 - (lines.length - 1) * 8;

  return (
    <>
      {lines.map((line, index) => (
        <text
          key={line + index}
          x={CENTER}
          y={firstY + index * 16}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={13}
          fontWeight={500}
          fill={CHROME.ink}
        >
          {line}
        </text>
      ))}
      <text
        x={CENTER}
        y={CENTER + 12}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={28}
        fontWeight={600}
        fill={CHROME.ink}
      >
        {active.value}
      </text>
      <text x={CENTER} y={CENTER + 34} textAnchor="middle" fontSize={11} fill={CHROME.inkMuted}>
        {active.valueLabel.replace(/^\d+\s/, "")}
      </text>
      <text x={CENTER} y={CENTER + 50} textAnchor="middle" fontSize={10} fill={CHROME.inkMuted}>
        {truncate(active.shareLabel, 26)}
      </text>
    </>
  );
}
