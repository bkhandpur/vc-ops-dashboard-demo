/**
 * Tear sheets — the written fields, assembled per theme or sector for reading
 * start-to-finish before a partner meeting. Pure, isomorphic, deterministic.
 *
 * The free-text fields are the best-covered data in the workspace and today they are
 * only readable one record at a time on the company detail page. Search finds one thing;
 * this is the opposite tool — everything in a group, in one scannable, printable pass.
 *
 * ── THE PIPELINE/PORTFOLIO INVERSION, HANDLED PER FIELD ──────────────────────
 * Most fields are richer on Portfolio, but the *written* fields invert — they are
 * maintained on Pipeline and thin on Portfolio:
 *
 *   field                   Pipeline   Portfolio
 *   product_overview        96%              (list attr, Pipeline only)
 *   business_summary        92%         68%
 *   team_notes              89%         50%
 *   relationship_notes     90%         68%
 *   description_enriched    43%         97%   ← inverted the other way
 *
 * So a single template assuming both lists look alike renders half-empty cards for
 * Portfolio. Each field below therefore carries its own ordered fallback chain and
 * reports **which source it came from**, rather than one chain applied uniformly.
 * `summary` is already chained in lib/stats.ts and reaches 100% on both lists.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { StagedCompany } from "./aggregate";
import { UNCLASSIFIED, type StageKey } from "./constants";

export type TearSheetGrouping = "theme" | "sector";

/** One block of prose on a card, with its provenance. */
export interface TearSheetField {
  key: "summary" | "team" | "relationships";
  label: string;
  value: string;
  /** Which the CRM field this text actually came from. Shown in the UI. */
  source: string;
}

export interface TearSheetEntry {
  company: StagedCompany;
  /** Only the blocks that have text. A card never renders an empty row. */
  fields: TearSheetField[];
  /** Which of the three blocks are missing, for the card's footer. */
  missing: string[];
  /** Pipeline / Portfolio / Archive, for the badge and the per-field fallback. */
  stages: StageKey[];
}

export interface TearSheetGroup {
  /** Theme or canonical-sector name. */
  name: string;
  /** Always the owning theme, so the group keeps its palette identity. */
  theme: string;
  entries: TearSheetEntry[];
  /** How many of this group's companies have all three blocks. */
  complete: number;
}

export interface TearSheetReport {
  grouping: TearSheetGrouping;
  groups: TearSheetGroup[];
  total: number;
  stagesIncluded: StageKey[];
  /** Share of (company × field) pairs that have text, 0–100. */
  coveragePct: number;
}

/**
 * Resolve the summary block.
 *
 * `summary` on the snapshot is the chained best-of
 * (product_overview → business_summary → description → description2) and is 100% on both
 * lists. `summarySource` records which link actually supplied it — knowing whether a
 * paragraph is a hand-written product overview or an enrichment blurb changes how much
 * weight a partner gives it, so the card names the real field rather than the chain.
 */
function summaryField(company: StagedCompany): TearSheetField | null {
  if (!company.summary) return null;
  return {
    key: "summary",
    label: "What they do",
    value: company.summary,
    source: company.summarySource ?? "unknown source",
  };
}

function teamField(company: StagedCompany): TearSheetField | null {
  if (!company.teamStructure) return null;
  return {
    key: "team",
    label: "Founders & team",
    value: company.teamStructure,
    source: "team_notes",
  };
}

function relationshipsField(company: StagedCompany): TearSheetField | null {
  if (!company.primaryRelationships) return null;
  return {
    key: "relationships",
    label: "How we know them",
    value: company.primaryRelationships,
    source: "relationship_notes",
  };
}

const ALL_BLOCKS = ["What they do", "Founders & team", "How we know them"] as const;

function buildEntry(company: StagedCompany): TearSheetEntry {
  const fields = [summaryField(company), teamField(company), relationshipsField(company)].filter(
    (f): f is TearSheetField => f !== null,
  );
  const present = new Set(fields.map((f) => f.label));
  return {
    company,
    fields,
    missing: ALL_BLOCKS.filter((b) => !present.has(b)),
    stages: company.stages,
  };
}

/**
 * Build the report.
 *
 * Companies are sorted within a group by how much is written about them, so the richest
 * cards come first — this is a document to be read in order, and leading with three
 * near-empty cards makes it look like there is nothing to read.
 */
export function buildTearSheets(
  companies: readonly StagedCompany[],
  stages: readonly StageKey[],
  grouping: TearSheetGrouping,
): TearSheetReport {
  const inScope = companies.filter((c) => c.stages.some((s) => stages.includes(s)));

  const groups = new Map<string, TearSheetGroup>();

  for (const company of inScope) {
    const theme = company.theme ?? UNCLASSIFIED;
    const name = grouping === "theme" ? theme : (company.canonicalSector ?? UNCLASSIFIED);

    let group = groups.get(name);
    if (!group) {
      group = { name, theme, entries: [], complete: 0 };
      groups.set(name, group);
    }
    const entry = buildEntry(company);
    group.entries.push(entry);
    if (entry.missing.length === 0) group.complete += 1;
  }

  const ordered = [...groups.values()]
    .map((group) => ({
      ...group,
      entries: [...group.entries].sort(
        (a, b) =>
          b.fields.length - a.fields.length ||
          (a.company.name ?? "").localeCompare(b.company.name ?? ""),
      ),
    }))
    .sort((a, b) => {
      // Unclassified is a reserved bucket, never a headline group.
      if (a.name === UNCLASSIFIED) return 1;
      if (b.name === UNCLASSIFIED) return -1;
      return b.entries.length - a.entries.length || a.name.localeCompare(b.name);
    });

  const filled = ordered.reduce(
    (sum, g) => sum + g.entries.reduce((s, e) => s + e.fields.length, 0),
    0,
  );
  const possible = inScope.length * ALL_BLOCKS.length;

  return {
    grouping,
    groups: ordered,
    total: inScope.length,
    stagesIncluded: [...stages],
    coveragePct: possible === 0 ? 0 : (filled / possible) * 100,
  };
}

/**
 * Plain-text rendering of one group, for copying into an email or a doc.
 *
 * Deliberately text rather than a file download: the app must never hand a viewer
 * something that looks like it was sent on their behalf, and the clipboard keeps the
 * user in control of where it goes.
 */
export function tearSheetToText(group: TearSheetGroup): string {
  const lines: string[] = [`${group.name}: ${group.entries.length} companies`, ""];

  for (const entry of group.entries) {
    lines.push(`## ${entry.company.name ?? "Unnamed company"}`);
    const meta = [
      entry.company.canonicalSector,
      entry.company.pipelineStage,
      entry.company.location,
      entry.company.yearFounded ? `founded ${entry.company.yearFounded}` : null,
    ].filter(Boolean);
    if (meta.length) lines.push(meta.join(" · "));
    lines.push("");
    for (const field of entry.fields) {
      lines.push(`${field.label}:`);
      lines.push(field.value);
      lines.push("");
    }
  }

  return lines.join("\n").trim();
}
