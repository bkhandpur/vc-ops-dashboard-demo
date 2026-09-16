/**
 * Portfolio investor cross-check — our own Portfolio list against the enrichment
 * provider's investor records. Pure, isomorphic, deterministic.
 *
 * ⚠️  READ-ONLY COMPARISON. It surfaces disagreements for a human to resolve and
 * auto-corrects neither system. Neither source is treated as authoritative: a company we
 * hold that the provider does not credit us on could be a provider gap (they only see
 * publicly reported rounds) *or* a CRM error, and this view says exactly that rather
 * than picking a side.
 *
 * ── WHY THIS RESOLVES COMPANIES DIRECTLY, NOT VIA A SAVED SEARCH ─────────────
 * The obvious implementation is to read the team's existing saved search of portfolio
 * companies and diff it. Two measured reasons that does not work:
 *
 * 1. **The saved search filters on the wrong name.** The provider's canonical name for
 *    the firm differs from the string the search was built with, so the search
 *    under-reports us — silently, with a plausible-looking count. Aliases are matched
 *    directly here instead; a search whose filter you do not control is not a source of
 *    truth about your own portfolio.
 * 2. **It is a multi-fund search.** Its results mix several other funds' portfolios in
 *    with ours, so it cannot answer "which of OUR holdings does the provider credit us
 *    on" without re-filtering anyway.
 *
 * So the cross-check resolves each Portfolio company directly by domain and matches the
 * alias list against that company's own investor list. Precise, bounded at one call per
 * holding, and immune to the naming problem.
 *
 * Measured against the synthetic dataset: 34 of 34 resolved, 30 confirmed, 4 not
 * credited. The three-state outcome matters — "not credited" and "could not resolve"
 * are different problems with different fixes, and collapsing them would hide the
 * second inside the first.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { StagedCompany } from "./aggregate";

export type CrossCheckStatus = "confirmed" | "not-credited" | "unresolved";

export interface CrossCheckRow {
  company: StagedCompany;
  status: CrossCheckStatus;
  /** Investor names the provider lists, for the "not-credited" rows. */
  enrichedInvestors: string[];
  /** the provider's own name for the company, when it differs from the CRM's. */
  enrichmentName: string | null;
}

export interface CrossCheckReport {
  rows: CrossCheckRow[];
  confirmed: number;
  notCredited: number;
  unresolved: number;
  total: number;
}

/**
 * The enrichment provider side of the comparison, as carried in the cached snapshot. Deliberately
 * narrow — the cross-check needs nothing else, and a wide shape would bloat the cache.
 */
export interface EnrichedInvestorFact {
  /** the CRM recordId, the join key. */
  recordId: string;
  resolved: boolean;
  weAreCredited: boolean;
  investors: string[];
  enrichmentName: string | null;
}

export function buildCrossCheck(
  portfolio: readonly StagedCompany[],
  facts: readonly EnrichedInvestorFact[],
): CrossCheckReport {
  const byId = new Map(facts.map((f) => [f.recordId, f]));

  const rows: CrossCheckRow[] = portfolio.map((company) => {
    const fact = byId.get(company.recordId);
    const status: CrossCheckStatus = !fact?.resolved
      ? "unresolved"
      : fact.weAreCredited
        ? "confirmed"
        : "not-credited";
    return {
      company,
      status,
      enrichedInvestors: fact?.investors ?? [],
      enrichmentName: fact?.enrichmentName ?? null,
    };
  });

  // Discrepancies first — this is a view about disagreements, so a clean row is the
  // least interesting thing on the page.
  const rank: Record<CrossCheckStatus, number> = {
    "not-credited": 0,
    unresolved: 1,
    confirmed: 2,
  };
  rows.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (a.company.name ?? "").localeCompare(b.company.name ?? ""),
  );

  return {
    rows,
    confirmed: rows.filter((r) => r.status === "confirmed").length,
    notCredited: rows.filter((r) => r.status === "not-credited").length,
    unresolved: rows.filter((r) => r.status === "unresolved").length,
    total: rows.length,
  };
}
