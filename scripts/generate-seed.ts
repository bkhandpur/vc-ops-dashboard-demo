/**
 * Deterministic generator for the synthetic dataset.
 *
 * Run with `npm run seed`. Output goes to data/seed/*.json, which IS committed — the
 * app has to boot with zero setup on a stranger's laptop, and a reviewer should be able
 * to read the data as easily as the code.
 *
 * The generator covers the edge cases exercised by the interface:
 *
 *   1. A few fields are ~100% populated, a useful band sit at 40–90%, and several
 *      obvious-looking ones are at 0–5%. The Data Health page and the "don't build on a
 *      thin field" rule only make sense against a distribution like that.
 *   2. The best-covered location field and the entire co-investment linkage exist ONLY
 *      on the list entry, invisible to a query against the object. This is the single
 *      on the list entry, which exercises the join in lib/crm.ts.
 *   3. One field (`hq_city`) is emitted as `text` on one list and `location` on another,
 *      same slug, so `readTextOrLocation()` is load-bearing rather than decorative.
 *   4. Enrichment placeholders arrive as the literal string "unavailable" rather than
 *      as absent values, so `cleanText()` has to normalise at the boundary. This is why
 *      one field reads 100% raw and 31% useful.
 *   5. Some values carry `active_until` timestamps (superseded history), so reading
 *      "the current value" is a filter and not `values[0]`.
 *   6. A cluster of records shares one `created_at`, reproducing a bulk CRM import —
 *      which is why nothing in this app calls that date "deal age".
 *   7. A handful of text fields contain U+FFFD replacement characters for Data Health.
 *
 * Everything is generated from a fixed seed, so the committed JSON is reproducible and
 * a diff to it is reviewable.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ARCHIVE_CITIES, ARR_BANDS, CATEGORY_TAGS, CHECK_SIZES, CITIES, CLIENT_FOCUS,
  COMPANY_SUFFIXES, DEAL_STRUCTURES, EDUCATION, GIVEN_NAMES, HEADCOUNT_BANDS,
  HIGHLIGHT_TAGS, INDUSTRY_TAGS, INVESTMENT_THEME_TAGS, NAME_ENDINGS, NAME_PREFIXES,
  OWNERSHIP_TYPES, PIPELINE_STAGES, PORTFOLIO_STATUSES, PRIOR_ROLES, STAGE_FOCUS,
  SURNAME_ENDINGS, TAXONOMY, TEAM_MEMBERS, THESIS_TERMS, VEHICLES,
} from "./vocabulary.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "data", "seed");

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

/** mulberry32 — small, fast, and good enough that the data does not look striped. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(20260821);

function chance(pct: number): boolean {
  return rng() * 100 < pct;
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

function pickSome<T>(items: readonly T[], min: number, max: number): T[] {
  const n = min + Math.floor(rng() * (max - min + 1));
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < n && pool.length > 0; i += 1) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
  }
  return out;
}

function intBetween(low: number, high: number): number {
  return low + Math.floor(rng() * (high - low + 1));
}

// ---------------------------------------------------------------------------
// Raw value shapes
//
// Attributes use arrays of timestamped value objects.
// timestamped value objects, and the current value is the one whose `active_until` is
// null. Keeping that shape means lib/crm.ts contains the same read helpers the real
// integration needed, rather than trivially reading a flat object.
// ---------------------------------------------------------------------------

type RawValue = Record<string, unknown> & { active_from: string; active_until: string | null };

const T0 = "2026-01-06T09:00:00.000Z";

function text(value: string): RawValue[] {
  return [{ active_from: T0, active_until: null, value }];
}
function num(value: number): RawValue[] {
  return [{ active_from: T0, active_until: null, value }];
}
function currency(value: number): RawValue[] {
  return [{ active_from: T0, active_until: null, currency_value: value, currency_code: "USD" }];
}
function select(title: string): RawValue[] {
  return [{ active_from: T0, active_until: null, option: { title } }];
}
function multi(titles: string[]): RawValue[] {
  return titles.map((title) => ({ active_from: T0, active_until: null, option: { title } }));
}
function status(title: string): RawValue[] {
  return [{ active_from: T0, active_until: null, status: { title } }];
}
function checkbox(value: boolean): RawValue[] {
  return [{ active_from: T0, active_until: null, value }];
}
function domain(d: string): RawValue[] {
  return [{ active_from: T0, active_until: null, domain: d }];
}
function location(locality: string, region: string | null): RawValue[] {
  return [{ active_from: T0, active_until: null, locality, region, country_code: null }];
}
function actor(id: string): RawValue[] {
  return [{ active_from: T0, active_until: null, referenced_actor_id: id, referenced_actor_type: "workspace-member" }];
}
function recordRef(id: string): RawValue[] {
  return [{ active_from: T0, active_until: null, target_record_id: id, target_object: "companies" }];
}

/**
 * A value that has been superseded once. The old entry carries an `active_until`, so
 * anything reading `values[slug][0]` instead of filtering on `active_until === null`
 * gets a stale answer — which is exactly the bug the read helpers exist to prevent.
 */
function withHistory(current: RawValue[], previous: Record<string, unknown>): RawValue[] {
  return [
    { active_from: "2025-11-02T09:00:00.000Z", active_until: T0, ...previous },
    ...current,
  ];
}

// ---------------------------------------------------------------------------
// Name generation
// ---------------------------------------------------------------------------

const usedCompanyNames = new Set<string>();

function companyName(): string {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const candidate = `${pick(NAME_PREFIXES)}${pick(NAME_ENDINGS)}${pick(COMPANY_SUFFIXES)}`;
    if (!usedCompanyNames.has(candidate)) {
      usedCompanyNames.add(candidate);
      return candidate;
    }
  }
  throw new Error("ran out of company names — widen the vocabulary");
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** `.example` is the IANA-reserved documentation TLD, so no domain here can resolve. */
function domainFor(name: string): string {
  return `${slugify(name)}.example`;
}

const usedPeopleNames = new Set<string>();

function personName(): string {
  for (let attempt = 0; attempt < 800; attempt += 1) {
    const candidate = `${pick(GIVEN_NAMES)} ${pick(NAME_PREFIXES)}${pick(SURNAME_ENDINGS)}`;
    if (!usedPeopleNames.has(candidate)) {
      usedPeopleNames.add(candidate);
      return candidate;
    }
  }
  throw new Error("ran out of people names — widen the vocabulary");
}

function firmName(): string {
  return `${pick(NAME_PREFIXES)}${pick(NAME_ENDINGS)} ${pick(["Capital", "Ventures", "Partners", "Growth", "Fund"])}`;
}

/**
 * Inject a U+FFFD replacement character the way the real records carry it — mid-word,
 * where a non-ASCII letter used to be. NOT reversible mojibake: there is no `â€™`-style
 * digraph to undo, the original bytes are simply gone.
 */
function corrupt(value: string): string {
  const index = value.search(/[aeiou](?!$)/i);
  if (index <= 0) return value;
  return `${value.slice(0, index)}�${value.slice(index + 1)}`;
}

// ---------------------------------------------------------------------------
// Taxonomy helpers
// ---------------------------------------------------------------------------

const THEMES = Object.keys(TAXONOMY);
const SECTORS_BY_THEME: Record<string, string[]> = Object.fromEntries(
  THEMES.map((theme) => [theme, Object.keys(TAXONOMY[theme]!)]),
);
const ALL_SUB_SECTORS = THEMES.flatMap((theme) =>
  Object.values(TAXONOMY[theme]!).flat(),
);

/** Themes are not uniform in a real book — one is always over-represented. */
const THEME_WEIGHTS: Record<string, number> = {
  "Care & Longevity": 0.44,
  "Work & Craft": 0.33,
  "Planet & Resources": 0.23,
};

function weightedTheme(): string {
  const roll = rng();
  let acc = 0;
  for (const theme of THEMES) {
    acc += THEME_WEIGHTS[theme] ?? 0;
    if (roll < acc) return theme;
  }
  return THEMES[0]!;
}

const ROUNDS = ["Pre-Seed", "Seed", "Seed Extension", "Bridge", "Series A", "Series B", "Series C", "Series D", "Growth"];

// ---------------------------------------------------------------------------
// Coverage profiles
//
// One object per list keeps the generated distributions readable and reproducible.
// ---------------------------------------------------------------------------

/**
 * Invented target distributions for the synthetic dataset. They create a useful mix of
 * complete and incomplete records for demonstrating fallback and cleanup states.
 */
interface Coverage {
  theme: number; canonicalSector: number; subSector: number;
  roundCurrent: number; roundLegacy: number;
  description: number; descriptionEnriched: number; companySummary: number;
  fundingRaised: number; enrichedFunding: number; arr: number; logo: number;
  primaryLocation: number; headcountBand: number; headcountExact: number;
  enrichedHeadcount: number; foundationDate: number; foundedYear: number;
  relationshipNotes: number; teamNotes: number; driveFolder: number; linkedin: number;
  investmentTheme: number; portfolioStatus: number; raiseLow: number; raiseHigh: number;
  dealType: number; vehicle: number; valuation: number; industry: number;
  categoryTags: number; clientFocus: number; ownership: number; lastRoundEur: number;
  headcountGrowth: number; webTrafficGrowth: number; domainsBackup: number;
  twitter: number; connection: number;
}

const COVERAGE: Record<"pipeline" | "portfolio" | "archive", Coverage> = {
  pipeline: {
    theme: 97, canonicalSector: 84, subSector: 90,
    roundCurrent: 79, roundLegacy: 0,
    description: 61, descriptionEnriched: 43, companySummary: 88,
    fundingRaised: 44, enrichedFunding: 74, arr: 41, logo: 51,
    primaryLocation: 9, headcountBand: 27, headcountExact: 34,
    enrichedHeadcount: 61, foundationDate: 19, foundedYear: 59,
    relationshipNotes: 87, teamNotes: 94, driveFolder: 96, linkedin: 60,
    investmentTheme: 77, portfolioStatus: 0, raiseLow: 68, raiseHigh: 59,
    dealType: 53, vehicle: 5, valuation: 33, industry: 24,
    categoryTags: 42, clientFocus: 25, ownership: 22, lastRoundEur: 18,
    headcountGrowth: 17, webTrafficGrowth: 9, domainsBackup: 64,
    twitter: 17, connection: 2,
  },
  portfolio: {
    theme: 99, canonicalSector: 52, subSector: 96,
    roundCurrent: 52, roundLegacy: 0,
    description: 95, descriptionEnriched: 91, companySummary: 84,
    fundingRaised: 61, enrichedFunding: 45, arr: 74, logo: 92,
    primaryLocation: 5, headcountBand: 63, headcountExact: 93,
    enrichedHeadcount: 53, foundationDate: 58, foundedYear: 88,
    relationshipNotes: 66, teamNotes: 45, driveFolder: 85, linkedin: 91,
    investmentTheme: 69, portfolioStatus: 100, raiseLow: 28, raiseHigh: 21,
    dealType: 55, vehicle: 42, valuation: 11, industry: 88,
    categoryTags: 81, clientFocus: 66, ownership: 69, lastRoundEur: 64,
    headcountGrowth: 39, webTrafficGrowth: 45, domainsBackup: 28,
    twitter: 39, connection: 2,
  },
  archive: {
    theme: 92, canonicalSector: 71, subSector: 88,
    roundCurrent: 64, roundLegacy: 0,
    description: 69, descriptionEnriched: 66, companySummary: 41,
    fundingRaised: 33, enrichedFunding: 79, arr: 27, logo: 39,
    primaryLocation: 3, headcountBand: 47, headcountExact: 73,
    enrichedHeadcount: 74, foundationDate: 51, foundedYear: 91,
    relationshipNotes: 22, teamNotes: 49, driveFolder: 97, linkedin: 68,
    investmentTheme: 71, portfolioStatus: 0, raiseLow: 49, raiseHigh: 41,
    dealType: 7, vehicle: 4, valuation: 18, industry: 61,
    categoryTags: 68, clientFocus: 53, ownership: 55, lastRoundEur: 38,
    headcountGrowth: 72, webTrafficGrowth: 70, domainsBackup: 6,
    twitter: 47, connection: 1,
  },
};

/** The one workspace-member id that every populated connection value points at. */
const THE_ONLY_CONNECTED_MEMBER = "demo-member-0000-0000-0000-000000000001";

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

interface Company {
  id: { record_id: string };
  created_at: string;
  values: Record<string, RawValue[]>;
}

type StageName = "pipeline" | "portfolio" | "archive";

interface Plan {
  recordId: string;
  name: string;
  domain: string;
  theme: string | null;
  sector: string | null;
  subSectors: string[];
  primaryStage: StageName;
  stages: StageName[];
}

const companies: Company[] = [];
const plans: Plan[] = [];

const PIPELINE_COUNT = 95;
const PORTFOLIO_COUNT = 29;
const ARCHIVE_COUNT = 340;
/** Portfolio companies that never left the Pipeline list. Keeps `stages` a real array. */
const ALSO_ON_PIPELINE = 9;

let companySeq = 0;

function buildCompany(primaryStage: StageName, alsoPipeline: boolean): Plan {
  companySeq += 1;
  const recordId = `cmp_${String(companySeq).padStart(4, "0")}`;
  const cov = COVERAGE[primaryStage];
  const name = companyName();
  const dom = domainFor(name);

  const theme = chance(cov.theme) ? weightedTheme() : null;
  const sectorPool = theme ? SECTORS_BY_THEME[theme]! : [];
  const sector = theme && chance(cov.canonicalSector) ? pick(sectorPool) : null;
  const subPool = theme && sector ? TAXONOMY[theme]![sector]! : ALL_SUB_SECTORS;
  const subSectors = chance(cov.subSector) ? pickSome(subPool, 1, 3) : [];

  const values: Record<string, RawValue[]> = {
    name: text(name),
  };

  /**
   * Not every record has a domain, and that matters more than it looks: the domain is
   * both the upsert matching key and the only key the enrichment provider can resolve
   * on. So domain coverage is the hard ceiling on every enrichment-derived figure in the
   * app — which is why `withoutDomain` is reported alongside those figures rather than
   * silently shrinking the denominator.
   */
  const domainCoverage = { pipeline: 84, portfolio: 97, archive: 79 }[primaryStage];
  if (chance(domainCoverage)) values["domains"] = domain(dom);

  if (theme) values["thesis_theme"] = select(theme);
  if (sector) values["core_sector"] = select(sector);
  if (subSectors.length) values["sub_sector"] = multi(subSectors);

  // Two round fields. The legacy one is empty on every record — kept in the seed
  // precisely so the "read both, write one" decision has something to be about.
  if (chance(cov.roundCurrent)) values["round_current"] = select(pick(ROUNDS));

  if (chance(cov.description)) values["description"] = text(`${name} builds tooling for ${pick(subPool).toLowerCase()}.`);
  if (chance(cov.descriptionEnriched)) values["description_enriched"] = text(`${name} is a ${pick(CATEGORY_TAGS).toLowerCase()} company operating in ${pick(INDUSTRY_TAGS).toLowerCase()}.`);
  if (chance(cov.companySummary)) {
    values["business_summary"] = text(
      `${name} sells into ${pick(["hospital systems", "mid-market operators", "public agencies", "national retailers", "regional utilities", "logistics carriers"])}. ` +
      `Revenue is ${pick(["subscription", "usage-based", "per-seat", "transaction-fee"])}, and the team is ${intBetween(4, 40)} people.`,
    );
  }

  if (chance(cov.fundingRaised)) values["total_raised_usd"] = currency(intBetween(3, 220) * 250_000);
  if (chance(cov.enrichedFunding)) values["enriched_total_raised_usd"] = currency(intBetween(3, 240) * 250_000);
  if (chance(cov.arr)) values["arr_band"] = select(pick(ARR_BANDS));
  if (chance(cov.logo)) values["logo_url"] = text(`/demo-logo/${recordId}.svg`);

  // The trap: an obvious-looking location field that nobody fills in. The real one
  // sits on the list entry, and is added below.
  if (chance(cov.primaryLocation)) values["hq_location"] = location(pick(CITIES).split(",")[0]!, null);

  if (chance(cov.headcountBand)) values["headcount_band"] = select(pick(HEADCOUNT_BANDS));
  if (chance(cov.headcountExact)) values["headcount_exact"] = num(intBetween(3, 900));
  if (chance(cov.enrichedHeadcount)) values["enriched_headcount"] = num(intBetween(3, 1200));
  if (chance(cov.foundationDate)) values["founded_on"] = text(`${intBetween(2012, 2025)}-0${intBetween(1, 9)}-1${intBetween(0, 9)}`);
  if (chance(cov.foundedYear)) values["founded_year"] = num(intBetween(2011, 2025));

  if (chance(cov.relationshipNotes)) {
    values["relationship_notes"] = text(
      `${pick(TEAM_MEMBERS)}${chance(45) ? `, ${pick(TEAM_MEMBERS)}` : ""} know the team; ` +
      `${pick(["intro via", "referral from", "met at a conference through", "warm intro from"])} ${personName()}, ${pick(PRIOR_ROLES)}.`,
    );
  }
  if (chance(cov.teamNotes)) {
    values["team_notes"] = text(
      `Founded by ${personName()} (${pick(PRIOR_ROLES)}) and ${personName()} (${pick(PRIOR_ROLES)}). ` +
      `${intBetween(2, 6)} of the first ${intBetween(6, 15)} hires came from the founders' prior company.`,
    );
  }
  if (chance(cov.driveFolder)) values["drive_folder_url"] = text(`https://files.example/folders/${recordId}`);
  if (chance(cov.linkedin)) values["linkedin_url"] = text(`https://social.example/company/${slugify(name)}`);
  if (chance(cov.investmentTheme)) values["investment_theme_tags"] = multi(pickSome(INVESTMENT_THEME_TAGS, 1, 3));
  if (primaryStage === "portfolio" && chance(cov.portfolioStatus)) values["portfolio_status"] = select(pick(PORTFOLIO_STATUSES));

  // A recorded 0 in a raise amount is not a raise — it means "not raising" or "never
  // filled in". Emitted here on purpose so formatRaise() has to treat 0 as absent.
  if (chance(cov.raiseLow)) values["raise_target_low_m"] = num(chance(28) ? 0 : intBetween(1, 25));
  if (chance(cov.raiseHigh)) values["raise_target_high_m"] = num(intBetween(3, 45));

  if (chance(cov.dealType)) values["deal_structure"] = multi(pickSome(DEAL_STRUCTURES, 1, 2));
  if (chance(cov.vehicle)) values["funding_vehicle"] = multi([pick(VEHICLES)]);
  if (chance(cov.valuation)) values["valuation_note"] = text(`$${intBetween(4, 60)}M ${pick(["post-money cap", "pre-money", "post-money"])}`);
  if (chance(cov.industry)) values["industry_tags"] = multi(pickSome(INDUSTRY_TAGS, 1, 3));
  if (chance(cov.categoryTags)) values["category_tags"] = multi(pickSome(CATEGORY_TAGS, 1, 3));
  if (chance(cov.clientFocus)) values["client_focus"] = multi([pick(CLIENT_FOCUS)]);
  if (chance(cov.ownership)) values["ownership_type"] = multi([pick(OWNERSHIP_TYPES)]);
  if (chance(cov.lastRoundEur)) values["last_round_eur"] = currency(intBetween(2, 90) * 250_000);
  if (chance(cov.headcountGrowth)) values["headcount_growth_pct"] = num(intBetween(-30, 140));
  if (chance(cov.webTrafficGrowth)) values["web_traffic_growth_90d"] = num(intBetween(-45, 210));
  if (chance(cov.domainsBackup)) values["domains_backup"] = text(`www.${dom}`);
  if (chance(cov.twitter)) values["twitter_handle"] = text(slugify(name).slice(0, 14));

  // Connection intelligence: 3% populated, and every populated row is the same
  // workspace member at "Very weak", because it is derived from calendar sync that
  // was never connected. The UI must report this as a settings gap, not a backlog.
  if (chance(cov.connection)) {
    values["top_connection_member"] = actor(THE_ONLY_CONNECTED_MEMBER);
    values["top_connection_strength"] = select("Very weak");
    values["top_connection_score"] = num(1.2 + rng() * 0.8);
  }

  // A superseded value on a minority of records, so "current value" is a filter.
  if (chance(9) && values["headcount_exact"]) {
    values["headcount_exact"] = withHistory(values["headcount_exact"]!, {
      value: intBetween(2, 120),
    });
  }

  // U+FFFD in a small number of company names, mirroring the real corruption.
  if (chance(1.2)) values["name"] = text(corrupt(name));

  // A bulk CRM import: most records share one created_at. Anything that framed this as
  // "time in stage" would be describing the import, not the deal.
  const created = chance(66)
    ? "2026-02-16T11:20:00.000Z"
    : `2026-0${intBetween(3, 7)}-${String(intBetween(10, 28)).padStart(2, "0")}T1${intBetween(0, 8)}:30:00.000Z`;

  companies.push({ id: { record_id: recordId }, created_at: created, values });

  const stages: StageName[] = alsoPipeline ? [primaryStage, "pipeline"] : [primaryStage];
  const plan: Plan = { recordId, name, domain: dom, theme, sector, subSectors, primaryStage, stages };
  plans.push(plan);
  return plan;
}

for (let i = 0; i < PIPELINE_COUNT; i += 1) buildCompany("pipeline", false);
for (let i = 0; i < PORTFOLIO_COUNT; i += 1) buildCompany("portfolio", i < ALSO_ON_PIPELINE);
for (let i = 0; i < ARCHIVE_COUNT; i += 1) buildCompany("archive", false);

// ---------------------------------------------------------------------------
// List entries
//
// The important part of the whole seed. `hq_city`, `deal_stage` and `product_overview`
// exist ONLY here — a query against the company object cannot see them at all.
// ---------------------------------------------------------------------------

interface Entry {
  id: { entry_id: string };
  parent_record_id: string;
  created_at: string;
  entry_values: Record<string, RawValue[]>;
}

const entries: Record<string, Entry[]> = {
  pipeline: [], portfolio: [], archive: [], investor_network: [], stealth_watchlist: [],
};

let entrySeq = 0;

function addCompanyEntry(list: StageName, plan: Plan, createdAt: string): void {
  entrySeq += 1;
  const entry_values: Record<string, RawValue[]> = {};

  if (list === "pipeline") {
    // TEXT type on this list.
    if (chance(91)) entry_values["hq_city"] = text(pick(CITIES));
    if (chance(74)) entry_values["deal_stage"] = status(pick(PIPELINE_STAGES));
    if (chance(97)) {
      entry_values["product_overview"] = text(
        `${plan.name} ${pick(["automates", "replaces", "coordinates", "instruments", "underwrites"])} ` +
        `${pick(["a manual workflow", "a spreadsheet process", "a paper-based handoff", "an outsourced function"])} for ` +
        `${pick(["clinics", "operators", "manufacturers", "carriers", "schools", "utilities", "retailers"])}. ` +
        `Sold ${pick(["direct", "through channel partners", "via a self-serve motion"])}; ` +
        `${pick(["contracts are annual", "pricing is per-transaction", "pricing is per-seat"])}.`,
      );
    }
    if (chance(38)) entry_values["next_steps"] = text(pick([
      "Waiting on a data room.", "Second partner meeting to schedule.",
      "Following up after the diligence call.", "Founder asked to reconnect next quarter.",
    ]));
  }

  if (list === "archive") {
    // LOCATION type on this list — SAME SLUG, different type. This is the quirk that
    // makes readTextOrLocation() necessary; the wrong reader returns null here and it
    // is indistinguishable from an empty field.
    if (chance(82)) {
      const city = pick(ARCHIVE_CITIES);
      entry_values["hq_city"] = location(city.locality, city.region);
    }
    entry_values["archived_name"] = text(plan.name);
    if (chance(3)) entry_values["revisit_priority"] = select(pick(["High", "Low"]));
  }

  entries[list]!.push({
    id: { entry_id: `ent_${String(entrySeq).padStart(5, "0")}` },
    parent_record_id: plan.recordId,
    created_at: createdAt,
    entry_values,
  });
}

for (const plan of plans) {
  const company = companies.find((c) => c.id.record_id === plan.recordId)!;
  for (const stage of plan.stages) addCompanyEntry(stage, plan, company.created_at);
}

// ---------------------------------------------------------------------------
// People — stealth founders and co-investors
// ---------------------------------------------------------------------------

interface Person {
  id: { record_id: string };
  created_at: string;
  values: Record<string, RawValue[]>;
}

const people: Person[] = [];
const STEALTH_COUNT = 180;
const CO_INVESTOR_COUNT = 96;
/** How many founder records have been triaged (`reached_out` set, and set to false). */
const TRIAGED = 132;

let personSeq = 0;

const founderPlans: { recordId: string; name: string; linkedin: string }[] = [];

for (let i = 0; i < STEALTH_COUNT; i += 1) {
  personSeq += 1;
  const recordId = `per_${String(personSeq).padStart(4, "0")}`;
  const name = personName();
  const handle = slugify(name);
  const linkedin = `https://social.example/in/${handle}`;

  const values: Record<string, RawValue[]> = {
    // 1.6% of founder text fields carry U+FFFD, exactly as the real records do.
    name: text(chance(1.6) ? corrupt(name) : name),
    // 100% on this list — the most reliable field on it, and the only thing that
    // resolves a founder against an external profile.
    linkedin_url: text(linkedin),
  };

  if (chance(79)) values["linkedin_company"] = text(chance(30) ? "Stealth" : companyNameForFounder());
  if (chance(79)) values["linkedin_position"] = text(pick(["Founder", "Co-Founder", "Founder & CEO", "Building something new"]));
  if (chance(66)) {
    // Highlights are NOT uniform, and the skew is the whole point. In the real
    // provider's taxonomy one generic credential ("Top University") accounted for 45%
    // of all highlight instances and repeated on the same person — which is why it is
    // weighted 0 in lib/founder-quality.ts and never shown as a differentiator. A
    // uniform draw here would delete that finding, so it is reproduced: the generic tag
    // lands on most records and the rare signals stay rare.
    const tags = new Set<string>();
    if (chance(74)) tags.add("Top University");
    for (const tag of pickSome(HIGHLIGHT_TAGS.filter((t) => t !== "Top University"), 0, 2)) {
      tags.add(tag);
    }
    if (tags.size > 0) values["person_highlights"] = multi([...tags]);
  }
  // 79% — the field the tracker actually groups by.
  if (chance(75)) values["sourced_by"] = multi(pickSome(TEAM_MEMBERS, 1, 2));
  // Set on 132 records and FALSE on every one of them. Nobody has been contacted.
  // The remaining 48 are null, which is a different fact and must not collapse into
  // false: "triaged, not contacted" is not "never looked at".
  if (i < TRIAGED) values["reached_out"] = checkbox(false);
  if (chance(29)) values["avatar_url"] = text(`/demo-logo/${recordId}.svg`);
  if (chance(58)) values["email_addresses"] = text(`${handle}@${slugify(pick(NAME_PREFIXES) + pick(NAME_ENDINGS))}.example`);
  if (chance(83)) values["current_location"] = text(pick(CITIES));
  if (chance(29)) values["home_location"] = location(pick(CITIES).split(",")[0]!, null);
  if (chance(71)) values["education"] = text(chance(2) ? corrupt(pick(EDUCATION)) : pick(EDUCATION));
  if (chance(21)) values["twitter_handle"] = text(handle.slice(0, 14));

  people.push({ id: { record_id: recordId }, created_at: T0, values });
  founderPlans.push({ recordId, name, linkedin });

  entrySeq += 1;
  entries["stealth_watchlist"]!.push({
    id: { entry_id: `ent_${String(entrySeq).padStart(5, "0")}` },
    parent_record_id: recordId,
    created_at: chance(70) ? "2026-02-16T11:20:00.000Z" : `2026-0${intBetween(3, 7)}-${String(intBetween(1, 28)).padStart(2, "0")}T09:00:00.000Z`,
    // No substantive list attributes on this list.
    // all seven of its list fields measure 0%.
    entry_values: {},
  });
}

/** A plausible prior employer for a founder. Same coined vocabulary, no real firms. */
function companyNameForFounder(): string {
  return `${pick(NAME_PREFIXES)}${pick(NAME_ENDINGS)}`;
}

const coInvestorPlans: { recordId: string; firm: string; deals: string[] }[] = [];
const portfolioNames = plans.filter((p) => p.primaryStage === "portfolio").map((p) => p.name);

for (let i = 0; i < CO_INVESTOR_COUNT; i += 1) {
  personSeq += 1;
  const recordId = `per_${String(personSeq).padStart(4, "0")}`;
  const name = personName();
  const firm = firmName();

  const values: Record<string, RawValue[]> = { name: text(name) };

  if (chance(6)) values["linkedin_url"] = text(`https://social.example/in/${slugify(name)}`);
  if (chance(4)) values["email_addresses"] = text(`${slugify(name)}@${slugify(firm)}.example`);
  // 74% — one of only two fields on this list with real coverage on the object.
  if (chance(69)) values["stage_focus"] = select(pick(STAGE_FOCUS));
  // 100% raw. 20% of the values are the literal string "unavailable", which is why
  // this reads 100% populated and 80% useful once cleanText() has run.
  values["thesis_focus"] = text(
    chance(17)
      ? "unavailable"
      : `Invests primarily in ${pickSome(THESIS_TERMS, 1, 3).join(", ")}.`,
  );
  // 100% — the enrichment profile each row came from.
  values["source_profile_url"] = text(`https://profiles.example/investor/${slugify(firm)}`);

  people.push({ id: { record_id: recordId }, created_at: T0, values });

  // The co-investment linkage, on the LIST ENTRY. Free text, comma-separated company
  // names. Most resolve against our own portfolio records; a few deliberately do not,
  // because a real co-investment on a company we never listed is still a real
  // co-investment and must be counted rather than dropped.
  const dealCount = intBetween(0, 4);
  const deals: string[] = [];
  for (let d = 0; d < dealCount; d += 1) {
    if (chance(86) && portfolioNames.length > 0) {
      const target = pick(portfolioNames);
      // Free text drifts from the record: a legal suffix or a trailing period is how
      // normaliseCompanyName() earns its place.
      deals.push(chance(18) ? `${target} Inc.` : target);
    } else {
      deals.push(companyName());
    }
  }

  entrySeq += 1;
  entries["investor_network"]!.push({
    id: { entry_id: `ent_${String(entrySeq).padStart(5, "0")}` },
    parent_record_id: recordId,
    created_at: T0,
    entry_values: {
      // 100% raw, 87% useful — the rest is the "unavailable" placeholder again.
      fund_firm: text(chance(16) ? "unavailable" : firm),
      // 100% raw and only 31% useful. Worth stating both numbers anywhere this is
      // reported, because the difference between them IS the finding.
      check_size_range: text(chance(72) ? "unavailable" : pick(CHECK_SIZES)),
      deals_co_invested: text(deals.join(", ")),
    },
  });

  coInvestorPlans.push({ recordId, firm, deals });
}

// ---------------------------------------------------------------------------
// Team references — companies → people
//
// A record-reference multiselect, attached in a second pass because the people it points
// at are generated after the companies. Worth emitting rather than leaving empty: it is
// the only field in the dataset that exercises `readRecordRefs()`, and the company detail
// page has a panel that renders it. A field the app has UI for and the seed never
// populates is a panel nobody ever sees.
// ---------------------------------------------------------------------------

const personIds = people.map((p) => p.id.record_id);
const TEAM_COVERAGE = { pipeline: 41, portfolio: 85, archive: 12 } as const;

for (const plan of plans) {
  if (!chance(TEAM_COVERAGE[plan.primaryStage])) continue;
  const company = companies.find((c) => c.id.record_id === plan.recordId)!;
  const members = pickSome(personIds, 1, 3);
  company.values["team"] = members.map((id) => ({
    active_from: T0,
    active_until: null,
    target_record_id: id,
    target_object: "people",
  }));
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

const notes = [];
for (let i = 0; i < 480; i += 1) {
  const plan = pick(plans);
  notes.push({
    id: { note_id: `note_${String(i + 1).padStart(4, "0")}` },
    parent_object: "companies",
    parent_record_id: plan.recordId,
    title: pick([
      "Intro call", "Diligence notes", "Founder update", "Reference call",
      "Partner discussion", "Follow-up", "Data room review",
    ]),
    created_at: `2026-0${intBetween(4, 8)}-${String(intBetween(1, 28)).padStart(2, "0")}T1${intBetween(0, 7)}:00:00.000Z`,
    content_plaintext:
      `${pick(["Spoke with the founder", "Reviewed the deck", "Ran a reference", "Reviewed metrics"])}. ` +
      `${pick(["Growth is steady", "Retention looks strong", "Sales cycle is long", "Margins are thin", "Pipeline is concentrated"])}. ` +
      `${pick(["Revisit next quarter", "Moving to diligence", "Passing for now", "Waiting on the raise to firm up"])}.`,
  });
}

// ---------------------------------------------------------------------------
// Enrichment provider snapshot
//
// The second integration, kept strictly additive: it can enrich a company the CRM
// already holds, and it never becomes a second source of classification truth. The
// enrichment layer is allowed to fail — every page that reads it treats a missing
// snapshot as "no enrichment", not as an error.
// ---------------------------------------------------------------------------

const enrichmentCompanies = plans
  .filter((p) => p.primaryStage !== "archive")
  .filter(() => chance(88))
  .map((plan) => ({
    domain: plan.domain,
    name: plan.name,
    funding_total: chance(88) ? intBetween(4, 260) * 250_000 : null,
    headcount_current: chance(92) ? intBetween(4, 800) : null,
    headcount_growth_90d: chance(82) ? Number((rng() * 90 - 18).toFixed(1)) : null,
    web_traffic_growth_90d: chance(78) ? Number((rng() * 120 - 30).toFixed(1)) : null,
    funding_rounds: Array.from({ length: intBetween(0, 3) }, () => {
      const investors = pickSome(coInvestorPlans.map((c) => c.firm), 1, 4);
      // The operator of this dashboard appears on some rounds and not others, which is
      // what makes the portfolio cross-check a real comparison rather than a formality.
      // Name kept in sync with lib/enrichment.ts OUR_ALIASES.
      if (chance(46)) investors.push("Bellhaven Capital");
      return {
        round: pick(ROUNDS),
        announced: `202${intBetween(2, 6)}-0${intBetween(1, 9)}-15`,
        amount: intBetween(2, 60) * 250_000,
        currency: "USD",
        // Exactly one lead per round, when the provider knows one at all.
        lead: chance(72) ? investors[0]! : null,
        investors,
      };
    }),
    // Valuation carries its own staleness flag, because the provider's figure is often
    // the last publicly reported one and quoting a two-year-old valuation as current is
    // how a number gets repeated in a meeting and then corrected in public.
    valuation: chance(38)
      ? {
          value: intBetween(8, 400) * 1_000_000,
          source: pick(["Reported round", "Estimated", "Filing"]),
          is_potentially_stale: chance(41),
        }
      : null,
  }));

/**
 * Founder launch signals. Resolution goes through the LinkedIn profile, not a
 * saved-search feed: a "recently emerged from stealth" saved search matches only a
 * handful of founders, while a profile lookup resolves nearly all of them. That
 * correction (see lib/founder-launch.ts) is preserved here — matching is keyed on
 * `linkedin_url`.
 */
const enrichmentFounders = founderPlans
  .filter(() => chance(84))
  .map((f) => {
    const launched = chance(31);
    return {
      linkedin_url: f.linkedin,
      name: f.name,
      highlights: pickSome(HIGHLIGHT_TAGS, 1, 3),
      current_role: launched ? "Founder" : pick(PRIOR_ROLES),
      current_company: launched
        ? { name: companyName(), domain: null as string | null, founded: intBetween(2025, 2026) }
        : null,
      prior_companies: pickSome([...Array.from({ length: 12 }, () => companyNameForFounder())], 1, 3),
    };
  });

// ---------------------------------------------------------------------------
// Digest history
//
// Ten weekly snapshots, so Trends has something honest to draw. The oldest one is
// emitted WITHOUT a metrics block, reproducing the pre-metrics digests in the real
// history: lib/trends.ts drops those points rather than zeroing them, because a zero
// would draw a cliff that never happened.
// ---------------------------------------------------------------------------

const digestSeeds = Array.from({ length: 10 }, (_, i) => {
  const week = 9 - i;
  const date = new Date(Date.UTC(2026, 5, 1) + (9 - week) * 7 * 86_400_000);
  return {
    id: `dg_${date.toISOString().slice(0, 10)}`,
    generatedAt: date.toISOString(),
    weekIndex: 9 - week,
    withMetrics: i > 0,
  };
});

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

mkdirSync(OUT, { recursive: true });

function write(file: string, data: unknown): void {
  writeFileSync(join(OUT, file), `${JSON.stringify(data, null, 1)}\n`, "utf8");
}

write("companies.json", companies);
write("people.json", people);
write("list-entries.json", entries);
write("notes.json", notes);
write("enrichment.json", { companies: enrichmentCompanies, founders: enrichmentFounders });
write("taxonomy.json", {
  thesis_theme: THEMES,
  core_sector: THEMES.flatMap((t) => SECTORS_BY_THEME[t]!),
  sub_sector: ALL_SUB_SECTORS,
  round_current: ROUNDS,
  investment_theme_tags: [...INVESTMENT_THEME_TAGS],
  deal_structure: [...DEAL_STRUCTURES],
  funding_vehicle: [...VEHICLES],
  arr_band: [...ARR_BANDS],
  headcount_band: [...HEADCOUNT_BANDS],
  deal_stage: [...PIPELINE_STAGES],
  portfolio_status: [...PORTFOLIO_STATUSES],
  stage_focus: [...STAGE_FOCUS],
  sourced_by: [...TEAM_MEMBERS],
});
write("digest-seeds.json", digestSeeds);

/**
 * A content hash of everything just written, folded into the cache keys.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 * The cache is keyed by a hand-maintained version string, and the project rule is to bump
 * it whenever a snapshot's SHAPE changes. That rule does not cover the seed's CONTENT
 * changing, and it bit immediately: regenerating the seed left a stale snapshot in the
 * file-backed cache, so every page — and every measurement taken off those pages —
 * described the previous dataset. Nothing looked broken; the numbers were simply for
 * data that no longer existed.
 *
 * Deriving the key from the data removes the discipline requirement entirely. A seed
 * change invalidates every cached snapshot automatically, which is strictly better than
 * remembering to.
 */
const seedFiles = [
  "companies.json", "people.json", "list-entries.json",
  "notes.json", "enrichment.json", "taxonomy.json",
];
const hash = createHash("sha256");
for (const file of seedFiles) hash.update(readFileSync(join(OUT, file)));
const version = hash.digest("hex").slice(0, 12);
writeFileSync(join(OUT, "version.json"), `${JSON.stringify({ version }, null, 1)}\n`, "utf8");

console.log(
  `seed written  (version ${version})\n` +
  `  companies      ${companies.length}\n` +
  `  people         ${people.length}\n` +
  `  pipeline       ${entries["pipeline"]!.length}\n` +
  `  portfolio      ${entries["portfolio"]!.length}\n` +
  `  archive        ${entries["archive"]!.length}\n` +
  `  stealth        ${entries["stealth_watchlist"]!.length}\n` +
  `  co-investors   ${entries["investor_network"]!.length}\n` +
  `  notes          ${notes.length}\n` +
  `  sub-sectors    ${ALL_SUB_SECTORS.length}\n`,
);
