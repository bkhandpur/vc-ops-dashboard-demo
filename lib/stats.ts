/**
 * Server-side half of the Statistics feature: read, cache, and hand a plain snapshot to
 * the UI. The aggregation maths lives in lib/aggregate.ts so the client can re-run it
 * instantly when filters change and the chart and the table cannot disagree.
 *
 * Page loads read the cache. It is rebuilt by
 * the top-bar Refresh button, the manual digest run, and the cron entry point, all of
 * which go through `refreshAllSnapshots()`.
 */

import "server-only";

import { getCompaniesInList, type Company } from "./crm";
import { cacheGet, cacheSet, envelope, type Cached } from "./cache";
import { CACHE_KEYS, STAGE_LISTS, type StageKey } from "./constants";
import type { StagedCompany } from "./aggregate";

export type { StagedCompany } from "./aggregate";

export interface StatsSnapshot {
  companies: StagedCompany[];
  /** Entry counts per list, BEFORE de-duplication across lists. */
  counts: Record<StageKey, number>;
}

/**
 * Return the first populated summary and its source field.
 */
function pickSummary(company: Company): { summary: string | null; summarySource: string | null } {
  const candidates: [string | null, string][] = [
    [company.productOverview, "product_overview"],
    [company.companySummary, "business_summary"],
    [company.description, "description"],
    [company.description2, "description_enriched"],
  ];
  for (const [value, source] of candidates) {
    if (value) return { summary: value, summarySource: source };
  }
  return { summary: null, summarySource: null };
}

/** Every company on Pipeline / Portfolio / Archive, with cross-list duplicates merged. */
export async function buildStatsSnapshot(): Promise<StatsSnapshot> {
  const perStage = await Promise.all(
    STAGE_LISTS.map(async (stage) => [stage, await getCompaniesInList(stage)] as const),
  );

  const byId = new Map<string, StagedCompany>();
  const counts = { pipeline: 0, portfolio: 0, archive: 0 } satisfies Record<StageKey, number>;

  for (const [stage, companies] of perStage) {
    counts[stage] = companies.length;
    for (const company of companies) {
      const existing = byId.get(company.recordId);
      if (existing) {
        // First list wins for entry-level values. STAGE_LISTS is ordered
        // pipeline → portfolio → archive, so a company on both Pipeline and Archive
        // keeps its Pipeline entry — the live one, and the only list carrying `deal_stage`
        // and `product_overview`. Portfolio has no substantive list attributes at all,
        // so nothing is lost by preferring Pipeline over it.
        if (!existing.stages.includes(stage)) existing.stages.push(stage);
        continue;
      }
      byId.set(company.recordId, {
        recordId: company.recordId,
        name: company.name,
        theme: company.theme,
        canonicalSector: company.canonicalSector,
        subSectors: company.subSectors,
        rounds: company.rounds,
        stages: [stage],
        logoUrl: company.logoUrl,
        fundingRaisedUsd: company.fundingRaisedUsd,
        description: company.description,
        // `domains_backup` covers 59% of Pipeline where `domains` itself reaches 82% — the
        // two together reach 93%, which is meaningfully better than either alone, and the
        // domain is both the upsert key and the only key enrichment can resolve on.
        domains: company.domains.length
          ? company.domains
          : company.domainsBackup
            ? [company.domainsBackup]
            : [],
        // Prefer the list-entry `hq_city` (94% Pipeline) over `hq_location` (7%). This
        // one line is the whole Phase 2b correction.
        location: company.city ?? company.location,
        // Prefer the exact headcount (39/94/73) over the bucket (26/53/44), and render
        // it as a string so one field can carry either an exact count or a band. The
        // consumer shows what it is given rather than pretending both are the same kind
        // of number.
        employeeRange:
          company.numberOfEmployees !== null
            ? String(company.numberOfEmployees)
            : company.employeeRange,
        estimatedArr: company.estimatedArr,
        // Prefer `founded_year` (61/85/94) over parsing `founded_on` (23/62/53).
        yearFounded:
          company.yearFounded ??
          (company.foundationDate ? new Date(company.foundationDate).getFullYear() : null),
        createdAt: company.createdAt,
        pipelineStage: company.pipelineStage,
        portfolioStatus: company.portfolioStatus,
        // The winner and its provenance are stored together, so no consumer has to
        // guess which link in the chain supplied the text.
        ...pickSummary(company),
        primaryRelationships: company.primaryRelationships,
        linkedin: company.linkedin,
        googleFolder: company.googleFolder,
        enrichedFundingUsd: company.enrichedFundingUsd,
        teamStructure: company.teamStructure,
        investmentThemes: company.investmentThemes,
        dealType: company.dealType,
        vehicle: company.vehicle,
        raisingLowM: company.raisingLowM,
        raisingHighM: company.raisingHighM,
        valuationText: company.valuationText,
        lastFundingEur: company.lastFundingEur,
        industry: company.industry,
        categories: company.categories,
        clientFocus: company.clientFocus,
        ownershipTypes: company.ownershipTypes,
        headcountGrowth: company.headcountGrowth,
        webTrafficGrowth: company.webTrafficGrowth,
        headcount: company.enrichedHeadcount,
        twitter: company.twitter,
        addedToListAt: company.addedToListAt,
        connectionUser: company.connectionUser,
        connectionStrength: company.connectionStrength,
        connectionScore: company.connectionScore,
        teamRecordIds: company.teamRecordIds,
      });
    }
  }

  return { companies: [...byId.values()], counts };
}

/** Cached snapshot, or null if nothing has been computed yet. */
export function readCachedSnapshot(): Promise<Cached<StatsSnapshot> | null> {
  return cacheGet<Cached<StatsSnapshot>>(CACHE_KEYS.stats);
}

/**
 * Read the cache, building it once if it is empty.
 *
 * Build the first local snapshot when the cache is empty.
 * implicitly.
 *
 * Here the source is a local file, so the same computation is a few milliseconds of
 * pure work against data that already ships with the process. On serverless the cache
 * backend is per-instance memory, so without this a visitor landing on a cold instance
 * would be shown an empty dashboard and a button — which would read as broken.
 *
 * The architectural rule is untouched, and worth stating precisely: page loads never
 * call an external service. They still don't. There is no external service.
 */
export async function readOrBuildSnapshot(): Promise<Cached<StatsSnapshot>> {
  const cached = await readCachedSnapshot();
  if (cached) return cached;
  return refreshStatsSnapshot();
}

/** Recompute and cache. Reached only through `refreshAllSnapshots()`. */
export async function refreshStatsSnapshot(): Promise<Cached<StatsSnapshot>> {
  const snapshot = await buildStatsSnapshot();
  const wrapped = envelope(snapshot);
  await cacheSet(CACHE_KEYS.stats, wrapped);
  return wrapped;
}
