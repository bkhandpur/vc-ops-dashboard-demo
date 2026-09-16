/**
 * One place that knows what "refresh the caches" means.
 *
 * There are three triggers — the top-bar Refresh button, the manual "Run diff now"
 * button, and the cron entry point — and every one of them must end with every cached
 * view in sync. When each call site listed the snapshots itself, adding a new one meant
 * remembering three edits, and the Statistics cache was left stale exactly that way.
 * Adding a snapshot now means adding it here, once.
 *
 * Still a plain deterministic data pipeline: read, aggregate, store. No decisions, no
 * model, no writes to any record.
 */

import "server-only";

import { enrichmentProgress, refreshEnrichmentSnapshot } from "./enrichment-snapshot";
import { refreshPeopleSnapshot } from "./people";
import { refreshStatsSnapshot } from "./stats";

export interface RefreshResult {
  generatedAt: string;
  companies: number;
  stealthFounders: number;
  coInvestors: number;
  counts: Record<string, number>;
  /** Enrichment. null when the layer is unavailable or its slice failed. */
  enrichment: {
    generatedAt: string;
    companies: number;
    founders: number;
    complete: boolean;
    pct: number;
  } | null;
}

export async function refreshAllSnapshots(): Promise<RefreshResult> {
  // Sequential rather than parallel. Against the live API both passes walked the same
  // rate-limited lists, and running them together doubled the burst for a wall-clock win
  // not worth having on a job that already took tens of seconds. Kept sequential here
  // because the ordering below is a real dependency, not a preference.
  const stats = await refreshStatsSnapshot();
  const people = await refreshPeopleSnapshot();

  /**
   * Enrichment goes LAST and is allowed to fail.
   *
   * It reads the two snapshots above, so it has to run after them. It was also the
   * heaviest and least reliable leg by an order of magnitude. Letting it throw here
   * would mean a provider outage takes down the Statistics refresh with it — so its
   * failure is caught, logged, and reported as `enrichment: null`. The previous
   * enrichment snapshot simply stays cached, and the UI keeps showing it with its own
   * older timestamp rather than blanking the panels that depend on it.
   */
  let enrichment: RefreshResult["enrichment"] = null;
  try {
    const result = await refreshEnrichmentSnapshot();
    if (result) {
      const progress = enrichmentProgress(result.data);
      enrichment = {
        generatedAt: result.generatedAt,
        companies: result.data.companies.length,
        founders: result.data.founders.length,
        complete: result.data.complete,
        pct: progress.pct,
      };
    }
  } catch (err) {
    console.error("[refresh] enrichment failed; the CRM snapshots are unaffected", err);
  }

  return {
    generatedAt: stats.generatedAt,
    companies: stats.data.companies.length,
    stealthFounders: people.data.stealthFounders.length,
    coInvestors: people.data.coInvestors.length,
    counts: stats.data.counts,
    enrichment,
  };
}
