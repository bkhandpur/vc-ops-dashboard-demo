/**
 * Local adapter for generated company and people enrichment data. Classification from
 * the main dataset remains authoritative.
 */

import "server-only";

import enrichmentSeed from "@/data/seed/enrichment.json";

interface EnrichmentSeed {
  companies: {
    domain: string;
    name: string;
    funding_total: number | null;
    headcount_current: number | null;
    headcount_growth_90d: number | null;
    web_traffic_growth_90d: number | null;
    funding_rounds: {
      round: string;
      announced: string;
      amount: number;
      currency: string;
      lead: string | null;
      investors: string[];
    }[];
    valuation: { value: number; source: string; is_potentially_stale: boolean } | null;
  }[];
  founders: {
    linkedin_url: string;
    name: string;
    highlights: string[];
    current_role: string;
    current_company: { name: string; domain: string | null; founded: number } | null;
    prior_companies: string[];
  }[];
}

const SEED = enrichmentSeed as unknown as EnrichmentSeed;

/**
 * Synthetic aliases used by generated syndicate records.
 */
// Kept in sync with the literal string pushed in scripts/generate-seed.ts.
const OUR_ALIASES = ["bellhaven capital", "bellhaven partners", "bellhaven"];

export function isOurFirm(investorName: string): boolean {
  return OUR_ALIASES.includes(investorName.trim().toLowerCase());
}

/**
 * There is no key to configure, so this is always true. Kept because the callers still
 * branch on it, and because `refreshAllSnapshots()` tolerating a missing enrichment
 * layer is a property worth keeping exercised rather than deleting.
 */
export function isEnrichmentConfigured(): boolean {
  return true;
}

export interface EnrichmentCompanyRaw {
  domain: string;
  name: string;
  fundingTotal: number | null;
  headcount: number | null;
  headcountGrowth90d: number | null;
  webTrafficGrowth90d: number | null;
  rounds: {
    round: string;
    announced: string;
    amount: number;
    currency: string;
    lead: string | null;
    investors: string[];
  }[];
  /**
   * The provider's valuation figure, with its own staleness flag.
   *
   * The flag is carried through to the UI rather than dropped. A valuation the provider
   * itself marks as possibly out of date is not the same fact as a current one, and a
   * figure quoted in a partner meeting without that qualifier is how a stale number
   * becomes a stated one.
   */
  valuation: { value: number; source: string; isPotentiallyStale: boolean } | null;
}

export interface EnrichmentPersonRaw {
  linkedinUrl: string;
  name: string;
  highlights: string[];
  currentRole: string;
  currentCompany: { name: string; domain: string | null; founded: number } | null;
  priorCompanies: string[];
}

const BY_DOMAIN = new Map(SEED.companies.map((c) => [c.domain.toLowerCase(), c]));
const BY_LINKEDIN = new Map(SEED.founders.map((f) => [f.linkedin_url.toLowerCase(), f]));

export async function getCompanyByDomain(domain: string): Promise<EnrichmentCompanyRaw | null> {
  const raw = BY_DOMAIN.get(domain.trim().toLowerCase());
  if (!raw) return null;
  return {
    domain: raw.domain,
    name: raw.name,
    fundingTotal: raw.funding_total,
    headcount: raw.headcount_current,
    headcountGrowth90d: raw.headcount_growth_90d,
    webTrafficGrowth90d: raw.web_traffic_growth_90d,
    rounds: raw.funding_rounds,
    valuation: raw.valuation
      ? {
          value: raw.valuation.value,
          source: raw.valuation.source,
          isPotentiallyStale: raw.valuation.is_potentially_stale,
        }
      : null,
  };
}

/**
 * Resolve a founder by profile URL — the matcher that actually works.
 *
 * See the header of lib/founder-launch.ts for the measurement that made this the primary
 * path and demoted the provider's own stealth feeds to corroborating evidence.
 */
export async function getPersonByLinkedIn(url: string): Promise<EnrichmentPersonRaw | null> {
  const raw = BY_LINKEDIN.get(url.trim().toLowerCase());
  if (!raw) return null;
  return {
    linkedinUrl: raw.linkedin_url,
    name: raw.name,
    highlights: raw.highlights,
    currentRole: raw.current_role,
    currentCompany: raw.current_company,
    priorCompanies: raw.prior_companies,
  };
}

/** Every investor name the provider credits on a company, deduplicated. */
export function investorNames(raw: EnrichmentCompanyRaw): string[] {
  return [...new Set(raw.rounds.flatMap((r) => r.investors))];
}

export function weAreCredited(raw: EnrichmentCompanyRaw): boolean {
  return investorNames(raw).some(isOurFirm);
}

/** Only the rounds our own firm appears in, for the syndicate detail panel. */
export function ourRounds(raw: EnrichmentCompanyRaw): EnrichmentCompanyRaw["rounds"] {
  return raw.rounds.filter((r) => r.investors.some(isOurFirm));
}
