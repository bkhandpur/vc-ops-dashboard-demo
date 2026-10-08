/**
 * Seed ten weekly digest snapshots so the Trends view has useful demo history. Figures
 * are derived from the current synthetic snapshot with deterministic scale factors.
 */

import "server-only";
import { SAMPLE_REFERENCE_DATE } from "./demo-clock";

import type { StagedCompany } from "./aggregate";
import { cacheGet } from "./cache";
import { CACHE_KEYS, STAGE_LISTS, UNCLASSIFIED, type StageKey } from "./constants";
import { computeHealth } from "./health";
import { listDigests, saveDigest, type Digest, type DigestMetrics } from "./digest";
import { readOrBuildSnapshot } from "./stats";

const WEEKS = 10;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How much smaller the book was N weeks ago, as a fraction of today.
 *
 * Pipeline grows fastest (it is the top of the funnel), Portfolio barely moves (a fund
 * makes a handful of investments a year, not a handful a week), and Archive grows steadily
 * because that is where the Pipeline drains to. Getting these relative rates wrong would
 * produce charts that are technically populated and obviously nonsense to anyone who has
 * looked at a real book.
 */
const WEEKLY_GROWTH: Record<StageKey, number> = {
  pipeline: 0.012,
  portfolio: 0.004,
  archive: 0.006,
};

function scaleFor(stage: StageKey, weeksAgo: number): number {
  return 1 / (1 + WEEKLY_GROWTH[stage] * weeksAgo);
}

function metricsFor(companies: StagedCompany[], weeksAgo: number): DigestMetrics {
  const totals = {} as Record<StageKey, number>;
  const themeMix = {} as Record<StageKey, Record<string, number>>;
  const sectorCoverage = {} as Record<StageKey, { covered: number; total: number }>;

  for (const stage of STAGE_LISTS) {
    const onStage = companies.filter((c) => c.stages.includes(stage));
    const scale = scaleFor(stage, weeksAgo);
    // Take a deterministic prefix rather than a random sample, so the same week always
    // produces the same numbers and a diff to the seeded history is reviewable.
    const kept = onStage.slice(0, Math.max(1, Math.round(onStage.length * scale)));

    const mix: Record<string, number> = {};
    let covered = 0;
    for (const company of kept) {
      const theme = company.theme ?? UNCLASSIFIED;
      mix[theme] = (mix[theme] ?? 0) + 1;
      if (company.canonicalSector) covered += 1;
    }

    totals[stage] = kept.length;
    themeMix[stage] = mix;
    sectorCoverage[stage] = { covered, total: kept.length };
  }

  // Apply a small deterministic improvement across the seeded window.
  const today = computeHealth(companies, ["pipeline", "portfolio"]).overallCoveragePct;
  const healthPct = Math.max(0, Math.round(today - weeksAgo * 1.4));

  return { totals, themeMix, sectorCoverage, healthPct };
}

function formatDay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/**
 * Write the seeded history if — and only if — no digests exist yet.
 *
 * Idempotent by that check rather than by overwriting: once a visitor has clicked "Run
 * diff now", their real digest is in the index and this must never clobber it.
 */
export async function ensureDigestHistory(): Promise<Digest[]> {
  const existing = await listDigests();
  if (existing.some((d) => d.id.startsWith("seeded-"))) return existing;

  const session = (await import("./demo-session")).demoSession();
  const saved = session.overlay;
  session.overlay = null;
  session.cache.clear();
  const snapshot = await readOrBuildSnapshot();
  session.overlay = saved;
  session.cache.clear();
  const companies = snapshot.data.companies;
  const now = Date.parse(SAMPLE_REFERENCE_DATE);

  const written: Digest[] = [];

  for (let weeksAgo = WEEKS - 1; weeksAgo >= 0; weeksAgo -= 1) {
    const at = new Date(now - weeksAgo * WEEK_MS).toISOString();
    const previousAt =
      weeksAgo === WEEKS - 1 ? null : new Date(now - (weeksAgo + 1) * WEEK_MS).toISOString();

    const metrics = metricsFor(companies, weeksAgo);
    const previousMetrics = weeksAgo === WEEKS - 1 ? null : metricsFor(companies, weeksAgo + 1);

    // What changed this week, derived from the two metric blocks rather than invented.
    const pipelineAdded = previousMetrics
      ? Math.max(0, metrics.totals.pipeline - previousMetrics.totals.pipeline)
      : 0;
    const newInPipeline = companies
      .filter((c) => c.stages.includes("pipeline"))
      .slice(Math.max(0, metrics.totals.pipeline - pipelineAdded), metrics.totals.pipeline)
      .map((c) => ({
        recordId: c.recordId,
        name: c.name,
        theme: c.theme ?? UNCLASSIFIED,
        canonicalSector: c.canonicalSector ?? UNCLASSIFIED,
        logoUrl: c.logoUrl,
      }));

    const themeShifts = previousMetrics
      ? Object.keys(metrics.themeMix.portfolio)
          .map((label) => {
            const previous = previousMetrics.themeMix.portfolio[label] ?? 0;
            const current = metrics.themeMix.portfolio[label] ?? 0;
            return { label, previous, current, delta: current - previous };
          })
          .filter((s) => s.delta !== 0)
      : [];

    const digest: Digest = {
      id: `seeded-${formatDay(at)}`,
      generatedAt: at,
      comparedTo: previousAt,
      periodLabel: previousAt
        ? `${formatDay(previousAt)} → ${formatDay(at)}`
        : `Baseline as of ${formatDay(at)}`,
      newInPipeline,
      stageMoves: [],
      newStealthFounders: [],
      newNotes: [],
      themeShifts,
      sectorShifts: [],
      totals: metrics.totals,
      // The oldest digest carries no metrics on purpose — see the header.
      metrics: weeksAgo === WEEKS - 1 ? undefined : metrics,
      summary: null,
      summaryGeneratedAt: null,
      summaryGeneratedBy: null,
    };

    await saveDigest(digest, false);
    written.push(digest);
  }

  const manual = Object.values((await import("./demo-session")).demoSession().digests) as Digest[];
  return [...manual, ...(await listDigests())].filter(
    (d, i, all) => all.findIndex((x) => x.id === d.id) === i,
  );
}

/** Whether anything is in the store at all, without writing. */
export async function hasDigests(): Promise<boolean> {
  const ids = (await cacheGet<string[]>(CACHE_KEYS.digestIndex)) ?? [];
  return ids.length > 0;
}
