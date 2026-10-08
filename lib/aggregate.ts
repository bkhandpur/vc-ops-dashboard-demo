/**
 * Pure aggregation over the Theme → Canonical Sector → Sub-Sector hierarchy.
 *
 * Isomorphic on purpose: the server uses it for the cron/cache path, and the Statistics
 * client component re-runs it when you flip a filter, so filtering is instant and never
 * costs a round trip.
 *
 * Sizing metric is company count, and that is a data constraint rather than a design
 * preference. There is no invested-amount attribute on the companies object — both
 * candidate fields measure 0% (see COMPANY_FIELDS.amountInvested) — so weighting the
 * charts by the one currency field that IS populated would rank how much each company
 * raised from everyone, not where this firm's capital went. We do not invent the metric.
 * If such a field ever appears, extend StagedCompany + StatsNode with `amount` and sum
 * it alongside `value`; do not derive it from funding raised.
 */

import { ROUND_ORDER, UNCLASSIFIED, type StageKey } from "./constants";

/**
 * The company shape carried in the cached snapshot, tagged with list membership.
 *
 * Deliberately wider than `aggregate()` itself needs: the snapshot is the single thing
 * every page reads (Statistics, Data Health, Search, Company Detail, the Logo Wall), and
 * the project rule is that page loads never call an external service. So a field any of
 * those views wants has to be here, or that view would need its own round trip.
 *
 * All views share this shape; keep its readers and independent fixtures synchronized.
 */
export interface StagedCompany {
  recordId: string;
  name: string | null;
  theme: string | null;
  canonicalSector: string | null;
  subSectors: string[];
  rounds: string[];
  stages: StageKey[];
  /** Enrichment-populated logo URL, for CompanyAvatar. */
  logoUrl: string | null;
  /**
   * Total capital raised from ALL investors, USD. NOT this firm's own position —
   * anything rendering this must say so. Populated on roughly half the book.
   */
  fundingRaisedUsd: number | null;

  // ── Carried for Data Health, Search and Company Detail ────────────────────
  description: string | null;
  domains: string[];
  /**
   * Best available location. Comes from the LIST ENTRY `hq_city` field (93% on
   * Pipeline, 84% on Archive), NOT the company object's `hq_location` (8/7/3). Prefer the populated list-entry field.
   */
  location: string | null;
  /** Best available headcount — `headcount_exact` before the `headcount_band` bucket. */
  employeeRange: string | null;
  estimatedArr: string | null;
  /** Year only. From `founded_year` (59/86/92) before `founded_on` (22/52/56). */
  yearFounded: number | null;
  createdAt: string;
  /** Deal stage from the Pipeline LIST ENTRY (`status` type), 77% covered. */
  pipelineStage: string | null;
  /** 100% on Portfolio. */
  portfolioStatus: string | null;
  /** Best prose about the company: product overview → company summary → description. */
  summary: string | null;
  /**
   * WHICH field `summary` came from.
   *
   * Stored rather than re-derived, for the same reason `bestFunding()` returns its
   * source: a hand-written product overview and an enrichment blurb carry very
   * different weight in a partner meeting, and the tear sheet states the source on
   * every block. Reconstructing it by comparing strings — which the first version of
   * the tear sheet did — can only ever produce a guess like "product_overview /
   * business_summary", which is precisely the unattributed figure this project refuses
   * to show elsewhere.
   */
  summarySource: string | null;
  /** 88% on Pipeline — who knows this company and how. Free text. */
  primaryRelationships: string | null;
  linkedin: string | null;
  googleFolder: string | null;
  /** The enrichment provider's total-raised figure, a fallback for `fundingRaisedUsd`. */
  enrichedFundingUsd: number | null;

  // ── Second census pass — deal shape, enrichment, momentum ─────────────────
  /** Founder/exec bios as prose. 90% of Pipeline. */
  teamStructure: string | null;
  /** A SECOND taxonomy, distinct from `theme`. 77/66/68. Never charted in Statistics. */
  investmentThemes: string[];
  /** e.g. "Co-Investment". 53/45. */
  dealType: string[];
  /** Angel / Fund I / SPV — which vehicle was used. 38% of Portfolio. */
  vehicle: string[];
  /** The raise being sought, $M. Low and high may both be present. */
  raisingLowM: number | null;
  raisingHighM: number | null;
  /** Free text, e.g. "$7M post-money cap". */
  valuationText: string | null;
  /** Size of the most recent round, EUR. 66% of Portfolio. */
  lastFundingEur: number | null;
  /** Enrichment tags — NOT the taxonomy Statistics counts. */
  industry: string[];
  categories: string[];
  clientFocus: string[];
  ownershipTypes: string[];
  /** Momentum signals. Percentages; legitimately negative. */
  headcountGrowth: number | null;
  webTrafficGrowth: number | null;
  headcount: number | null;
  twitter: string | null;
  /** When this company was added to the list it came from (from the list entry). */
  addedToListAt: string | null;
  /** Raw workspace-member id — never render it as a name. See readActorId. */
  connectionUser: string | null;
  connectionStrength: string | null;
  connectionScore: number | null;
  teamRecordIds: string[];
}

export interface RoundBreakdown {
  [round: string]: number;
}

export interface TableRow {
  theme: string;
  canonicalSector: string;
  subSector: string;
  companies: number;
  pctOfTotal: number;
  rounds: RoundBreakdown;
}

/** Drill-down tree: theme → sector → sub-sector. */
export interface StatsNode {
  name: string;
  level: "theme" | "sector" | "subSector";
  value: number;
  children?: StatsNode[];
}

export interface AggregateResult {
  /** Distinct companies in scope. Percentages are measured against this. */
  total: number;
  /**
   * Theme and sector node values are DISTINCT company counts — both fields are
   * single-select, so each company lands in exactly one of each and the theme level
   * sums to `total` exactly.
   *
   * Sub-sector node values are TAG counts, because sub-sector is a multiselect: a
   * company with three sub-sectors adds one to each. So sub-sector
   * children can sum above their parent sector's value. Anything drawing the
   * sub-sector level must say what it is measuring rather than implying companies.
   */
  tree: StatsNode[];
  rows: TableRow[];
  roundColumns: string[];
  stagesIncluded: StageKey[];
}

const UNKNOWN_ROUND = "Unknown";

/**
 * Map key for a taxonomy path. The separator is a control character that cannot appear
 * in a select-option title, so ("A B", "C") can never collide with ("A", "B C") the way
 * a space-joined key would. Found the hard way.
 */
const KEY_SEP = "\u001f";

function pathKey(...parts: string[]): string {
  return parts.join(KEY_SEP);
}

function orderRounds(labels: Iterable<string>): string[] {
  const seen = [...new Set(labels)];
  const known = ROUND_ORDER.filter((r) => seen.includes(r));
  const rest = seen.filter((r) => !(ROUND_ORDER as readonly string[]).includes(r)).sort();
  return [...known, ...rest];
}

/**
 * A company with N sub-sectors contributes 1 to each of its N sub-sector rows, so the
 * sub-sector column can sum above `total`. The table footnote says as much.
 */
export function aggregate(
  companies: readonly StagedCompany[],
  stages: readonly StageKey[],
): AggregateResult {
  const included = companies.filter((c) => c.stages.some((s) => stages.includes(s)));

  const rowMap = new Map<string, TableRow>();
  const roundLabels = new Set<string>();
  /** Distinct company counts — safe because theme and sector are single-select. */
  const themeCounts = new Map<string, number>();
  const sectorCounts = new Map<string, { theme: string; sector: string; count: number }>();

  for (const company of included) {
    const theme = company.theme ?? UNCLASSIFIED;
    const sector = company.canonicalSector ?? UNCLASSIFIED;
    const subSectors = company.subSectors.length
      ? [...new Set(company.subSectors)]
      : [UNCLASSIFIED];
    const rounds = company.rounds.length ? [...new Set(company.rounds)] : [UNKNOWN_ROUND];
    rounds.forEach((r) => roundLabels.add(r));

    themeCounts.set(theme, (themeCounts.get(theme) ?? 0) + 1);
    const sectorKey = pathKey(theme, sector);
    const existingSector = sectorCounts.get(sectorKey);
    sectorCounts.set(sectorKey, {
      theme,
      sector,
      count: (existingSector?.count ?? 0) + 1,
    });

    for (const subSector of subSectors) {
      const key = pathKey(theme, sector, subSector);
      let row = rowMap.get(key);
      if (!row) {
        row = {
          theme,
          canonicalSector: sector,
          subSector,
          companies: 0,
          pctOfTotal: 0,
          rounds: {},
        };
        rowMap.set(key, row);
      }
      row.companies += 1;
      for (const round of rounds) {
        row.rounds[round] = (row.rounds[round] ?? 0) + 1;
      }
    }
  }

  const total = included.length;
  const rows = [...rowMap.values()]
    .map((row) => ({
      ...row,
      pctOfTotal: total === 0 ? 0 : (row.companies / total) * 100,
    }))
    .sort((a, b) => b.companies - a.companies);

  // The tree shares its sub-sector leaves with `rows`, so chart and table can never
  // disagree; theme and sector values come from the distinct counts above rather than
  // from summing children, which would double-count multi-sub-sector companies.
  const subsByPath = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const key = pathKey(row.theme, row.canonicalSector);
    let subs = subsByPath.get(key);
    if (!subs) {
      subs = new Map<string, number>();
      subsByPath.set(key, subs);
    }
    subs.set(row.subSector, (subs.get(row.subSector) ?? 0) + row.companies);
  }

  const sectorsByTheme = new Map<string, StatsNode[]>();
  for (const [sectorKey, { theme, sector, count }] of sectorCounts) {
    const subChildren: StatsNode[] = [
      ...(subsByPath.get(sectorKey) ?? new Map<string, number>()).entries(),
    ]
      .map(([sub, subCount]) => ({
        name: sub,
        level: "subSector" as const,
        value: subCount,
      }))
      .sort((a, b) => b.value - a.value);

    const list = sectorsByTheme.get(theme) ?? [];
    list.push({ name: sector, level: "sector", value: count, children: subChildren });
    sectorsByTheme.set(theme, list);
  }

  const tree: StatsNode[] = [...themeCounts.entries()]
    .map(([theme, count]) => ({
      name: theme,
      level: "theme" as const,
      value: count,
      children: (sectorsByTheme.get(theme) ?? []).sort((a, b) => b.value - a.value),
    }))
    .sort((a, b) => b.value - a.value);

  return {
    total,
    tree,
    rows,
    roundColumns: orderRounds(roundLabels),
    stagesIncluded: [...stages],
  };
}

// ---------------------------------------------------------------------------
// Stage cross-tab (the Matrix view)
// ---------------------------------------------------------------------------

export interface MatrixRow {
  /** Theme name at the root level, canonical sector name when drilled in. */
  name: string;
  /** Always the owning theme, so the row keeps its identity swatch. */
  theme: string;
  countsByStage: Record<StageKey, number>;
  /**
   * Distinct companies in this row across the selected stages. A company can sit on
   * more than one list, so this can be LESS than the sum of its cells.
   */
  total: number;
}

export interface MatrixResult {
  rows: MatrixRow[];
  /** Largest single cell, for scaling the colour ramp. */
  max: number;
  columnTotals: Record<StageKey, number>;
  /** Distinct companies across every row. */
  total: number;
}

/**
 * Cross-tabulate the current drill level against list membership: "we source a lot of
 * X — have we actually invested in it?" This is the one question the radial and bar
 * views cannot answer, because they collapse the stages together.
 *
 * `stages` selects both the scope AND the columns, so unchecking Archive removes the
 * column rather than silently rescoping the rows underneath it.
 *
 * Rows are distinct company counts at both levels (theme and canonical sector are
 * single-select), so nothing here inflates.
 */
export function crossTabByStage(
  companies: StagedCompany[],
  stages: StageKey[],
  path: string[],
): MatrixResult {
  const drilledTheme = path[0] ?? null;
  const inScope = companies.filter((company) => {
    if (!company.stages.some((s) => stages.includes(s))) return false;
    if (drilledTheme === null) return true;
    return (company.theme ?? UNCLASSIFIED) === drilledTheme;
  });

  const byRow = new Map<string, MatrixRow>();
  const columnTotals: Record<StageKey, number> = { pipeline: 0, portfolio: 0, archive: 0 };

  for (const company of inScope) {
    const theme = company.theme ?? UNCLASSIFIED;
    const name = drilledTheme === null ? theme : (company.canonicalSector ?? UNCLASSIFIED);

    let row = byRow.get(name);
    if (!row) {
      row = {
        name,
        theme,
        countsByStage: { pipeline: 0, portfolio: 0, archive: 0 },
        total: 0,
      };
      byRow.set(name, row);
    }

    row.total += 1;
    for (const stage of company.stages) {
      if (!stages.includes(stage)) continue;
      row.countsByStage[stage] += 1;
      columnTotals[stage] += 1;
    }
  }

  const rows = [...byRow.values()].sort((a, b) => b.total - a.total);
  const max = rows.reduce(
    (m, row) => Math.max(m, ...stages.map((stage) => row.countsByStage[stage])),
    0,
  );

  return { rows, max, columnTotals, total: inScope.length };
}
