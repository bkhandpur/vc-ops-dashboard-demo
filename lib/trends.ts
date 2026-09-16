/** Pure trend calculations over locally stored demo digests. */

import type { Digest } from "./digest";
import { STAGE_LISTS, UNCLASSIFIED, type StageKey } from "./constants";

export interface TrendPoint {
  /** ISO timestamp the digest ran. */
  at: string;
  totals: Record<StageKey, number>;
  themeMix: Record<StageKey, Record<string, number>>;
  sectorCoverage: Record<StageKey, { covered: number; total: number }>;
  /** Data Health completeness from 0 to 100. */
  healthPct?: number;
}

export interface TrendSeries {
  /** Chronological, oldest first. */
  points: TrendPoint[];
  /** Every theme seen at any point, largest-first at the latest point. */
  themes: string[];
  hasTrend: boolean;
  /** How many stored digests had no metrics block and were skipped. */
  skipped: number;
  /** Distinct calendar days the usable points fall on. See `spansMultipleDays`. */
  distinctDays: number;
  /** False when every stored digest was written on the same calendar day. */
  spansMultipleDays: boolean;
}

/**
 * `listDigests()` returns newest-first (the index is maintained that way). Charts read
 * left to right in time, so reverse once here rather than in every consumer.
 */
export function buildTrendSeries(digests: readonly Digest[]): TrendSeries {
  const usable = digests.filter((d) => d.metrics !== undefined);
  const skipped = digests.length - usable.length;

  const points: TrendPoint[] = usable
    .map((d) => ({
      at: d.generatedAt,
      totals: d.metrics!.totals,
      themeMix: d.metrics!.themeMix,
      sectorCoverage: d.metrics!.sectorCoverage,
      healthPct: d.metrics!.healthPct,
    }))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const distinctDays = new Set(points.map((p) => p.at.slice(0, 10))).size;

  const latest = points[points.length - 1];
  const themeNames = new Set<string>();
  for (const point of points) {
    for (const stage of STAGE_LISTS) {
      for (const theme of Object.keys(point.themeMix[stage] ?? {})) themeNames.add(theme);
    }
  }

  // Order by size at the most recent point so the stacked bands sit in a stable,
  // meaningful order rather than alphabetically. Unclassified is pinned last — it is a
  // reserved neutral in the palette and must never sit between two real series.
  const sizeAtLatest = (theme: string) =>
    latest
      ? STAGE_LISTS.reduce((sum, stage) => sum + (latest.themeMix[stage]?.[theme] ?? 0), 0)
      : 0;

  const themes = [...themeNames].sort((a, b) => {
    if (a === UNCLASSIFIED) return 1;
    if (b === UNCLASSIFIED) return -1;
    return sizeAtLatest(b) - sizeAtLatest(a) || a.localeCompare(b);
  });

  return {
    points,
    themes,
    hasTrend: points.length >= 2,
    skipped,
    distinctDays,
    spansMultipleDays: distinctDays >= 2,
  };
}

// ---------------------------------------------------------------------------
// Rolling history
// ---------------------------------------------------------------------------

/**
 * Data Health completeness over time.
 *
 * Points without a `healthPct` are dropped rather than zeroed — the same rule the rest
 * of this module follows, and it matters more here than anywhere: this figure is a
 * percentage, so a missing value defaulted to 0 would draw a collapse from 72% to
 * nothing and then back, which never happened.
 */
export function healthSeries(series: TrendSeries): LineSeries {
  return {
    label: "Completeness",
    values: series.points
      .filter((p) => typeof p.healthPct === "number")
      .map((p) => ({ at: p.at, value: p.healthPct! })),
  };
}

export interface RollingConversion {
  /** Portfolio ÷ (Pipeline + Portfolio) across the whole book, per point. */
  values: { at: string; rate: number; portfolio: number; pipeline: number }[];
  /** Mean rate across every point in the window. */
  average: number;
  /** First → last change in percentage points, or null below two points. */
  change: number | null;
  /** Points actually used. */
  windowSize: number;
}

/**
 * Pipeline → Portfolio conversion across the whole book, over the last `weeks` points.
 *
 * Still deliberately **not** called a conversion rate without qualification. The CRM
 * records no "we passed at stage X" event, so a true funnel rate is not recoverable;
 * this measures what share of the companies we are currently carrying have reached
 * Portfolio. The UI states that, exactly as the per-theme version already does.
 *
 * `weeks` counts stored digests, not calendar weeks — they coincide once the Monday
 * cron is the only thing writing them, and diverge whenever someone clicks "Run diff
 * now". Callers should gate on `spansMultipleDays` before presenting this as a trend.
 */
export function rollingConversion(series: TrendSeries, weeks = 12): RollingConversion {
  const window = series.points.slice(-weeks);

  const values = window.map((p) => {
    const portfolio = p.totals.portfolio;
    const pipeline = p.totals.pipeline;
    const denominator = portfolio + pipeline;
    return {
      at: p.at,
      rate: denominator === 0 ? 0 : (portfolio / denominator) * 100,
      portfolio,
      pipeline,
    };
  });

  const first = values[0];
  const last = values[values.length - 1];

  return {
    values,
    average: values.length === 0 ? 0 : values.reduce((s, v) => s + v.rate, 0) / values.length,
    change: first && last && values.length >= 2 ? last.rate - first.rate : null,
    windowSize: values.length,
  };
}

/** A single plottable line: pipeline size, portfolio size, coverage %, whatever. */
export interface LineSeries {
  label: string;
  /** [x, y] where x is the point index and y the value. */
  values: { at: string; value: number }[];
}

export function pipelineSizeSeries(series: TrendSeries): LineSeries[] {
  return (["pipeline", "portfolio"] as const).map((stage) => ({
    label: stage === "pipeline" ? "Pipeline" : "Portfolio",
    values: series.points.map((p) => ({ at: p.at, value: p.totals[stage] })),
  }));
}

/**
 * Canonical-sector completeness over time, per stage. This is the "is our data quality
 * improving?" chart — it is a percentage, so it is comparable across stages of very
 * different sizes.
 */
export function sectorCoverageSeries(series: TrendSeries): LineSeries[] {
  return (["pipeline", "portfolio"] as const).map((stage) => ({
    label: stage === "pipeline" ? "Pipeline" : "Portfolio",
    values: series.points.map((p) => {
      const c = p.sectorCoverage[stage];
      return { at: p.at, value: c.total === 0 ? 0 : (c.covered / c.total) * 100 };
    }),
  }));
}

/** Stacked bands: theme mix within one stage, over time. */
export interface StackedPoint {
  at: string;
  /** Cumulative bottom and top for each theme, as a share 0–1. */
  bands: { theme: string; from: number; to: number; count: number }[];
  total: number;
}

export function themeMixSeries(series: TrendSeries, stage: StageKey): StackedPoint[] {
  return series.points.map((point) => {
    const mix = point.themeMix[stage] ?? {};
    const total = Object.values(mix).reduce((a, b) => a + b, 0);
    let cursor = 0;
    const bands = series.themes
      .map((theme) => {
        const count = mix[theme] ?? 0;
        const share = total === 0 ? 0 : count / total;
        const band = { theme, from: cursor, to: cursor + share, count };
        cursor += share;
        return band;
      })
      // Keep zero-height bands out of the path data entirely.
      .filter((b) => b.to > b.from);
    return { at: point.at, bands, total };
  });
}

/**
 * Pipeline → Portfolio conversion by theme, over time.
 *
 * Defined as portfolio / (pipeline + portfolio) within each theme. That denominator is
 * the honest one for this data: the CRM records no "we passed at stage X" event, so a true
 * funnel rate is not recoverable. What this measures is what share of the companies we
 * are currently carrying in a theme have made it to Portfolio. The UI says exactly that
 * rather than calling it a conversion rate without qualification.
 */
export interface ConversionRow {
  theme: string;
  values: { at: string; rate: number; portfolio: number; pipeline: number }[];
  /** Rate at the most recent point, for sorting and for the summary column. */
  latestRate: number;
}

export function conversionByTheme(series: TrendSeries): ConversionRow[] {
  return series.themes
    .map((theme) => {
      const values = series.points.map((p) => {
        const portfolio = p.themeMix.portfolio?.[theme] ?? 0;
        const pipeline = p.themeMix.pipeline?.[theme] ?? 0;
        const denominator = portfolio + pipeline;
        return {
          at: p.at,
          rate: denominator === 0 ? 0 : (portfolio / denominator) * 100,
          portfolio,
          pipeline,
        };
      });
      return {
        theme,
        values,
        latestRate: values[values.length - 1]?.rate ?? 0,
      };
    })
    .sort((a, b) => b.latestRate - a.latestRate);
}

/** Change between the first and last point of a line, for the "since" caption. */
export function delta(line: LineSeries): { from: number; to: number; change: number } | null {
  const first = line.values[0];
  const last = line.values[line.values.length - 1];
  if (!first || !last || line.values.length < 2) return null;
  return { from: first.value, to: last.value, change: last.value - first.value };
}
