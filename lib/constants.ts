/**
 * Identifiers, field slugs and cache keys for the synthetic dataset. All IDs and slugs
 * are demo values. Coverage comments are measured with `npm run coverage`.
 */

export type ParentObject = "companies" | "people";

export interface ListDef {
  key: string;
  name: string;
  listId: string;
  slug: string;
  parent: ParentObject;
}

/**
 * Human-readable demo list IDs.
 */
export const LISTS = {
  pipeline: {
    key: "pipeline",
    name: "Pipeline",
    listId: "demo-list-pipeline",
    slug: "pipeline",
    parent: "companies",
  },
  portfolio: {
    key: "portfolio",
    name: "Portfolio",
    listId: "demo-list-portfolio",
    slug: "portfolio",
    parent: "companies",
  },
  archive: {
    key: "archive",
    name: "Archive",
    listId: "demo-list-archive",
    slug: "archive",
    parent: "companies",
  },
  coInvestors: {
    key: "coInvestors",
    name: "Co-Investors",
    listId: "demo-list-co-investors",
    slug: "investor_network",
    parent: "people",
  },
  stealthFounders: {
    key: "stealthFounders",
    name: "Stealth Founders",
    listId: "demo-list-stealth-founders",
    slug: "stealth_watchlist",
    parent: "people",
  },
} as const satisfies Record<string, ListDef>;

export type ListKey = keyof typeof LISTS;

/** The three stages the Statistics page aggregates over. */
export const STAGE_LISTS = ["pipeline", "portfolio", "archive"] as const;
export type StageKey = (typeof STAGE_LISTS)[number];

export const STAGE_LABELS: Record<StageKey, string> = {
  pipeline: "Pipeline",
  portfolio: "Portfolio",
  archive: "Archive",
};

/** Field names used by generated company records. */
export const COMPANY_FIELDS = {
  name: "name",
  description: "description",
  domains: "domains",
  /** Generic flat enrichment tags — NOT the Statistics taxonomy. */
  categoryTags: "category_tags",

  /** Taxonomy level 1. Assigned upstream by a rules-based classifier, not by this app. */
  theme: "thesis_theme",
  /** Taxonomy level 2. */
  canonicalSector: "core_sector",
  /** Taxonomy level 3. UI label is "Sub-Sector". */
  subSector: "sub_sector",

  /** Read both generated round fields; writes use `round_current`. */
  round: "round_legacy",
  roundCurrent: "round_current",

  /** Generated total capital raised from all investors. */
  fundingRaised: "total_raised_usd",
  /** Bucketed ARR estimate. */
  estimatedArr: "arr_band",
  /** Generated logo URL. */
  logoUrl: "logo_url",

  /** Sparse legacy field kept so Data Health can demonstrate a gap. */
  warmIntroOwner: "warm_intro_owner",

  team: "team",
  /** Legacy location field. Prefer `hqCity`. */
  primaryLocation: "hq_location",
  /** Select range. Prefer `headcountExact`. */
  employeeRange: "headcount_band",
  /** Legacy date. Prefer `yearFounded`. */
  foundationDate: "founded_on",

  /** Sparse generated relationship-strength fields. */
  strongestConnectionUser: "top_connection_member",
  strongestConnectionStrength: "top_connection_strength",
  strongestConnectionScore: "top_connection_score",
  /** Optional generated record reference. */
  sourceOfIntroduction: "intro_source_ref",

  /** Free text showing who knows a generated company and how. */
  primaryRelationships: "relationship_notes",
  /** Generated business summary. */
  companySummary: "business_summary",
  /** Generated founder and executive bios. */
  teamStructure: "team_notes",
  /** 94/93/98. Link to the company's document folder. */
  googleFolder: "drive_folder_url",
  /** 66/97/66. */
  linkedin: "linkedin_url",
  /** 77/66/68. Multiselect, and a DIFFERENT taxonomy from `theme`. */
  investmentTheme: "investment_theme_tags",
  /** 100% on Portfolio. */
  portfolioStatus: "portfolio_status",
  /** 63% Pipeline. The raise being sought, in $M. */
  raisingLowM: "raise_target_low_m",
  /** 54/14/43. */
  raisingHighM: "raise_target_high_m",

  /** Prefer over `fundingRaised`. Enrichment-sourced: 70/45/78. */
  enrichedFunding: "enriched_total_raised_usd",
  /** Prefer over `foundationDate`. 59/86/92. */
  yearFounded: "founded_year",
  /** Prefer over `employeeRange`. 38/97/74. */
  numberOfEmployees: "headcount_exact",
  /** Numeric headcount from enrichment. 69/59/74. */
  enrichedHeadcount: "enriched_headcount",

  /**
   * ── SECOND CENSUS PASS ─────────────────────────────────────────────────────
   * Everything below cleared 40% on at least one of Pipeline or Portfolio and was
   * previously unused.
   *
   * Note how many of the best ones are Portfolio-heavy: a company gets enriched much
   * more thoroughly once it is invested in, so a field that looks thin on Pipeline can
   * be the best thing available on Portfolio (`industryTags` is 28/94). Judging a field
   * by one list is how you throw a good one away.
   */

  /** 53/45/7. e.g. "Co-Investment". */
  dealType: "deal_structure",
  /** 10/38/4. Angel / Fund I / SPV — which vehicle was used. */
  vehicle: "funding_vehicle",
  /** 28/14/20. Free text, e.g. "$7M post-money cap". */
  valuationText: "valuation_note",
  /** 26/93/65. Enrichment industry tags — NOT the taxonomy. */
  industry: "industry_tags",
  /** 29/72/56. b2b / b2c. */
  clientFocus: "client_focus",
  /** 25/48/50. e.g. "Venture-backed", "Bootstrapped". */
  ownershipTypes: "ownership_type",
  /** 20/66/37. Size of the most recent round, in EUR. */
  lastFundingEur: "last_round_eur",
  /** 18/45/74. Percent change in headcount. */
  headcountGrowth: "headcount_growth_pct",
  /** 14/62/71. Percent change in web traffic over 90d. */
  webTrafficGrowth: "web_traffic_growth_90d",
  /** 42/86/64. A SECOND description field, far better covered on Portfolio. */
  description2: "description_enriched",
  /** 61/28/8. Fallback when `domains` is empty — together they beat either alone. */
  domainsBackup: "domains_backup",
  twitter: "twitter_handle",

  /**
   * 0% on every record. Declared in the schema and never populated.
   *
   * This is the single most consequential empty field in the project: it is why every
   * chart in Statistics is sized by company count and says so, rather than by capital.
   * Left in the schema on purpose, so the gap is visible instead of forgotten.
   */
  amountInvested: "amount_invested_usd",
} as const;

/** Ordered weakest → strongest; select options arrive unordered. */
export const CONNECTION_STRENGTH_ORDER = [
  "Very weak",
  "Weak",
  "Good",
  "Strong",
  "Very strong",
] as const;

/**
 * ── LIST-ENTRY ATTRIBUTES ────────────────────────────────────────────────────
 * These live on the LIST ENTRY, not on the company record, and they are invisible to
 * an object-attribute query: you get them only by asking the list for its attributes,
 * and their values only from `entry_values` on a list-entry query.
 *
 * `getCompaniesInList()` / `getPeopleInList()` join these in.
 */
export const LIST_ENTRY_FIELDS = {
  /** Read through `readTextOrLocation()` because generated lists use two value shapes. */
  city: "hq_city",
  /** Pipeline status field. */
  stage: "deal_stage",
  productOverview: "product_overview",
  companyName: "archived_name",
  nextSteps: "next_steps",
  revisitPriority: "revisit_priority",
} as const;

/** Generated co-investor list-entry fields. */
export const CO_INVESTOR_ENTRY_FIELDS = {
  fundFirm: "fund_firm",
  /** Free text, normalized through `cleanText()`. */
  checkSizeRange: "check_size_range",
  /** Comma-separated generated company names. */
  dealsCoInvested: "deals_co_invested",
  warmIntroOwner: "warm_intro_owner",
} as const;

/** UI labels for the taxonomy levels (slug ≠ label for sub-sector). */
export const FIELD_LABELS: Record<string, string> = {
  [COMPANY_FIELDS.theme]: "Theme",
  [COMPANY_FIELDS.canonicalSector]: "Canonical Sector",
  [COMPANY_FIELDS.subSector]: "Sub-Sector",
  [COMPANY_FIELDS.roundCurrent]: "Investment Round",
};

/** Field names used by the generated people records. */
export const PEOPLE_FIELDS = {
  name: "name",
  emailAddresses: "email_addresses",
  description: "description",
  linkedin: "linkedin_url",
  linkedinCompany: "linkedin_company",
  linkedinPosition: "linkedin_position",
  highlights: "person_highlights",
  /** Generated multiselect used for queue grouping. */
  sourcedBy: "sourced_by",
  reachedOut: "reached_out",
  avatarUrl: "avatar_url",
  jobTitle: "job_title",
  primaryLocation: "home_location",
  stageFocus: "stage_focus",
  sectorThesisFocus: "thesis_focus",
  currentLocation: "current_location",
  education: "education",
  /** Handle only, not a URL. */
  twitter: "twitter_handle",
  /** Source profile for the generated row. */
  sourceDocumentUrl: "source_profile_url",
  /** Optional company link confirmed one record at a time. */
  connectedPortco: "launched_company_ref",
} as const;

export const PEOPLE_LISTS = ["stealthFounders", "coInvestors"] as const;
export type PeopleListKey = (typeof PEOPLE_LISTS)[number];

/** Fallback bucket label used when a taxonomy field is empty on a record. */
export const UNCLASSIFIED = "Unclassified";

/** Canonical display order for rounds (select options arrive unordered). */
export const ROUND_ORDER = [
  "Pre-Seed",
  "Seed",
  "Seed Extension",
  "Bridge",
  "Series A",
  "Series B",
  "Series C",
  "Series D",
  "Growth",
] as const;

import seedVersion from "@/data/seed/version.json";

/**
 * A content hash of the seed, regenerated by `npm run seed`.
 *
 * Folded into every cache key below so that changing the data invalidates every cached
 * snapshot automatically. See the note in scripts/generate-seed.ts for why: the
 * hand-maintained version discipline covers a change in a snapshot's SHAPE but not a
 * change in its CONTENT, and a stale cache surviving a seed regeneration produces pages
 * that are internally consistent and describe data that no longer exists — which is
 * exactly the kind of wrong that gets believed.
 */
const SEED = (seedVersion as { version: string }).version;

export const CACHE_KEYS = {
  /**
   * Versioned keys. The hand-written version is bumped whenever a snapshot's SHAPE
   * changes, so a stale payload is ignored and rebuilt instead of deserialising into an
   * object with missing properties. Every snapshot-shape change in this project's
   * history came with a bump; that is why none of them produced a half-populated page.
   *
   * The seed hash covers the other axis — the data itself changing underneath a cache
   * whose shape is unchanged.
   */
  stats: `demo:stats:v5:${SEED}`,
  people: `demo:people:v3:${SEED}`,
  enrichment: `demo:enrichment:v1:${SEED}`,
  digestIndex: `demo:digest:index:v1:${SEED}`,
  digest: (id: string) => `demo:digest:${SEED}:${id}`,
  snapshot: `demo:digest:snapshot:v1:${SEED}`,
  attributes: `demo:attributes:v1:${SEED}`,
} as const;

/**
 * Route synthetic record links to local detail views.
 */
export function crmRecordUrl(object: ParentObject, recordId: string): string {
  return `/record/${object}/${recordId}`;
}
