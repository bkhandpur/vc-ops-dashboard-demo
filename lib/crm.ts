/**
 * Typed access layer for the local synthetic CRM dataset. The seed keeps timestamped
 * value arrays, separate list-entry fields and paginated reads.
 */

import "server-only";

import companiesSeed from "@/data/seed/companies.json";
import peopleSeed from "@/data/seed/people.json";
import entriesSeed from "@/data/seed/list-entries.json";
import notesSeed from "@/data/seed/notes.json";
import taxonomySeed from "@/data/seed/taxonomy.json";

import {
  CO_INVESTOR_ENTRY_FIELDS,
  COMPANY_FIELDS,
  LIST_ENTRY_FIELDS,
  LISTS,
  PEOPLE_FIELDS,
  type ListKey,
  type ParentObject,
} from "./constants";
import { applyOverlay, recordWrite } from "./demo-store";

// ---------------------------------------------------------------------------
// Raw value shapes
// ---------------------------------------------------------------------------

/** Every attribute value is an array of timestamped value objects. */
export interface CrmValueBase {
  active_from: string;
  active_until: string | null;
}

export type CrmValue = CrmValueBase & Record<string, unknown>;

export interface CrmRecord {
  id: { record_id: string };
  created_at: string;
  values: Record<string, CrmValue[] | undefined>;
}

export interface CrmListEntry {
  id: { entry_id: string };
  parent_record_id: string;
  created_at: string;
  entry_values: Record<string, CrmValue[] | undefined>;
}

export interface CrmNote {
  id: { note_id: string };
  parent_object: string;
  parent_record_id: string;
  title: string;
  content_plaintext: string;
  created_at: string;
}

export class CrmError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CrmError";
  }
}

/** The committed seed is always available. */
export function isCrmConfigured(): boolean {
  return true;
}

// ---------------------------------------------------------------------------
// Transport (local)
// ---------------------------------------------------------------------------

const COMPANY_RECORDS = companiesSeed as unknown as CrmRecord[];
const PEOPLE_RECORDS = peopleSeed as unknown as CrmRecord[];
const LIST_ENTRIES = entriesSeed as unknown as Record<string, CrmListEntry[]>;
const NOTES = notesSeed as unknown as CrmNote[];
const TAXONOMY_OPTIONS = taxonomySeed as unknown as Record<string, string[]>;

/**
 * Simulated latency, so the loading and completion states in the UI are visible rather
 * than theoretical. A reviewer clicking Refresh should see the same three-state button
 * (`useAsyncAction`) the real tool shows against a rate-limited API, not an instant
 * flash. 24ms per page is enough to make it feel like I/O and short enough that nobody
 * waits: a full refresh lands in well under a second.
 */
const PAGE_LATENCY_MS = 24;

async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, PAGE_LATENCY_MS));
}

/**
 * Offset pagination with a hard cap, mirroring the real client.
 *
 * The cap is not paranoia. The real API paginated 500 at a time and a runaway loop
 * against a rate-limited endpoint is how you get an account throttled mid-demo, so the
 * loop always had a ceiling that did not depend on the server behaving.
 */
async function paginate<T>(
  fetchPage: (limit: number, offset: number) => Promise<T[]>,
  pageSize = 500,
  hardCap = 20_000,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;
  for (;;) {
    const page = await fetchPage(pageSize, offset);
    all.push(...page);
    if (page.length < pageSize || all.length >= hardCap) break;
    offset += pageSize;
  }
  return all;
}

// ---------------------------------------------------------------------------
// Value readers — turn the array-of-values shape into plain TS
// ---------------------------------------------------------------------------

/**
 * The current value is the one still active. Reading `values[0]` instead would return
 * a superseded value on any record whose field has ever been edited — a class of bug
 * that produces plausible-looking wrong numbers rather than an error.
 */
function firstValue(values: CrmValue[] | undefined): CrmValue | undefined {
  return values?.find((v) => v.active_until === null) ?? values?.[0];
}

export function readText(values: CrmValue[] | undefined): string | null {
  const raw = firstValue(values)?.["value"];
  return typeof raw === "string" ? raw : null;
}

export function readName(values: CrmValue[] | undefined): string | null {
  const v = firstValue(values);
  if (!v) return null;
  const full = v["full_name"];
  if (typeof full === "string") return full;
  return readText(values);
}

/** Single-select → option title. */
export function readSelect(values: CrmValue[] | undefined): string | null {
  const option = firstValue(values)?.["option"] as { title?: string } | undefined;
  return typeof option?.title === "string" ? option.title : null;
}

/** Multiselect → every active option title. */
export function readMultiSelect(values: CrmValue[] | undefined): string[] {
  if (!values) return [];
  return values
    .filter((v) => v.active_until === null)
    .map((v) => (v["option"] as { title?: string } | undefined)?.title)
    .filter((t): t is string => typeof t === "string");
}

export function readDomains(values: CrmValue[] | undefined): string[] {
  if (!values) return [];
  return values
    .filter((v) => v.active_until === null)
    .map((v) => v["domain"])
    .filter((d): d is string => typeof d === "string");
}

export function readCurrency(values: CrmValue[] | undefined): number | null {
  const raw = firstValue(values)?.["currency_value"];
  return typeof raw === "number" ? raw : null;
}

export function readNumber(values: CrmValue[] | undefined): number | null {
  const raw = firstValue(values)?.["value"];
  return typeof raw === "number" ? raw : null;
}

/**
 * Checkbox → true / false / null, and the three-way distinction is load-bearing.
 *
 * On the Stealth Founders list, 132 records are explicitly `false` and 48 have no
 * value at all. "We triaged this founder and have not contacted them" is a different
 * fact from "nobody has ever looked at this record", and collapsing null to false
 * hides 48 untriaged people inside 132 triaged ones.
 */
export function readCheckbox(values: CrmValue[] | undefined): boolean | null {
  const raw = firstValue(values)?.["value"];
  return typeof raw === "boolean" ? raw : null;
}

/**
 * Read an opaque synthetic member ID. Callers must not present it as a display name.
 */
export function readActorId(values: CrmValue[] | undefined): string | null {
  const raw = firstValue(values)?.["referenced_actor_id"];
  return typeof raw === "string" ? raw : null;
}

export function readRecordRefs(values: CrmValue[] | undefined): string[] {
  if (!values) return [];
  return values
    .filter((v) => v.active_until === null)
    .map((v) => v["target_record_id"])
    .filter((id): id is string => typeof id === "string");
}

export function readDate(values: CrmValue[] | undefined): string | null {
  const raw = firstValue(values)?.["value"];
  return typeof raw === "string" ? raw : null;
}

export function readLocation(values: CrmValue[] | undefined): string | null {
  const v = firstValue(values);
  if (!v) return null;
  const parts = [v["locality"], v["region"], v["country_code"]].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  return parts.length ? parts.join(", ") : null;
}

/**
 * Read a value that may be either a text attribute or a location attribute.
 *
 * Needed because the SAME slug has different types on different lists: `hq_city` is
 * `text` on the Pipeline list ("Denver, CO") and `location` on the Archive list
 * ({locality: "Bristol"}). Reading it with the wrong reader silently yields null,
 * which is indistinguishable from an empty field — so the bug presents as "that field
 * has no data" and gets believed.
 */
export function readTextOrLocation(values: CrmValue[] | undefined): string | null {
  return readText(values) ?? readLocation(values);
}

/** Status attributes carry `status.title`, not `option.title`. */
export function readStatus(values: CrmValue[] | undefined): string | null {
  const status = firstValue(values)?.["status"] as { title?: string } | undefined;
  return typeof status?.title === "string" ? status.title : null;
}

/**
 * Enrichment fields carry the literal string "unavailable" rather than being absent.
 * Treating that as a value produces a sector focus called "unavailable" and cheque
 * sizes of "unavailable", so it is normalised to null once, here, at the boundary —
 * not in each of the six consumers, where one would eventually be forgotten.
 *
 * This is why `check_size_range` reads 100% populated and 30% useful. Both numbers are
 * worth stating wherever it is reported; the gap between them IS the finding.
 */
const NOT_A_VALUE = new Set(["unavailable", "n/a", "na", "unknown", "-", "—"]);

export function cleanText(raw: string | null): string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!trimmed || NOT_A_VALUE.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

/**
 * Does this text carry the Unicode replacement character?
 *
 * ── WHAT THIS IS, AND WHY IT IS NOT REPAIRED ─────────────────────────────────
 * A handful of imported founder-name and education fields carry U+FFFD where an
 * accented letter or a curly apostrophe should be. That is a different problem from
 * classic mojibake, and the distinction decides what you are allowed to do about it:
 *
 *   - Classic mojibake is UTF-8 read as Latin-1. The bytes SURVIVE, misinterpreted, so
 *     it is mechanically reversible.
 *   - U+FFFD means a decoder already hit bytes it could not decode and REPLACED them.
 *     The original bytes are gone.
 *
 * A substitution pass would have to GUESS the lost character, and "Ren<?>" is equally
 * René, Renè or Renê. A wrong guess silently fabricates a person's name. It is reported
 * as a Data Health gap linking to the record instead of being repaired.
 */
export function hasLostCharacters(raw: string | null | undefined): boolean {
  return typeof raw === "string" && raw.includes("�");
}

// ---------------------------------------------------------------------------
// Domain model
// ---------------------------------------------------------------------------

export interface Company {
  recordId: string;
  createdAt: string;
  name: string | null;
  description: string | null;
  domains: string[];
  /** Taxonomy level 1. */
  theme: string | null;
  /** Taxonomy level 2. */
  canonicalSector: string | null;
  /** Taxonomy level 3, multiselect. */
  subSectors: string[];
  /** Union of BOTH round fields — see COMPANY_FIELDS.round for why there are two. */
  rounds: string[];
  logoUrl: string | null;
  /** Total raised from ALL investors, USD. NOT this firm's position. */
  fundingRaisedUsd: number | null;
  estimatedArr: string | null;
  /** ⚠️ DEPRECATED, 0% everywhere. Kept so Data Health can count it as a gap. */
  warmIntroOwner: string | null;
  location: string | null;
  employeeRange: string | null;
  foundationDate: string | null;
  /** ~2% coverage, every value the same member at "Very weak". */
  connectionUser: string | null;
  connectionStrength: string | null;
  connectionScore: number | null;
  teamRecordIds: string[];

  primaryRelationships: string | null;
  companySummary: string | null;
  teamStructure: string | null;
  googleFolder: string | null;
  linkedin: string | null;
  investmentThemes: string[];
  portfolioStatus: string | null;
  raisingLowM: number | null;
  enrichedFundingUsd: number | null;
  yearFounded: number | null;
  numberOfEmployees: number | null;
  enrichedHeadcount: number | null;

  // ── From the LIST ENTRY, not the record ───────────────────────────────────
  /** 94% on Pipeline, 83% on Archive. The real location field. */
  city: string | null;
  /** Pipeline only, `status` type. 80%. The real deal stage. */
  pipelineStage: string | null;
  /** Pipeline 96%. */
  productOverview: string | null;
  nextSteps: string | null;
  /** When this company was added to the list. NOT deal age — see `tenureView()`. */
  addedToListAt: string | null;

  dealType: string[];
  vehicle: string[];
  raisingHighM: number | null;
  valuationText: string | null;
  industry: string[];
  categories: string[];
  clientFocus: string[];
  ownershipTypes: string[];
  lastFundingEur: number | null;
  /** Percent change. Can legitimately be negative. */
  headcountGrowth: number | null;
  webTrafficGrowth: number | null;
  description2: string | null;
  domainsBackup: string | null;
  twitter: string | null;
}

/**
 * The best available figure for total capital raised, and WHICH field it came from.
 *
 * There are two candidates and neither dominates the other on every list (40/53/35 vs
 * 74/53/79), so this takes whichever is present and reports the source. A figure whose
 * provenance is unknown is worse than no figure at all in a partner meeting — someone
 * will quote it, and nobody will be able to say where it came from.
 */
export function bestFunding(
  company: Pick<Company, "fundingRaisedUsd" | "enrichedFundingUsd">,
): { value: number; source: "crm" | "enrichment" } | null {
  if (company.fundingRaisedUsd !== null) {
    return { value: company.fundingRaisedUsd, source: "crm" };
  }
  if (company.enrichedFundingUsd !== null) {
    return { value: company.enrichedFundingUsd, source: "enrichment" };
  }
  return null;
}

/**
 * Build a Company from its record and, when we have it, its list entry.
 *
 * The entry is optional because the company detail page's single-record refresh has no
 * list context — entry-only fields are simply null there, and the caller keeps the
 * snapshot value rather than overwriting it with a null.
 */
export function toCompany(record: CrmRecord, entry?: CrmListEntry): Company {
  const v = record.values;
  const e = entry?.entry_values ?? {};
  return {
    recordId: record.id.record_id,
    createdAt: record.created_at,
    name: readName(v[COMPANY_FIELDS.name]),
    description: readText(v[COMPANY_FIELDS.description]),
    domains: readDomains(v[COMPANY_FIELDS.domains]),
    theme: readSelect(v[COMPANY_FIELDS.theme]),
    canonicalSector: readSelect(v[COMPANY_FIELDS.canonicalSector]),
    subSectors: readMultiSelect(v[COMPANY_FIELDS.subSector]),
    // Read BOTH round fields. Reading both means the UI keeps working whichever field
    // a teammate happened to fill in; writes go to one, so the data stops splitting.
    rounds: [
      ...new Set([
        ...readMultiSelect(v[COMPANY_FIELDS.round]),
        ...readMultiSelect(v[COMPANY_FIELDS.roundCurrent]),
      ]),
    ],
    logoUrl: readText(v[COMPANY_FIELDS.logoUrl]),
    fundingRaisedUsd: readCurrency(v[COMPANY_FIELDS.fundingRaised]),
    estimatedArr: readSelect(v[COMPANY_FIELDS.estimatedArr]),
    warmIntroOwner: readText(v[COMPANY_FIELDS.warmIntroOwner]),
    location: readLocation(v[COMPANY_FIELDS.primaryLocation]),
    employeeRange: readSelect(v[COMPANY_FIELDS.employeeRange]),
    foundationDate: readDate(v[COMPANY_FIELDS.foundationDate]),
    connectionUser: readActorId(v[COMPANY_FIELDS.strongestConnectionUser]),
    connectionStrength: readSelect(v[COMPANY_FIELDS.strongestConnectionStrength]),
    connectionScore: readNumber(v[COMPANY_FIELDS.strongestConnectionScore]),
    teamRecordIds: readRecordRefs(v[COMPANY_FIELDS.team]),

    primaryRelationships: cleanText(readText(v[COMPANY_FIELDS.primaryRelationships])),
    companySummary: cleanText(readText(v[COMPANY_FIELDS.companySummary])),
    teamStructure: cleanText(readText(v[COMPANY_FIELDS.teamStructure])),
    googleFolder: cleanText(readText(v[COMPANY_FIELDS.googleFolder])),
    linkedin: cleanText(readText(v[COMPANY_FIELDS.linkedin])),
    investmentThemes: readMultiSelect(v[COMPANY_FIELDS.investmentTheme]),
    portfolioStatus: readSelect(v[COMPANY_FIELDS.portfolioStatus]),
    raisingLowM: readNumber(v[COMPANY_FIELDS.raisingLowM]),
    enrichedFundingUsd: readCurrency(v[COMPANY_FIELDS.enrichedFunding]),
    yearFounded: readNumber(v[COMPANY_FIELDS.yearFounded]),
    numberOfEmployees: readNumber(v[COMPANY_FIELDS.numberOfEmployees]),
    enrichedHeadcount: readNumber(v[COMPANY_FIELDS.enrichedHeadcount]),

    // `hq_city` is `text` on Pipeline and `location` on Archive — same slug, two types.
    city: cleanText(readTextOrLocation(e[LIST_ENTRY_FIELDS.city])),
    pipelineStage: readStatus(e[LIST_ENTRY_FIELDS.stage]),
    productOverview: cleanText(readText(e[LIST_ENTRY_FIELDS.productOverview])),
    nextSteps: cleanText(readText(e[LIST_ENTRY_FIELDS.nextSteps])),
    addedToListAt: entry?.created_at ?? null,

    dealType: readMultiSelect(v[COMPANY_FIELDS.dealType]),
    vehicle: readMultiSelect(v[COMPANY_FIELDS.vehicle]),
    raisingHighM: readNumber(v[COMPANY_FIELDS.raisingHighM]),
    valuationText: cleanText(readText(v[COMPANY_FIELDS.valuationText])),
    industry: readMultiSelect(v[COMPANY_FIELDS.industry]),
    categories: readMultiSelect(v[COMPANY_FIELDS.categoryTags]),
    clientFocus: readMultiSelect(v[COMPANY_FIELDS.clientFocus]),
    ownershipTypes: readMultiSelect(v[COMPANY_FIELDS.ownershipTypes]),
    lastFundingEur: readCurrency(v[COMPANY_FIELDS.lastFundingEur]),
    headcountGrowth: readNumber(v[COMPANY_FIELDS.headcountGrowth]),
    webTrafficGrowth: readNumber(v[COMPANY_FIELDS.webTrafficGrowth]),
    description2: cleanText(readText(v[COMPANY_FIELDS.description2])),
    domainsBackup: cleanText(readText(v[COMPANY_FIELDS.domainsBackup])),
    twitter: cleanText(readText(v[COMPANY_FIELDS.twitter])),
  };
}

export interface Person {
  recordId: string;
  createdAt: string;
  name: string | null;
  emails: string[];
  description: string | null;
  /** 100% on Stealth Founders — and the only thing that resolves against enrichment. */
  linkedin: string | null;
  linkedinCompany: string | null;
  linkedinPosition: string | null;
  jobTitle: string | null;
  /** Unranked credential tags, 60% on Stealth Founders. */
  highlights: string[];
  sourcedBy: string[];
  /** null = never set. false = explicitly not yet contacted. See `readCheckbox`. */
  reachedOut: boolean | null;
  avatarUrl: string | null;
  location: string | null;
  stageFocus: string | null;
  sectorThesisFocus: string | null;
  currentLocation: string | null;
  education: string | null;
  twitter: string | null;
  sourceDocumentUrl: string | null;
  /** 0% populated. Nothing writes here without an explicit per-record confirm. */
  connectedCompanyId: string | null;

  // ── Co-Investors LIST ENTRY ───────────────────────────────────────────────
  /** The firm. Prefer over `name` for a co-investor. */
  fundFirm: string | null;
  checkSizeRange: string | null;
  /** Company names co-invested on. THE co-investment linkage. */
  dealsCoInvested: string[];
}

export function toPerson(record: CrmRecord, entry?: CrmListEntry): Person {
  const v = record.values;
  const e = entry?.entry_values ?? {};
  const emails = (v[PEOPLE_FIELDS.emailAddresses] ?? [])
    .map((value) => value["value"] ?? value["email_address"])
    .filter((value): value is string => typeof value === "string");
  return {
    recordId: record.id.record_id,
    createdAt: record.created_at,
    name: readName(v[PEOPLE_FIELDS.name]),
    emails,
    description: readText(v[PEOPLE_FIELDS.description]),
    linkedin: readText(v[PEOPLE_FIELDS.linkedin]),
    linkedinCompany: cleanText(readText(v[PEOPLE_FIELDS.linkedinCompany])),
    linkedinPosition: cleanText(readText(v[PEOPLE_FIELDS.linkedinPosition])),
    jobTitle: readText(v[PEOPLE_FIELDS.jobTitle]),
    highlights: readMultiSelect(v[PEOPLE_FIELDS.highlights]),
    sourcedBy: readMultiSelect(v[PEOPLE_FIELDS.sourcedBy]),
    reachedOut: readCheckbox(v[PEOPLE_FIELDS.reachedOut]),
    avatarUrl: readText(v[PEOPLE_FIELDS.avatarUrl]),
    location: readLocation(v[PEOPLE_FIELDS.primaryLocation]),
    stageFocus: readSelect(v[PEOPLE_FIELDS.stageFocus]),
    sectorThesisFocus: cleanText(readText(v[PEOPLE_FIELDS.sectorThesisFocus])),
    currentLocation: cleanText(readText(v[PEOPLE_FIELDS.currentLocation])),
    education: cleanText(readText(v[PEOPLE_FIELDS.education])),
    twitter: cleanText(readText(v[PEOPLE_FIELDS.twitter])),
    sourceDocumentUrl: cleanText(readText(v[PEOPLE_FIELDS.sourceDocumentUrl])),
    connectedCompanyId: readRecordRefs(v[PEOPLE_FIELDS.connectedPortco])[0] ?? null,

    fundFirm: cleanText(readText(e[CO_INVESTOR_ENTRY_FIELDS.fundFirm])),
    checkSizeRange: cleanText(readText(e[CO_INVESTOR_ENTRY_FIELDS.checkSizeRange])),
    dealsCoInvested: splitDealList(readText(e[CO_INVESTOR_ENTRY_FIELDS.dealsCoInvested])),
  };
}

/**
 * "Averlon, Bexworth Labs, Calluvia" → three names.
 *
 * A company name can legitimately contain a comma, and this will split such a name in
 * two. The alternative — not splitting — leaves the entire co-investment analysis
 * unbuildable, because this free-text field is the only place the relationship is
 * recorded. Semicolons and pipes are accepted too, since a human types this.
 */
export function splitDealList(raw: string | null): string[] {
  const cleaned = cleanText(raw);
  if (!cleaned) return [];
  return [
    ...new Set(
      cleaned
        .split(/[,;|]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Live option lists for the taxonomy selects.
 *
 * Options are FETCHED, never hardcoded — they change, and a hardcoded list silently
 * stops offering a new option the moment somebody adds one in the CRM. Only list ids
 * and field slugs are hardcoded, because those are verified and stable.
 */
export interface TaxonomyOptions {
  themes: string[];
  canonicalSectors: string[];
  subSectors: string[];
  rounds: string[];
}

export async function getSelectOptions(slug: string): Promise<string[]> {
  await tick();
  return TAXONOMY_OPTIONS[slug] ?? [];
}

export async function getTaxonomyOptions(): Promise<TaxonomyOptions> {
  const [themes, canonicalSectors, subSectors, rounds] = await Promise.all([
    getSelectOptions(COMPANY_FIELDS.theme),
    getSelectOptions(COMPANY_FIELDS.canonicalSector),
    getSelectOptions(COMPANY_FIELDS.subSector),
    getSelectOptions(COMPANY_FIELDS.roundCurrent),
  ]);
  return { themes, canonicalSectors, subSectors, rounds };
}

function listSlug(list: ListKey | string): string {
  return list in LISTS ? LISTS[list as ListKey].slug : list;
}

/** All entries on a list, paginated. */
export async function getListEntries(list: ListKey | string): Promise<CrmListEntry[]> {
  const slug = listSlug(list);
  const all = applyOverlay.entries(slug, LIST_ENTRIES[slug] ?? []);
  return paginate<CrmListEntry>(async (limit, offset) => {
    await tick();
    return all.slice(offset, offset + limit);
  });
}

export async function getRecord(object: ParentObject, recordId: string): Promise<CrmRecord> {
  await tick();
  const source = object === "companies" ? COMPANY_RECORDS : PEOPLE_RECORDS;
  const found = applyOverlay.records(object, source).find((r) => r.id.record_id === recordId);
  if (!found) throw new CrmError(`No ${object} record ${recordId}`, 404);
  return found;
}

/**
 * Fetch many records by id.
 *
 * Chunked at 100 because the real API capped the number of constraint values in an
 * `$in` filter — a naive 500-id query returned "too many constraint values used" and a
 * 400. The chunk size is the whole reason the real refresh worked, so it is kept here
 * even though nothing local enforces it: the shape of this function is a record of what
 * the API actually allows.
 */
export async function getRecordsByIds(
  object: ParentObject,
  recordIds: string[],
): Promise<CrmRecord[]> {
  const unique = [...new Set(recordIds)];
  if (unique.length === 0) return [];

  const CHUNK = 100;
  const source = applyOverlay.records(
    object,
    object === "companies" ? COMPANY_RECORDS : PEOPLE_RECORDS,
  );
  const byId = new Map(source.map((r) => [r.id.record_id, r]));
  const out: CrmRecord[] = [];

  for (let i = 0; i < unique.length; i += CHUNK) {
    await tick();
    for (const id of unique.slice(i, i + CHUNK)) {
      const found = byId.get(id);
      if (found) out.push(found);
    }
  }

  return out;
}

/**
 * All companies on a list, with their LIST ENTRY values joined in.
 *
 * The join is the whole point of this function. `hq_city` (94% on Pipeline), the deal
 * `stage` (80%) and `product_overview` (96%) exist only on the entry. The first version
 * of this fetched entries purely to extract `parent_record_id` and threw `entry_values`
 * away — which made some of the best-covered data in the workspace invisible to the
 * app, and produced a confident, wrong report that a co-investment link did not exist.
 */
export async function getCompaniesInList(list: ListKey | string): Promise<Company[]> {
  const entries = await getListEntries(list);
  const records = await getRecordsByIds(
    "companies",
    entries.map((e) => e.parent_record_id),
  );
  const entryByRecord = new Map(entries.map((e) => [e.parent_record_id, e]));
  return records.map((r) => toCompany(r, entryByRecord.get(r.id.record_id)));
}

export async function getPeopleInList(list: ListKey | string): Promise<Person[]> {
  const entries = await getListEntries(list);
  const records = await getRecordsByIds(
    "people",
    entries.map((e) => e.parent_record_id),
  );
  const entryByRecord = new Map(entries.map((e) => [e.parent_record_id, e]));
  return records.map((r) => toPerson(r, entryByRecord.get(r.id.record_id)));
}

/**
 * Typeahead search by name.
 *
 * No list entry here — this searches the object, so entry-only fields (city, stage,
 * product overview) are null on these results. Callers use name and domain only, and
 * must not present a typeahead hit as if it carried full data.
 */
export async function searchCompaniesByName(query: string, limit = 10): Promise<Company[]> {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  await tick();
  return applyOverlay
    .records("companies", COMPANY_RECORDS)
    .filter((r) => (readName(r.values[COMPANY_FIELDS.name]) ?? "").toLowerCase().includes(trimmed))
    .slice(0, limit)
    .map((r) => toCompany(r));
}

/**
 * Notes, newest first. A page size of 50 exercises pagination.
 */
export async function listNotes(total = 500): Promise<CrmNote[]> {
  const all = applyOverlay
    .notes(NOTES)
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return paginate<CrmNote>(
    async (limit, offset) => {
      await tick();
      return all.slice(offset, offset + limit);
    },
    50,
    total,
  );
}

// ---------------------------------------------------------------------------
// Writes
//
// Every function below is reachable only from an API route that a human triggered by
// clicking a confirm button which showed them the exact payload first. Nothing here is
// called by the cron, by a page load, or by anything autonomous — see lib/refresh.ts
// and app/api/cron/digest, neither of which imports any of this.
//
// In this public build the writes land in a local overlay (lib/demo-store.ts) rather
// than in a CRM. The confirm step, the payload preview, the narrow-PATCH discipline and
// the double-click protection are all unchanged, because those are the parts worth
// showing.
// ---------------------------------------------------------------------------

export interface UpsertCompanyInput {
  name: string;
  /** Matching key for the upsert. Required — this is how the CRM dedupes. */
  domain: string;
  description?: string;
  theme?: string;
  canonicalSector?: string;
  subSectors?: string[];
  rounds?: string[];
}

/**
 * Create the company, or update the existing one with that domain.
 *
 * The real endpoint was `PUT …/records?matching_attribute=domains`, which does not
 * report whether it created or matched — so the caller infers "created" from the record
 * being less than 60 seconds old. Reproduced here rather than returning a clean
 * `created: boolean`, because the ambiguity is real and the UI has to cope with it.
 */
export async function upsertCompany(input: UpsertCompanyInput): Promise<Company> {
  await tick();
  const values: Record<string, unknown> = {
    [COMPANY_FIELDS.name]: input.name,
    [COMPANY_FIELDS.domains]: [{ domain: input.domain }],
  };
  if (input.description) values[COMPANY_FIELDS.description] = input.description;
  if (input.theme) values[COMPANY_FIELDS.theme] = input.theme;
  if (input.canonicalSector) values[COMPANY_FIELDS.canonicalSector] = input.canonicalSector;
  if (input.subSectors?.length) values[COMPANY_FIELDS.subSector] = input.subSectors;
  // Write to the field the team actually uses, never the empty legacy one. Reading both
  // and writing one is what stops the data splitting further.
  if (input.rounds?.length) values[COMPANY_FIELDS.roundCurrent] = input.rounds;

  const record = recordWrite.upsertRecord(
    "companies",
    COMPANY_FIELDS.domains,
    input.domain,
    values,
    COMPANY_RECORDS,
  );
  return toCompany(record);
}

export interface UpsertPersonInput {
  name: string;
  email: string;
  description?: string;
}

export async function upsertPerson(input: UpsertPersonInput): Promise<Person> {
  await tick();
  const values: Record<string, unknown> = {
    [PEOPLE_FIELDS.name]: input.name,
    [PEOPLE_FIELDS.emailAddresses]: [{ value: input.email }],
  };
  if (input.description) values[PEOPLE_FIELDS.description] = input.description;
  const record = recordWrite.upsertRecord(
    "people",
    PEOPLE_FIELDS.emailAddresses,
    input.email,
    values,
    PEOPLE_RECORDS,
  );
  return toPerson(record);
}

/**
 * Add a record to a list.
 *
 * Lists existing entries first and returns the existing one if the record is already
 * there, so a double-clicked confirm cannot create a duplicate. That check is cheap and
 * it has caught a real double-submit.
 */
export async function addRecordToList(
  list: ListKey,
  recordId: string,
  entryValues: Record<string, unknown> = {},
): Promise<CrmListEntry> {
  const existing = await getListEntries(list);
  const already = existing.find((e) => e.parent_record_id === recordId);
  if (already) return already;
  await tick();
  return recordWrite.addEntry(LISTS[list].slug, recordId, entryValues);
}

/**
 * Set the `reached_out` checkbox on a person.
 *
 * The narrowest possible write: exactly one attribute, nothing else, so it cannot
 * clobber a field somebody edited between the page load and the click. PATCH, not the
 * PUT upsert — PUT replaces the whole values payload.
 *
 * Takes an explicit boolean, never a toggle: a toggle derived from stale UI state will
 * eventually write the opposite of what the user saw.
 *
 * Returns the updated person so the caller reflects the real stored value rather than
 * optimistically assuming the write landed as sent.
 */
export async function setPersonReachedOut(recordId: string, reachedOut: boolean): Promise<Person> {
  // Read before writing, so the response echoes the whole record rather than just the
  // field that changed. The caller shows the person's name back to the user.
  const current = await getRecord("people", recordId);
  const record = recordWrite.patchRecord(
    "people",
    recordId,
    { [PEOPLE_FIELDS.reachedOut]: reachedOut },
    current,
  );
  return toPerson(record);
}

/**
 * Link a stealth founder to the company they went on to build.
 *
 * ⚠️  THE MOST DELIBERATE WRITE IN THIS APP.
 * This field has been 0% populated since the workspace was built, and whether to start
 * filling it is an owner decision, not a technical one. The launch matcher only ever
 * *suggests* a link. Nothing automatic may ever call this — not the cron, not a
 * background job, not an "accept all" button, which is why there is deliberately no
 * bulk path and no undo. One human, one founder, one confirm click.
 */
export async function setFounderConnectedCompany(
  personRecordId: string,
  companyRecordId: string,
): Promise<Person> {
  await getRecord("companies", companyRecordId);
  const current = await getRecord("people", personRecordId);
  const record = recordWrite.patchRecord(
    "people",
    personRecordId,
    {
      [PEOPLE_FIELDS.connectedPortco]: [
        { target_object: "companies", target_record_id: companyRecordId },
      ],
    },
    current,
  );
  return toPerson(record);
}

export async function createNote(input: {
  parentObject: ParentObject;
  recordId: string;
  title: string;
  content: string;
}): Promise<CrmNote> {
  await getRecord(input.parentObject, input.recordId);
  return recordWrite.addNote(input);
}
