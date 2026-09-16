/**
 * Pure geometry and text layout for the sunburst. No React, no JSX — kept separate so
 * the maths can be run and eyeballed on its own (see scripts/preview-sunburst.ts,
 * which renders a real SVG from this module).
 */

import type { StatsNode } from "@/lib/aggregate";

export const VIEW = 440;
export const CENTER = VIEW / 2;
const HOLE_R = 82;
export const RING_1 = { inner: HOLE_R, outer: 134 };
export const RING_2 = { inner: 136.5, outer: 198 };
/** Surface gap between touching arcs, in viewBox units (~2px rendered). */
const GAP_PX = 2;

export interface Arc {
  key: string;
  name: string;
  /** Parent name, shown in the centre readout when drilled in. */
  parent: string | null;
  value: number;
  /** "12 companies" or "12 tagged" - sub-sector is a multiselect, so it counts tags. */
  valueLabel: string;
  /** "18% of view" or "24% of Clinical Care". */
  shareLabel: string;
  theme: string;
  depth: 0 | 1;
  a0: number;
  a1: number;
  rInner: number;
  rOuter: number;
  drillable: boolean;
}

// ---------------------------------------------------------------------------

export function buildArcs(
  tree: StatsNode[],
  path: string[],
): { arcs: Arc[]; levelTotal: number } {
  // Resolve the level the path points at, tolerating a stale path after a filter
  // change removed the node we were inside.
  let level = tree;
  let themeOfLevel: string | null = null;
  for (const name of path) {
    const next = level.find((n) => n.name === name);
    if (!next?.children?.length) break;
    themeOfLevel ??= name;
    level = next.children;
  }

  const levelTotal = level.reduce((sum, n) => sum + n.value, 0);
  if (levelTotal === 0) return { arcs: [], levelTotal: 0 };

  /**
   * Drilled in, the outer ring is sub-sectors — a multiselect, so its values are tag
   * counts that can sum above the parent sector's company count. Each group is
   * therefore scaled by its own sum to fill the parent's sweep, and labelled as tags
   * rather than companies. At the root both rings are single-select fields, so they
   * are exact company counts and the scaling is a no-op.
   */
  const outerCountsTags = themeOfLevel !== null;

  const arcs: Arc[] = [];
  const TAU = Math.PI * 2;
  let angle = -Math.PI / 2;

  for (const node of level) {
    const sweep = (node.value / levelTotal) * TAU;
    // At the root the node IS the theme; drilled in, it inherits the theme's hue.
    const theme = themeOfLevel ?? node.name;
    const children = node.children ?? [];
    const childTotal = children.reduce((sum, c) => sum + c.value, 0);

    arcs.push({
      key: `0-${node.name}`,
      name: node.name,
      parent: themeOfLevel,
      value: node.value,
      valueLabel: companies(node.value),
      shareLabel: `${percent(node.value, levelTotal)} of view`,
      theme,
      depth: 0,
      ...padded(angle, sweep, RING_1),
      rInner: RING_1.inner,
      rOuter: RING_1.outer,
      drillable: themeOfLevel === null && children.length > 0,
    });

    let childAngle = angle;
    for (const child of children) {
      const childSweep = childTotal === 0 ? 0 : (child.value / childTotal) * sweep;
      arcs.push({
        key: `1-${node.name}-${child.name}`,
        name: child.name,
        parent: node.name,
        value: child.value,
        valueLabel: outerCountsTags
          ? `${child.value} tagged`
          : companies(child.value),
        shareLabel: outerCountsTags
          ? `${percent(child.value, childTotal)} of ${node.name}`
          : `${percent(child.value, levelTotal)} of view`,
        theme,
        depth: 1,
        ...padded(childAngle, childSweep, RING_2),
        rInner: RING_2.inner,
        rOuter: RING_2.outer,
        drillable: false,
      });
      childAngle += childSweep;
    }

    angle += sweep;
  }

  return { arcs, levelTotal };
}

/**
 * Inset each arc by a constant *pixel* gap, which means a shrinking angle as the
 * radius grows. Never eat more than a third of a thin arc, so slivers stay visible.
 */
function padded(
  start: number,
  sweep: number,
  ring: { inner: number; outer: number },
): { a0: number; a1: number } {
  const midR = (ring.inner + ring.outer) / 2;
  const pad = Math.min(GAP_PX / midR, sweep / 3) / 2;
  return { a0: start + pad, a1: start + sweep - pad };
}

export function arcPath({ a0, a1, rInner, rOuter }: Arc): string {
  const sweep = a1 - a0;
  // A full ring can't be one arc command — split it in half.
  if (sweep >= Math.PI * 2 - 1e-6) {
    const mid = a0 + Math.PI;
    return `${annulusHalf(a0, mid, rInner, rOuter)} ${annulusHalf(mid, a0 + Math.PI * 2, rInner, rOuter)}`;
  }
  const largeArc = sweep > Math.PI ? 1 : 0;
  const [x0, y0] = polar(rOuter, a0);
  const [x1, y1] = polar(rOuter, a1);
  const [x2, y2] = polar(rInner, a1);
  const [x3, y3] = polar(rInner, a0);
  return [
    `M ${x0} ${y0}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x1} ${y1}`,
    `L ${x2} ${y2}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x3} ${y3}`,
    "Z",
  ].join(" ");
}

function annulusHalf(a0: number, a1: number, rInner: number, rOuter: number): string {
  const [x0, y0] = polar(rOuter, a0);
  const [x1, y1] = polar(rOuter, a1);
  const [x2, y2] = polar(rInner, a1);
  const [x3, y3] = polar(rInner, a0);
  return `M ${x0} ${y0} A ${rOuter} ${rOuter} 0 0 1 ${x1} ${y1} L ${x2} ${y2} A ${rInner} ${rInner} 0 0 0 ${x3} ${y3} Z`;
}

function polar(r: number, angle: number): [number, number] {
  return [
    round(CENTER + r * Math.cos(angle)),
    round(CENTER + r * Math.sin(angle)),
  ];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Approximate advance width per character at LABEL_FONT_PX, system sans, 500 weight. */
const CHAR_PX = 6.4;
export const LABEL_FONT_PX = 12;
/** Below this many characters a label says nothing useful ("Unc…"), so we drop it. */
const MIN_LABEL_CHARS = 7;

export interface InnerLabel {
  x: number;
  y: number;
  /** Degrees, for an SVG rotate() about (x, y) — labels run along the arc. */
  rotation: number;
  text: string;
}

/**
 * Label an inner arc only when the text genuinely fits — measured against the two
 * constraints that actually apply, not just one:
 *
 *  1. Arc length at the mid-radius, so a label can't be wider than its own slice.
 *  2. Tangent fit. The label is a straight line drawn along the tangent at the arc's
 *     midpoint, so on a wide arc it leaves the ring band before it runs out of arc.
 *     A tangent at radius rMid stays inside rOuter for ±sqrt(rOuter² − rMid²).
 *
 * Constraint 2 is the one an earlier version missed: measuring arc length alone let
 * "Care & Longevity" spill out past the ring on a half-circle slice.
 *
 * Everything left unlabelled is covered by hover, the legend and the table.
 */
export function innerLabel(arc: Arc): InnerLabel | null {
  const midR = (arc.rInner + arc.rOuter) / 2;
  const radialRoom = arc.rOuter - arc.rInner;
  if (radialRoom < LABEL_FONT_PX + 8) return null;

  const arcLength = (arc.a1 - arc.a0) * midR;
  const tangentFit = 2 * Math.sqrt(Math.max(0, arc.rOuter ** 2 - midR ** 2));
  // Leave a little padding on both ends rather than touching the edges.
  const usable = Math.min(arcLength, tangentFit) - 8;

  const maxChars = Math.floor(usable / CHAR_PX);
  if (maxChars < MIN_LABEL_CHARS) return null;
  const text = truncate(arc.name, maxChars);

  const mid = (arc.a0 + arc.a1) / 2;
  const [x, y] = polar(midR, mid);
  return { x, y, rotation: tangentRotation(mid), text };
}

/**
 * Along-the-arc rotation, always normalised into [-90, 90] so a label never reads
 * upside down or bottom-up.
 */
function tangentRotation(angle: number): number {
  let deg = ((((angle * 180) / Math.PI + 90) % 360) + 360) % 360; // [0, 360)
  if (deg > 90 && deg < 270) deg -= 180; // flip the lower half
  else if (deg >= 270) deg -= 360; // express the last quadrant as negative
  return Math.round(deg * 10) / 10;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function companies(value: number): string {
  return `${value} ${value === 1 ? "company" : "companies"}`;
}

export function percent(value: number, total: number): string {
  if (total === 0) return "0%";
  const pct = (value / total) * 100;
  return `${pct < 1 ? pct.toFixed(1) : Math.round(pct)}%`;
}

export function truncate(text: string, max: number): string {
  if (max <= 1) return "";
  if (text.length <= max) return text;
  // trimEnd so we get "Sustainable…" rather than "Sustainable …".
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

export function wrap(text: string, perLine: number, maxLines: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= perLine) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length === 0) return [truncate(text, perLine)];
  const last = lines.length - 1;
  const consumed = lines.join(" ").length;
  if (consumed < text.length) lines[last] = truncate(`${lines[last]!}…`, perLine);
  return lines;
}
