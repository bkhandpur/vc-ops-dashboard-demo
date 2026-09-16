/**
 * Colour scale for the sector taxonomy.
 *
 * ── RULES THIS FILE ENFORCES ─────────────────────────────────────────────────
 * 1. Hue means THEME, and nothing else. A theme keeps its hue at every depth, under
 *    every filter, and in both colour modes, so nothing repaints when you toggle.
 * 2. Depth (sector vs sub-sector) is a lightness step of the parent theme's hue,
 *    never a new hue. Only TWO steps exist, because that is all these hues can
 *    support while every step still clears contrast — which is why the sunburst shows
 *    two levels at a time and drills for the third.
 * 3. "Unclassified" is a reserved neutral, not a series identity.
 * 4. Dark mode is SELECTED, not derived. Every dark value below was stepped for the
 *    dark surface and validated against it — it is not a lightened copy of the light
 *    palette, and flipping the two would fail.
 *
 * ── VALIDATION ─────────────────────────────────────────────────────────────
 * Re-validated after an earlier UI pass moved the dark surface from a warm #1a1a19 to
 * the cooler #12161d. **No series hue changed** — only the surface they are checked
 * against, and the two reserved neutrals, which were re-stepped from warm grey to cool
 * grey so they belong to the new surface family.
 *
 * Light, white surface, --pairs all:  band PASS · CVD PASS (worst ΔE 9.2 deutan) ·
 *   normal-vision PASS (19.1) · contrast WARN on aqua (2.82:1)
 * Dark, #12161d surface, --pairs all: band PASS · CVD PASS (worst ΔE 9.4 deutan) ·
 *   normal-vision PASS (19.4) · contrast PASS (all ≥ 3:1)
 *
 * Validate the THREE REAL THEMES plus the neutral, not all five ramps. `violet` is the
 * overflow ramp for a hypothetical fourth theme and is unused today; against blue it
 * measures ΔE 1.9 protan, which would fail the all-pairs check for a pair that never
 * appears together on screen. If a fourth theme is ever added, re-step violet and re-run
 * the validator before shipping it.
 *
 * Both modes: the neutral deliberately FAILs the chroma floor ("reads gray"). That is
 * the point of a reserved neutral.
 * Every two-step ramp passes monotonicity, ΔL ≥ 0.06 and its mode's contrast floor.
 *
 * Known limitation, both modes: aqua↔orange separate well for deutan/protan but sit
 * close under tritanopia (tritan ΔE 4.0 dark). Tritanopia is vanishingly rare, and
 * every mark in this app carries a label, legend entry or table row, so hue is never
 * the only channel.
 *
 * The aqua contrast WARN in light mode obliges that same relief. Re-run the validator
 * before changing any hex here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type ColorMode = "light" | "dark";

/** base = the level whose hue is the theme's own; light = one level deeper. */
export interface Ramp {
  base: string;
  light: string;
}

const LIGHT_RAMPS = {
  blue: { base: "#2a78d6", light: "#5b97df" },
  orange: { base: "#eb6834", light: "#f3a181" },
  aqua: { base: "#1baf7a", light: "#5fc7a2" },
  violet: { base: "#4a3aa7", light: "#8478c6" },
  /** Reserved for Unclassified / unknown. Never assigned to a real theme. */
  neutral: { base: "#4f5560", light: "#b3bac2" },
} as const satisfies Record<string, Ramp>;

const DARK_RAMPS = {
  blue: { base: "#3987e5", light: "#619fea" },
  orange: { base: "#d95926", light: "#e17a51" },
  aqua: { base: "#199e70", light: "#45b08b" },
  violet: { base: "#9085e9", light: "#aaa2ef" },
  neutral: { base: "#b9c0c9", light: "#d2d7dd" },
} as const satisfies Record<string, Ramp>;

type RampName = keyof typeof LIGHT_RAMPS;

/**
 * Fixed hue order, keyed to the actual `thesis_theme` option set in the dataset.
 * Hardcoded rather than derived from the data so a filtered-out theme cannot shift
 * another theme's colour. A theme added in the CRM and not listed here falls through to
 * violet, then to the neutral — add it here (and re-run the validator) rather than
 * letting a real theme land on the reserved neutral.
 */
const THEME_RAMP_NAMES: Record<string, RampName> = {
  "Care & Longevity": "blue",
  "Work & Craft": "orange",
  "Planet & Resources": "aqua",
};

const UNCLASSIFIED_LABELS = new Set(["Unclassified", "Unknown"]);

const OVERFLOW_ORDER: RampName[] = ["violet"];

/** Themes seen at runtime that aren't in THEME_RAMP_NAMES, in first-seen order. */
const overflowAssignments = new Map<string, RampName>();

function rampNameForTheme(theme: string): RampName {
  if (UNCLASSIFIED_LABELS.has(theme)) return "neutral";
  const known = THEME_RAMP_NAMES[theme];
  if (known) return known;

  let assigned = overflowAssignments.get(theme);
  if (!assigned) {
    assigned = OVERFLOW_ORDER[overflowAssignments.size] ?? "neutral";
    overflowAssignments.set(theme, assigned);
  }
  return assigned;
}

export function rampForTheme(theme: string, mode: ColorMode): Ramp {
  const name = rampNameForTheme(theme);
  return mode === "dark" ? DARK_RAMPS[name] : LIGHT_RAMPS[name];
}

/** `depth` 0 = the level whose hue is the theme's base, 1 = one level deeper. */
export function fillFor(theme: string, depth: 0 | 1, mode: ColorMode): string {
  const ramp = rampForTheme(theme, mode);
  return depth === 0 ? ramp.base : ramp.light;
}

/**
 * Sequential ramp for the Matrix heatmap — magnitude, not identity, so it is one hue
 * light→dark rather than a set of categorical colours.
 *
 * Light: blue steps 250→650. Dark: steps 100→600, ordered so darker still means more
 * against a dark surface (it stops at 600 because anything darker drops below 2:1 on
 * #1a1a19). Both validated --ordinal: all checks PASS.
 */
const HEAT_RAMP_LIGHT = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"] as const;
const HEAT_RAMP_DARK = ["#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4"] as const;

export function heatRamp(mode: ColorMode): readonly string[] {
  return mode === "dark" ? HEAT_RAMP_DARK : HEAT_RAMP_LIGHT;
}

/**
 * Bin a value onto the heat ramp. Returns null for zero so an empty cell can render as
 * bare surface — "none" should read as absence, not as the palest shade of something.
 */
export function heatFill(value: number, max: number, mode: ColorMode): string | null {
  const ramp = heatRamp(mode);
  if (value <= 0) return null;
  if (max <= 0) return ramp[0]!;
  const index = Math.ceil((value / max) * ramp.length) - 1;
  return ramp[Math.min(Math.max(index, 0), ramp.length - 1)]!;
}

/**
 * Pick white or near-black for a label sitting *inside* a fill, by the fill's own
 * luminance, so text always clears contrast. Mode-independent by construction — it
 * measures the actual fill it is placed on.
 *
 * (Text elsewhere wears text tokens, never a series colour.)
 */
export function inkOn(fill: string): string {
  return relativeLuminance(fill) < 0.42 ? "#ffffff" : "#0b0b0b";
}

function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

/**
 * Chart chrome references CSS custom properties rather than hex, because inline SVG
 * lives in the document and so inherits the theme automatically — no mode plumbing,
 * and no risk of chrome and page disagreeing during a toggle. Only *series* colours
 * are hex, so that what ships is exactly what the validator checked.
 */
export const CHROME = {
  surface: "var(--color-surface)",
  gridline: "var(--color-line)",
  axis: "var(--color-line-strong)",
  ink: "var(--color-ink)",
  inkMuted: "var(--color-ink-subtle)",
  inkSecondary: "var(--color-ink-muted)",
} as const;
