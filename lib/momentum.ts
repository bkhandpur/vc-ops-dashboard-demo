/** Deterministic momentum and list-tenure calculations for generated records. */

import type { StagedCompany } from "./aggregate";

// ---------------------------------------------------------------------------
// Portfolio momentum
// ---------------------------------------------------------------------------

/**
 * Coverage below this on the list in question means we do not draw the view at all.
 * The project's standing bar, made explicit so a future session cannot quietly lower it.
 */
export const COVERAGE_BAR_PCT = 40;

export type MomentumMetric = "headcountGrowth" | "webTrafficGrowth";

export interface MomentumMetricDef {
  key: MomentumMetric;
  label: string;
  /** the CRM slug, so a reader can go find the field. */
  slug: string;
  description: string;
  unit: "%";
}

export const MOMENTUM_METRICS: MomentumMetricDef[] = [
  {
    key: "headcountGrowth",
    label: "Headcount growth",
    slug: "headcount_growth",
    description: "Percent change in the company's headcount, from the CRM enrichment.",
    unit: "%",
  },
  {
    key: "webTrafficGrowth",
    label: "Web traffic growth (90d)",
    slug: "web_traffic_growth_90d",
    description: "Percent change in web traffic over the last 90 days, from the CRM enrichment.",
    unit: "%",
  },
];

export interface MomentumRow {
  company: StagedCompany;
  value: number;
}

export interface MomentumView {
  metric: MomentumMetricDef;
  /** Companies with a value, sorted descending. Negatives are real and kept. */
  rows: MomentumRow[];
  /** Portfolio companies in scope, whether or not they carry the metric. */
  inScope: number;
  covered: number;
  coveragePct: number;
  /** False when coverage is under the bar — the view refuses to draw. */
  meetsBar: boolean;
  /** Largest absolute value, for scaling a symmetric bar axis. */
  maxAbs: number;
  /** Which provider supplied these numbers. Always stated in the UI. */
  source: MomentumSource;
  /** In-scope companies with no domain — unresolvable by construction. */
  withoutDomain: number;
}

/** Generated momentum values, keyed by local record id. */
export interface EnrichedMomentumFact {
  recordId: string;
  headcountGrowth90d: number | null;
  webTrafficGrowth90d: number | null;
  headcount: number | null;
}

export type MomentumSource = "enrichment" | "crm";

/**
 * Momentum for one stage, from whichever source is asked for.
 *
 * `source` is explicit rather than automatic: a chart that silently switched providers
 * depending on coverage would make two runs of the same page incomparable, and the UI
 * has to be able to name where a number came from.
 */
export function momentumView(
  companies: readonly StagedCompany[],
  metric: MomentumMetricDef,
  stage: "portfolio" | "pipeline" = "portfolio",
  source: MomentumSource = "crm",
  enrichedFacts: readonly EnrichedMomentumFact[] = [],
): MomentumView {
  const inScopeCompanies = companies.filter((c) => c.stages.includes(stage));
  const enrichedById = new Map(enrichedFacts.map((f) => [f.recordId, f]));

  const valueFor = (company: StagedCompany): number | null => {
    if (source === "crm") return company[metric.key];
    const fact = enrichedById.get(company.recordId);
    if (!fact) return null;
    return metric.key === "headcountGrowth"
      ? fact.headcountGrowth90d
      : fact.webTrafficGrowth90d;
  };

  const rows: MomentumRow[] = inScopeCompanies
    .map((company) => ({ company, value: valueFor(company) }))
    .filter((r): r is MomentumRow => typeof r.value === "number")
    .sort((a, b) => b.value - a.value);

  const covered = rows.length;
  const inScope = inScopeCompanies.length;
  const coveragePct = inScope === 0 ? 0 : (covered / inScope) * 100;

  return {
    metric,
    rows,
    inScope,
    covered,
    coveragePct,
    meetsBar: coveragePct >= COVERAGE_BAR_PCT,
    maxAbs: rows.reduce((m, r) => Math.max(m, Math.abs(r.value)), 0),
    source,
    /** How many in scope have no domain, so could never be resolved in the enrichment provider. */
    withoutDomain: inScopeCompanies.filter((c) => c.domains.length === 0).length,
  };
}

// ---------------------------------------------------------------------------
// Pipeline tenure
// ---------------------------------------------------------------------------

export interface TenureRow {
  company: StagedCompany;
  /** Days since the record was added to the Pipeline list. */
  days: number;
  /** The deal stage from the list entry, or null. 80% covered. */
  stage: string | null;
  /** True when this record predates or matches the bulk import date. */
  fromImport: boolean;
}

export interface TenureBucket {
  /** Stage name, or "Unset" for the 20% with no stage. */
  stage: string;
  rows: TenureRow[];
  medianDays: number;
  /** How many of these were added after the import — the ones that mean something. */
  sinceImport: number;
}

export interface TenureView {
  buckets: TenureBucket[];
  /** The date the bulk of the list was created, and how many share it. */
  importDate: string | null;
  importCount: number;
  total: number;
  /** Records added after the import date. The honest signal, and it grows weekly. */
  sinceImport: number;
  /**
   * True while most of the list still shares the import timestamp. The UI must lead
   * with the caveat while this holds.
   */
  dominatedByImport: boolean;
}

/** Canonical funnel order. status options arrive unordered. */
const STAGE_ORDER = [
  "Sourcing",
  "Due Diligence",
  "Term Sheet",
  "Closed",
  "Passed",
] as const;

const UNSET_STAGE = "Unset";

function daysBetween(from: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(from).getTime()) / 86_400_000));
}

/**
 * Tenure of Pipeline entries, bucketed by deal stage.
 *
 * `now` is injected so the function stays pure and the numbers are reproducible in a
 * check; callers pass `Date.now()`.
 */
export function tenureView(companies: readonly StagedCompany[], now: number): TenureView {
  const pipeline = companies.filter(
    (c) => c.stages.includes("pipeline") && c.addedToListAt !== null,
  );

  // The import date is simply the most common day in the list. Derived rather than
  // hardcoded, so it stays correct if the workspace is ever re-imported.
  const byDay = new Map<string, number>();
  for (const c of pipeline) {
    const day = c.addedToListAt!.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const [importDate, importCount] = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0] ?? [
    null,
    0,
  ];

  const rows: TenureRow[] = pipeline.map((company) => {
    const day = company.addedToListAt!.slice(0, 10);
    return {
      company,
      days: daysBetween(company.addedToListAt!, now),
      stage: company.pipelineStage,
      fromImport: importDate !== null && day <= importDate,
    };
  });

  const grouped = new Map<string, TenureRow[]>();
  for (const row of rows) {
    const key = row.stage ?? UNSET_STAGE;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  const buckets: TenureBucket[] = [...grouped.entries()]
    .map(([stage, list]) => {
      const sorted = [...list].sort((a, b) => b.days - a.days);
      const days = [...list].map((r) => r.days).sort((a, b) => a - b);
      return {
        stage,
        rows: sorted,
        medianDays: days[Math.floor(days.length / 2)] ?? 0,
        sinceImport: list.filter((r) => !r.fromImport).length,
      };
    })
    .sort((a, b) => {
      const ai = STAGE_ORDER.indexOf(a.stage as (typeof STAGE_ORDER)[number]);
      const bi = STAGE_ORDER.indexOf(b.stage as (typeof STAGE_ORDER)[number]);
      // Unset and any unrecognised status sort after the known funnel.
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  const sinceImport = rows.filter((r) => !r.fromImport).length;

  return {
    buckets,
    importDate,
    importCount,
    total: rows.length,
    sinceImport,
    dominatedByImport: rows.length > 0 && importCount / rows.length >= 0.5,
  };
}

/**
 * Distribution of Pipeline companies across the deal-stage funnel.
 *
 * This is the part of "pipeline momentum" that rests on solid data: `stage` is 80%
 * covered and is a real, hand-maintained status. Unlike tenure it needs no caveat, so
 * it leads the page.
 */
export interface StageDistributionRow {
  stage: string;
  count: number;
  pct: number;
}

export function stageDistribution(companies: readonly StagedCompany[]): StageDistributionRow[] {
  const pipeline = companies.filter((c) => c.stages.includes("pipeline"));
  const counts = new Map<string, number>();
  for (const c of pipeline) {
    const key = c.pipelineStage ?? UNSET_STAGE;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([stage, count]) => ({
      stage,
      count,
      pct: pipeline.length === 0 ? 0 : (count / pipeline.length) * 100,
    }))
    .sort((a, b) => {
      const ai = STAGE_ORDER.indexOf(a.stage as (typeof STAGE_ORDER)[number]);
      const bi = STAGE_ORDER.indexOf(b.stage as (typeof STAGE_ORDER)[number]);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
}
