/** Pure derivations over the generated people snapshot. */

/** A person as carried in the cached snapshot. */
export interface TrackedPerson {
  recordId: string;
  createdAt: string;
  name: string | null;
  email: string | null;
  description: string | null;
  linkedin: string | null;
  linkedinCompany: string | null;
  linkedinPosition: string | null;
  jobTitle: string | null;
  /**
   * Credential tags, unranked. An ARRAY, not a string: the provider returns these
   * unordered, so `highlights[0]` is not "the best one" — see the note on the founder
   * card badge in lib/founder-quality.ts, which is why the badge scores them instead.
   */
  highlights: string[];
  sourcedBy: string[];
  /** null = never set · false = explicitly not yet contacted · true = contacted. */
  reachedOut: boolean | null;
  avatarUrl: string | null;
  location: string | null;
  stageFocus: string | null;
  sectorThesisFocus: string | null;
  /** Generated education summary. */
  education: string | null;
  /** A handle, not a URL. */
  twitter: string | null;
  /** Source profile for the generated row. */
  sourceDocumentUrl: string | null;
  /**
   * Optional link between a generated founder and company record.
   */
  connectedCompanyId: string | null;

  // Co-investor list fields.
  /** The firm name. Prefer this over `name` when showing a co-investor. */
  fundFirm: string | null;
  checkSizeRange: string | null;
  /** Company names we have co-invested with them on. */
  dealsCoInvested: string[];
}

/**
 * Outreach state, the one engagement axis this workspace actually records.
 *
 * `unset` and `not-contacted` are kept apart on purpose: "we looked at this founder and
 * haven't reached out" is a different fact from "nobody has touched this record", and
 * collapsing them would hide 48 untriaged records inside 132 triaged ones.
 */
export type OutreachState = "contacted" | "not-contacted" | "unset";

export function outreachState(person: TrackedPerson): OutreachState {
  if (person.reachedOut === true) return "contacted";
  if (person.reachedOut === false) return "not-contacted";
  return "unset";
}

export const OUTREACH_LABELS: Record<OutreachState, string> = {
  contacted: "Contacted",
  "not-contacted": "Not yet contacted",
  unset: "Untriaged",
};

export interface SourcerRollup {
  /** Teammate name from the `sourced_by` select, or "Unattributed". */
  name: string;
  total: number;
  contacted: number;
  notContacted: number;
  unset: number;
}

export const UNATTRIBUTED = "Unattributed";

/**
 * Group founders by the teammate whose network they came from. A person can carry more
 * than one `sourced_by` value (it is a multiselect), so totals here are TAG counts and
 * can sum above the number of people — the same counting caveat the sub-sector level of
 * Statistics carries, and the UI states it the same way.
 */
export function rollupBySourcer(people: readonly TrackedPerson[]): SourcerRollup[] {
  const byName = new Map<string, SourcerRollup>();

  for (const person of people) {
    const sourcers = person.sourcedBy.length ? person.sourcedBy : [UNATTRIBUTED];
    const state = outreachState(person);
    for (const name of sourcers) {
      let row = byName.get(name);
      if (!row) {
        row = { name, total: 0, contacted: 0, notContacted: 0, unset: 0 };
        byName.set(name, row);
      }
      row.total += 1;
      if (state === "contacted") row.contacted += 1;
      else if (state === "not-contacted") row.notContacted += 1;
      else row.unset += 1;
    }
  }

  return [...byName.values()].sort((a, b) => {
    // Unattributed is a bucket, not a teammate — it sorts last regardless of size.
    if (a.name === UNATTRIBUTED) return 1;
    if (b.name === UNATTRIBUTED) return -1;
    return b.total - a.total;
  });
}

export interface FounderStats {
  total: number;
  contacted: number;
  notContacted: number;
  unset: number;
  withLinkedin: number;
  withEmail: number;
  withHighlights: number;
  withEducation: number;
}

export function founderStats(people: readonly TrackedPerson[]): FounderStats {
  return {
    total: people.length,
    contacted: people.filter((p) => outreachState(p) === "contacted").length,
    notContacted: people.filter((p) => outreachState(p) === "not-contacted").length,
    unset: people.filter((p) => outreachState(p) === "unset").length,
    withLinkedin: people.filter((p) => p.linkedin).length,
    withEmail: people.filter((p) => p.email).length,
    withHighlights: people.filter((p) => p.highlights.length > 0).length,
    withEducation: people.filter((p) => p.education).length,
  };
}

/**
 * The co-investor thesis text arrives as either a sentence ("Invests primarily in Digital
 * Health, Care Delivery.") or the literal string "unavailable" from whatever enrichment
 * wrote it. Split the sentence into tags so the directory can filter by focus area, and
 * treat "unavailable" as no data rather than as a focus area called "unavailable".
 *
 * The trailing-punctuation strip is not cosmetic: without it the last term in every
 * sentence carries a full stop, so "Care Delivery." and "Care Delivery" become two
 * different filter chips and the crosswalk in lib/matchmaking.ts misses the one with the
 * period. A filter list with near-duplicate entries is the visible symptom; a scorer
 * silently returning zero is the expensive one.
 */
export function parseThesisFocus(raw: string | null): string[] {
  if (!raw) return [];
  const text = raw.trim();
  if (!text || text.toLowerCase() === "unavailable") return [];
  const withoutPrefix = text.replace(/^invests?\s+primarily\s+in\s+/i, "");
  return withoutPrefix
    .split(",")
    .map((part) =>
      part
        .trim()
        .replace(/[.;]+$/, "")
        .trim(),
    )
    .filter(Boolean);
}

export interface FocusRollup {
  name: string;
  count: number;
}

export function rollupByFocus(people: readonly TrackedPerson[]): FocusRollup[] {
  const counts = new Map<string, number>();
  for (const person of people) {
    for (const focus of parseThesisFocus(person.sectorThesisFocus)) {
      counts.set(focus, (counts.get(focus) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * ── CO-INVESTMENT FREQUENCY — the analysis that turned out to be possible ────
 * An earlier pass concluded no co-investor→deal link existed anywhere in the workspace.
 * That was wrong, and wrong for an instructive reason: it only checked attributes on the
 * *people object*. The link lives on the **Co-Investors list entry**, in
 * `deals_co_invested` — a comma-separated list of company names, **100% populated**.
 * `GET /v2/objects/people/attributes` does not return list attributes at all.
 *
 * The names are free text, so they are matched to real company records by a normalised
 * name comparison. A name that matches nothing is still counted and still shown — it is
 * a real deal we co-invested on, it just is not on a list we snapshot.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Lowercase, strip punctuation and legal suffixes, so "Averlon Inc." ≡ "Averlon". */
export function normaliseCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|co|corp|company|holdings)\b\.?/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export interface CoInvestorRow {
  person: TrackedPerson;
  /** Firm name if we have one, otherwise the person's name. */
  label: string;
  deals: string[];
}

export interface DealRollup {
  /** The name as written in `deals_co_invested`. */
  name: string;
  /** Matching company recordId, when the name resolves to one we hold. */
  recordId: string | null;
  logoUrl: string | null;
  theme: string | null;
  /** Co-investors on this deal. */
  investors: CoInvestorRow[];
}

/** Companies ranked by how many co-investors we share them with. */
export function rollupByDeal(
  people: readonly TrackedPerson[],
  companies: readonly {
    recordId: string;
    name: string | null;
    logoUrl: string | null;
    theme: string | null;
  }[],
): DealRollup[] {
  const byNormalised = new Map<string, (typeof companies)[number]>();
  for (const c of companies) {
    if (c.name) byNormalised.set(normaliseCompanyName(c.name), c);
  }

  const deals = new Map<string, DealRollup>();

  for (const person of people) {
    const label = person.fundFirm ?? person.name ?? "Unnamed investor";
    for (const dealName of person.dealsCoInvested) {
      const key = normaliseCompanyName(dealName);
      if (!key) continue;
      let row = deals.get(key);
      if (!row) {
        const match = byNormalised.get(key);
        row = {
          name: match?.name ?? dealName,
          recordId: match?.recordId ?? null,
          logoUrl: match?.logoUrl ?? null,
          theme: match?.theme ?? null,
          investors: [],
        };
        deals.set(key, row);
      }
      row.investors.push({ person, label, deals: person.dealsCoInvested });
    }
  }

  return [...deals.values()].sort(
    (a, b) => b.investors.length - a.investors.length || a.name.localeCompare(b.name),
  );
}

/** Co-investors ranked by how many of our deals they appear on. */
export function rollupByInvestor(people: readonly TrackedPerson[]): CoInvestorRow[] {
  return people
    .filter((p) => p.dealsCoInvested.length > 0)
    .map((person) => ({
      person,
      label: person.fundFirm ?? person.name ?? "Unnamed investor",
      deals: person.dealsCoInvested,
    }))
    .sort((a, b) => b.deals.length - a.deals.length || a.label.localeCompare(b.label));
}

export function rollupByStageFocus(people: readonly TrackedPerson[]): FocusRollup[] {
  const counts = new Map<string, number>();
  for (const person of people) {
    if (person.stageFocus) counts.set(person.stageFocus, (counts.get(person.stageFocus) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

/** Best available one-line subtitle for a person row. */
export function personSubtitle(person: TrackedPerson): string | null {
  const role = person.linkedinPosition ?? person.jobTitle;
  const company = person.linkedinCompany;
  if (role && company) return `${role} · ${company}`;
  return role ?? company ?? person.highlights[0] ?? null;
}

/**
 * `parseThesisFocus` no longer needs its own "unavailable" check — `cleanText` in
 * lib/crm.ts normalises that placeholder to null at the API boundary, once, for every
 * field that carries it. The guard stays as a cheap belt-and-braces for cached snapshots
 * written before that change.
 */

/**
 * Founder text fields whose characters were lost upstream.
 *
 * Pure, and it never rewrites anything — see `hasLostCharacters` in lib/crm.ts for why
 * a repair pass is impossible here rather than merely unimplemented. This exists so the
 * Data Health view can report the damage and link to the record, which is the same thing
 * it does for every other gap: surface it, let a human fix it at source in the CRM.
 */
const REPLACEMENT = "\uFFFD";

export interface CorruptedTextRow {
  person: TrackedPerson;
  /** Which fields are affected, by their the CRM slug. */
  fields: string[];
}

const TEXT_FIELDS: [keyof TrackedPerson, string][] = [
  ["name", "name"],
  ["linkedinPosition", "linkedin_position"],
  ["linkedinCompany", "linkedin_company"],
  ["highlights", "person_highlights"],
  ["education", "education"],
  ["location", "current_location"],
];

export function findCorruptedText(people: readonly TrackedPerson[]): CorruptedTextRow[] {
  const rows: CorruptedTextRow[] = [];
  for (const person of people) {
    const fields: string[] = [];
    for (const [key, slug] of TEXT_FIELDS) {
      const value = person[key];
      if (typeof value === "string" && value.includes(REPLACEMENT)) fields.push(slug);
    }
    if (fields.length > 0) rows.push({ person, fields });
  }
  return rows.sort((a, b) => (a.person.name ?? "").localeCompare(b.person.name ?? ""));
}
