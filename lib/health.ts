/** Pure completeness scoring over the generated company snapshot. */

import type { StagedCompany } from "./aggregate";
import { STAGE_LISTS, type StageKey } from "./constants";

/** Relative importance used to rank generated completeness gaps. */
export const STAGE_WEIGHT: Record<StageKey, number> = {
  portfolio: 5,
  pipeline: 2,
  archive: 0.25,
};

/**
 * How much each field matters when present, independent of which list it is on.
 * Taxonomy fields score highest because the whole Statistics page is built on them.
 */
export interface HealthCheck {
  key: string;
  label: string;
  /** What breaks in the product when this is missing. Shown in the UI. */
  why: string;
  /** The CRM attribute slug, so a reader can go find the field. */
  slug: string;
  weight: number;
  isPresent: (company: StagedCompany) => boolean;
  /** Set when the field is known to be near-empty workspace-wide. */
  note?: string;
}

const nonEmpty = (v: string | null | undefined): boolean => typeof v === "string" && v.length > 0;

export const HEALTH_CHECKS: HealthCheck[] = [
  {
    key: "canonicalSector",
    label: "Canonical sector",
    why: "Level 2 of the taxonomy. Missing values become a large Unclassified slice in every Statistics view.",
    slug: "core_sector",
    weight: 5,
    isPresent: (c) => nonEmpty(c.canonicalSector),
  },
  {
    key: "subSector",
    label: "Sub-sector",
    why: "Level 3 of the taxonomy — the level the drill-down and the table bottom out at.",
    slug: "sub_sector",
    weight: 4,
    isPresent: (c) => c.subSectors.length > 0,
  },
  {
    key: "round",
    label: "Investment round",
    why: "Drives the round breakdown columns in the Statistics table and CSV export.",
    slug: "round_current",
    weight: 3,
    isPresent: (c) => c.rounds.length > 0,
  },
  {
    key: "funding",
    label: "Funding raised",
    why: "Total capital raised. Counted as present if EITHER the CRM's own figure or the enrichment provider's enrichment has one.",
    slug: "total_raised_usd / enriched_total_raised_usd",
    weight: 3,
    isPresent: (c) =>
      typeof c.fundingRaisedUsd === "number" || typeof c.enrichedFundingUsd === "number",
  },
  {
    key: "summary",
    label: "Written summary",
    why: "The prose shown on the detail view and in search. Satisfied by product overview, company summary or description.",
    slug: "product_overview / business_summary / description",
    weight: 3,
    isPresent: (c) => nonEmpty(c.summary),
  },
  {
    key: "relationships",
    label: "Primary relationships",
    why: "Generated note showing who knows this company and how.",
    slug: "relationship_notes",
    weight: 4,
    isPresent: (c) => nonEmpty(c.primaryRelationships),
  },
  {
    key: "stage",
    label: "Deal stage",
    why: "The Pipeline list's own status column. Only exists on Pipeline entries.",
    slug: "stage (list attribute)",
    weight: 3,
    isPresent: (c) => nonEmpty(c.pipelineStage) || !c.stages.includes("pipeline"),
    note:
      "This is a LIST attribute, not a company attribute — it lives on the Pipeline list " +
      "entry. Companies not on Pipeline count as present rather than as gaps, since the " +
      "field does not apply to them.",
  },
  {
    key: "domain",
    label: "Domain",
    why: "The upsert matching key. A company with no domain can be duplicated by the command palette.",
    slug: "domains",
    weight: 4,
    isPresent: (c) => c.domains.length > 0,
  },
  {
    key: "logo",
    label: "Logo",
    why: "Falls back to a monogram. Cosmetic, but it is what the portfolio logo wall is made of.",
    slug: "logo_url",
    weight: 2,
    isPresent: (c) => nonEmpty(c.logoUrl),
  },
  {
    key: "employeeRange",
    label: "Employee range",
    why: "Company size band, shown on the detail view.",
    slug: "headcount_exact / headcount_band",
    weight: 1,
    isPresent: (c) => nonEmpty(c.employeeRange),
  },
  {
    key: "location",
    label: "City",
    why: "Where the company is based, from the list entry's City column.",
    slug: "city (list attribute)",
    weight: 1,
    isPresent: (c) => nonEmpty(c.location),
    note: "List-entry location values can be text or structured locations.",
  },
  {
    key: "investmentTheme",
    label: "Investment theme",
    why: "The deal-side theme tagging, separate from the classifier's thesis_theme.",
    slug: "investment_theme_tags",
    weight: 2,
    isPresent: (c) => c.investmentThemes.length > 0,
  },
  {
    key: "teamNotes",
    label: "Team notes",
    why: "Written founder and exec bios. Well kept on Pipeline, thin on Portfolio.",
    slug: "team_notes",
    weight: 3,
    isPresent: (c) => nonEmpty(c.teamStructure),
  },
  {
    key: "connection",
    label: "Strongest connection",
    why: "Generated relationship-strength field used to demonstrate sparse data.",
    slug: "top_connection_member",
    weight: 4,
    isPresent: (c) => nonEmpty(c.connectionUser),
    note: "This intentionally sparse field demonstrates a low-coverage integration value.",
  },
];

export interface CheckResult {
  check: HealthCheck;
  /** Per stage: how many records on that list are missing the field. */
  missingByStage: Record<StageKey, number>;
  totalByStage: Record<StageKey, number>;
  /** Distinct companies missing it across the selected stages. */
  missingTotal: number;
  inScopeTotal: number;
  /** 0–100 across the selected stages. */
  coveragePct: number;
  /**
   * "Most valuable to fix" — missing count weighted by list importance and by how much
   * the product depends on the field. Not a percentage; only its ordering is meaningful.
   */
  priority: number;
  /** The actual records to go and fix, worst list first. */
  missingCompanies: StagedCompany[];
}

export interface HealthResult {
  checks: CheckResult[];
  /** Distinct companies in scope. */
  total: number;
  /** Share of all (company × check) pairs that are populated. */
  overallCoveragePct: number;
  stagesIncluded: StageKey[];
}

export type HealthSort = "priority" | "coverage" | "missing" | "label";

export function computeHealth(
  companies: readonly StagedCompany[],
  stages: readonly StageKey[],
  sort: HealthSort = "priority",
): HealthResult {
  const inScope = companies.filter((c) => c.stages.some((s) => stages.includes(s)));

  const checks = HEALTH_CHECKS.map((check): CheckResult => {
    const missingByStage: Record<StageKey, number> = { pipeline: 0, portfolio: 0, archive: 0 };
    const totalByStage: Record<StageKey, number> = { pipeline: 0, portfolio: 0, archive: 0 };
    const missingCompanies: StagedCompany[] = [];

    for (const company of inScope) {
      const present = check.isPresent(company);
      for (const stage of STAGE_LISTS) {
        if (!stages.includes(stage) || !company.stages.includes(stage)) continue;
        totalByStage[stage] += 1;
        if (!present) missingByStage[stage] += 1;
      }
      if (!present) missingCompanies.push(company);
    }

    // A company on two lists is counted once here but weighted by its best list below.
    const priority = STAGE_LISTS.reduce(
      (sum, stage) =>
        stages.includes(stage)
          ? sum + missingByStage[stage] * STAGE_WEIGHT[stage] * check.weight
          : sum,
      0,
    );

    const missingTotal = missingCompanies.length;
    const inScopeTotal = inScope.length;

    return {
      check,
      missingByStage,
      totalByStage,
      missingTotal,
      inScopeTotal,
      coveragePct: inScopeTotal === 0 ? 100 : ((inScopeTotal - missingTotal) / inScopeTotal) * 100,
      priority,
      missingCompanies: sortByStageImportance(missingCompanies),
    };
  });

  const sorted = [...checks].sort((a, b) => {
    switch (sort) {
      case "coverage":
        return a.coveragePct - b.coveragePct;
      case "missing":
        return b.missingTotal - a.missingTotal;
      case "label":
        return a.check.label.localeCompare(b.check.label);
      default:
        return b.priority - a.priority;
    }
  });

  const populatedPairs = checks.reduce((sum, c) => sum + (c.inScopeTotal - c.missingTotal), 0);
  const allPairs = checks.reduce((sum, c) => sum + c.inScopeTotal, 0);

  return {
    checks: sorted,
    total: inScope.length,
    overallCoveragePct: allPairs === 0 ? 100 : (populatedPairs / allPairs) * 100,
    stagesIncluded: [...stages],
  };
}

/** Portfolio gaps first — those are the ones worth someone's afternoon. */
function sortByStageImportance(companies: StagedCompany[]): StagedCompany[] {
  const rank = (c: StagedCompany) => Math.max(...c.stages.map((s) => STAGE_WEIGHT[s]), 0);
  return [...companies].sort(
    (a, b) => rank(b) - rank(a) || (a.name ?? "").localeCompare(b.name ?? ""),
  );
}
