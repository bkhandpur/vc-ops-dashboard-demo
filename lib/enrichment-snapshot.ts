/** Build a deterministic enrichment snapshot from local demo data. */

import "server-only";

import { cacheGet, cacheSet, envelope, type Cached } from "./cache";
import { CACHE_KEYS } from "./constants";
import { isStealthPlaceholder, type FounderLaunchSignal } from "./founder-launch";
import {
  getCompanyByDomain,
  getPersonByLinkedIn,
  investorNames,
  isEnrichmentConfigured,
  isOurFirm,
  ourRounds,
  weAreCredited,
} from "./enrichment";
import type { EnrichedInvestorFact } from "./portfolio-crosscheck";
import { readCachedPeople } from "./people";
import { readCachedSnapshot } from "./stats";

// ---------------------------------------------------------------------------
// Snapshot shape
// ---------------------------------------------------------------------------

/** Per-round syndicate detail. */
export interface SyndicateRound {
  announcementDate: string | null;
  roundType: string | null;
  amount: number | null;
  currency: string | null;
  investors: { name: string; isLead: boolean; isOurFirm: boolean }[];
}

export interface EnrichedCompanyFact {
  /** Local record id used to join the snapshots. */
  recordId: string;
  enrichmentName: string | null;
  headcount: number | null;
  headcountGrowth90d: number | null;
  webTrafficGrowth90d: number | null;
  /** Generated rounds used by the syndicate view. */
  ourRounds: SyndicateRound[];
  investors: string[];
  weAreCredited: boolean;
  leadershipPriorCompanies: string[];
  /** Carried with its staleness flag intact — see the note in lib/enrichment.ts. */
  valuation: { value: number; source: string; isPotentiallyStale: boolean } | null;
}

export interface EnrichmentSnapshot {
  companies: EnrichedCompanyFact[];
  founders: FounderLaunchSignal[];
  investorFacts: EnrichedInvestorFact[];
  companyAttempted: number;
  founderAttempted: number;
  /** False while a pass is part-way through. The UI says so rather than implying done. */
  complete: boolean;
  passStartedAt: string;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export async function refreshEnrichmentSnapshot(): Promise<Cached<EnrichmentSnapshot> | null> {
  if (!isEnrichmentConfigured()) return null;

  const passStartedAt = new Date().toISOString();
  const [stats, people] = await Promise.all([readCachedSnapshot(), readCachedPeople()]);

  // It reads both CRM snapshots, so it structurally cannot run first. That ordering is
  // enforced by `refreshAllSnapshots()`, not by hope.
  const companies = stats?.data.companies ?? [];
  const founders = people?.data.stealthFounders ?? [];

  // Archive is excluded on purpose — see the cost note in the header.
  const inScope = companies.filter(
    (c) => c.stages.includes("pipeline") || c.stages.includes("portfolio"),
  );

  const companyFacts: EnrichedCompanyFact[] = [];
  const investorFacts: EnrichedInvestorFact[] = [];

  for (const company of inScope) {
    const domain = company.domains[0];
    // No domain, no resolution. The ceiling on this whole feature is domain coverage in
    // the CRM, not anything about the provider — worth stating wherever a coverage
    // figure from this snapshot is shown, or it reads as the provider being thin.
    if (!domain) continue;
    const raw = await getCompanyByDomain(domain);
    if (!raw) continue;

    companyFacts.push({
      recordId: company.recordId,
      enrichmentName: raw.name,
      headcount: raw.headcount,
      headcountGrowth90d: raw.headcountGrowth90d,
      webTrafficGrowth90d: raw.webTrafficGrowth90d,
      ourRounds: ourRounds(raw).map((round) => ({
        announcementDate: round.announced,
        roundType: round.round,
        amount: round.amount,
        currency: round.currency,
        investors: round.investors.map((name) => ({
          name,
          isLead: round.lead === name,
          isOurFirm: isOurFirm(name),
        })),
      })),
      investors: investorNames(raw),
      weAreCredited: weAreCredited(raw),
      leadershipPriorCompanies: [],
      valuation: raw.valuation,
    });

    if (company.stages.includes("portfolio")) {
      investorFacts.push({
        recordId: company.recordId,
        resolved: true,
        weAreCredited: weAreCredited(raw),
        investors: investorNames(raw),
        enrichmentName: raw.name,
      });
    }
  }

  // Portfolio companies we could not resolve at all are a THIRD state, recorded rather
  // than folded into "not credited". "The provider does not credit us" and "we could not
  // look it up" are different problems with different fixes, and collapsing them would
  // hide the second inside the first.
  for (const company of companies.filter((c) => c.stages.includes("portfolio"))) {
    if (investorFacts.some((f) => f.recordId === company.recordId)) continue;
    investorFacts.push({
      recordId: company.recordId,
      resolved: false,
      weAreCredited: false,
      investors: [],
      enrichmentName: null,
    });
  }

  const launchSignals: FounderLaunchSignal[] = [];
  for (const founder of founders) {
    if (!founder.linkedin) continue;
    const person = await getPersonByLinkedIn(founder.linkedin);
    if (!person) continue;

    const company = person.currentCompany;
    launchSignals.push({
      recordId: founder.recordId,
      providerPersonId: null,
      companyName: company?.name ?? null,
      providerCompanyId: null,
      // The current position is picked FOUNDER-first rather than by taking the first
      // current role: several founders hold an adviser or operator seat alongside the
      // thing they are actually building, and taking the first reports the side role.
      roleType: person.currentRole === "Founder" ? "FOUNDER" : "EMPLOYEE",
      title: person.currentRole,
      startDate: company ? `${company.founded}-01-01` : null,
      stillStealth: isStealthPlaceholder(company?.name),
      emergenceDate: null,
      previouslyKnownAs: [],
      highlights: person.highlights,
    });
  }

  const snapshot: EnrichmentSnapshot = {
    companies: companyFacts,
    founders: launchSignals,
    investorFacts,
    companyAttempted: inScope.length,
    founderAttempted: founders.length,
    complete: true,
    passStartedAt,
  };

  const wrapped = envelope(snapshot);
  await cacheSet(CACHE_KEYS.enrichment, wrapped);
  return wrapped;
}

export function readCachedEnrichment(): Promise<Cached<EnrichmentSnapshot> | null> {
  return cacheGet<Cached<EnrichmentSnapshot>>(CACHE_KEYS.enrichment);
}

/** See the note on `readOrBuildSnapshot()` in lib/stats.ts. */
export async function readOrBuildEnrichment(): Promise<Cached<EnrichmentSnapshot> | null> {
  const cached = await readCachedEnrichment();
  if (cached) return cached;
  return refreshEnrichmentSnapshot();
}

export function enrichmentProgress(snapshot: EnrichmentSnapshot): {
  done: number;
  total: number;
  pct: number;
} {
  const done = snapshot.companies.length + snapshot.founders.length;
  const total = snapshot.companyAttempted + snapshot.founderAttempted;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}
