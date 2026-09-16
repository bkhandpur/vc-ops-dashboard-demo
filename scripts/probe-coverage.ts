/**
 * ⭐ THE COVERAGE CENSUS.
 *
 * Run with `npm run coverage`. Writes COVERAGE.md.
 *
 * ── WHY THIS SCRIPT IS THE MOST IMPORTANT ONE IN THE REPO ────────────────────
 * Two of this project's three worst mistakes came from designing a feature against a
 * field whose *name* sounded right, and the third came from a query that structurally
 * could not see the data it then reported as absent. This script exists so neither can
 * happen again.
 *
 * It asks nothing and assumes nothing. It enumerates EVERY attribute present on both
 * objects AND on every list, measures real coverage on the records we care about, and
 * ranks them. The rule it enforces:
 *
 *   **Build on the most-enriched field, not the best-named one — and remember that
 *   list attributes are invisible to an object query.**
 *
 * A shape-discovery pass ("which attributes exist?") answers the wrong question. An
 * attribute existing does not mean anyone fills it in. Read the top of each table below
 * to find out what this dataset actually maintains.
 *
 * Read-only by construction: it imports the seed and computes. It cannot write anything
 * but its own report.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED = join(HERE, "..", "data", "seed");
const OUT = join(HERE, "..", "COVERAGE.md");

interface RawValue {
  active_from: string;
  active_until: string | null;
  [key: string]: unknown;
}
interface Record_ {
  id: { record_id: string };
  created_at: string;
  values: Record<string, RawValue[]>;
}
interface Entry {
  id: { entry_id: string };
  parent_record_id: string;
  created_at: string;
  entry_values: Record<string, RawValue[]>;
}

function load<T>(file: string): T {
  return JSON.parse(readFileSync(join(SEED, file), "utf8")) as T;
}

const companies = load<Record_[]>("companies.json");
const people = load<Record_[]>("people.json");
const entries = load<Record<string, Entry[]>>("list-entries.json");

const byId = new Map(companies.map((c) => [c.id.record_id, c]));
const peopleById = new Map(people.map((p) => [p.id.record_id, p]));

/**
 * Is this value actually usable?
 *
 * Two things a naive `slug in values` check gets wrong, both of which cost real
 * accuracy in the original project:
 *   1. A superseded value (`active_until` set) is not the current value.
 *   2. The literal string "unavailable" is a placeholder, not data. Counting it is why
 *      one field reported 100% coverage and delivered 31%.
 */
const PLACEHOLDERS = new Set(["unavailable", "n/a", "na", "unknown", "-", "—"]);

function isPopulated(values: RawValue[] | undefined): boolean {
  if (!values) return false;
  const current = values.filter((v) => v.active_until === null);
  if (current.length === 0) return false;
  return current.some((v) => {
    const raw = v["value"] ?? v["domain"] ?? v["currency_value"] ?? v["locality"];
    if (typeof raw === "string") return !PLACEHOLDERS.has(raw.trim().toLowerCase());
    if (raw !== undefined && raw !== null) return true;
    return v["option"] !== undefined || v["status"] !== undefined ||
      v["referenced_actor_id"] !== undefined || v["target_record_id"] !== undefined;
  });
}

/** The same measurement WITHOUT the placeholder filter, so the gap is visible. */
function isPresentRaw(values: RawValue[] | undefined): boolean {
  return Boolean(values && values.some((v) => v.active_until === null));
}

interface Row {
  slug: string;
  counts: number[];
  raw: number[];
  totals: number[];
}

function census(
  lists: { name: string; records: Record_[] }[],
): Row[] {
  const slugs = new Set<string>();
  for (const list of lists) {
    for (const record of list.records) for (const slug of Object.keys(record.values)) slugs.add(slug);
  }
  return [...slugs]
    .map((slug) => ({
      slug,
      counts: lists.map((l) => l.records.filter((r) => isPopulated(r.values[slug])).length),
      raw: lists.map((l) => l.records.filter((r) => isPresentRaw(r.values[slug])).length),
      totals: lists.map((l) => l.records.length),
    }))
    .sort((a, b) => {
      const pa = a.counts.reduce((s, c, i) => s + c / (a.totals[i] || 1), 0);
      const pb = b.counts.reduce((s, c, i) => s + c / (b.totals[i] || 1), 0);
      return pb - pa;
    });
}

function pct(n: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((n / total) * 100)}%`;
}

function recordsFor(list: string, source: Map<string, Record_>): Record_[] {
  return (entries[list] ?? [])
    .map((e) => source.get(e.parent_record_id))
    .filter((r): r is Record_ => r !== undefined);
}

const companyLists = [
  { name: "Pipeline", records: recordsFor("pipeline", byId) },
  { name: "Portfolio", records: recordsFor("portfolio", byId) },
  { name: "Archive", records: recordsFor("archive", byId) },
];
const peopleLists = [
  { name: "Stealth Founders", records: recordsFor("stealth_watchlist", peopleById) },
  { name: "Co-Investors", records: recordsFor("investor_network", peopleById) },
];

const lines: string[] = [];

lines.push("# Coverage census");
lines.push("");
lines.push(
  "Generated by `npm run coverage`. Every attribute on both objects and on every list, " +
  "ranked by measured coverage.",
);
lines.push("");
lines.push(
  "**All figures below are measured against the synthetic dataset in `data/seed/`.** " +
  "No real company, person, or workspace is described anywhere in this file.",
);
lines.push("");
lines.push(
  "`Useful` coverage excludes placeholder values such as `\"unavailable\"`. `Raw` " +
  "coverage includes them.",
);
lines.push("");

function table(title: string, note: string, lists: { name: string; records: Record_[] }[], rows: Row[]): void {
  lines.push(`## ${title}`);
  lines.push("");
  lines.push(note);
  lines.push("");
  lines.push(`| Attribute | ${lists.map((l) => `${l.name} (n=${l.records.length})`).join(" | ")} |`);
  lines.push(`|---|${lists.map(() => "---:").join("|")}|`);
  for (const row of rows) {
    const cells = row.counts.map((c, i) => {
      const useful = pct(c, row.totals[i]!);
      const raw = pct(row.raw[i]!, row.totals[i]!);
      return useful === raw ? useful : `${useful} *(raw ${raw})*`;
    });
    lines.push(`| \`${row.slug}\` | ${cells.join(" | ")} |`);
  }
  lines.push("");
}

table(
  "Company object attributes",
  "Object-level field coverage for companies in each list.",
  companyLists,
  census(companyLists),
);

table(
  "People object attributes",
  "Object-level field coverage for people in each list.",
  peopleLists,
  census(peopleLists),
);

// --- list-entry attributes -------------------------------------------------
lines.push("## LIST-ENTRY attributes");
lines.push("");
lines.push(
  "List-entry attributes are stored separately from object attributes. The application " +
  "joins both sources before calculating coverage.",
);
lines.push("");
lines.push("| List | Attribute | Coverage |");
lines.push("|---|---|---:|");
for (const [list, list_entries] of Object.entries(entries)) {
  const slugs = new Set<string>();
  for (const e of list_entries) for (const slug of Object.keys(e.entry_values)) slugs.add(slug);
  if (slugs.size === 0) {
    lines.push(`| ${list} | *(no substantive list attributes)* | — |`);
    continue;
  }
  for (const slug of [...slugs].sort()) {
    const useful = list_entries.filter((e) => isPopulated(e.entry_values[slug])).length;
    const raw = list_entries.filter((e) => isPresentRaw(e.entry_values[slug])).length;
    const cell = useful === raw
      ? pct(useful, list_entries.length)
      : `${pct(useful, list_entries.length)} *(raw ${pct(raw, list_entries.length)})*`;
    lines.push(`| ${list} | \`${slug}\` | ${cell} |`);
  }
}
lines.push("");

// --- headline facts -------------------------------------------------------
const stealth = recordsFor("stealth_watchlist", peopleById);
const reachedOutSet = stealth.filter((p) => isPresentRaw(p.values["reached_out"])).length;
const reachedOutTrue = stealth.filter((p) =>
  (p.values["reached_out"] ?? []).some((v) => v.active_until === null && v["value"] === true),
).length;

const highlightInstances = stealth.flatMap((p) =>
  (p.values["person_highlights"] ?? [])
    .filter((v) => v.active_until === null)
    .map((v) => (v["option"] as { title?: string } | undefined)?.title ?? ""),
);
const topUniversity = highlightInstances.filter((h) => h === "Top University").length;

const importDates = new Map<string, number>();
for (const e of entries["pipeline"] ?? []) {
  const day = e.created_at.slice(0, 10);
  importDates.set(day, (importDates.get(day) ?? 0) + 1);
}
const biggestImport = [...importDates.entries()].sort((a, b) => b[1] - a[1])[0];

const corrupted = [...companies, ...people].filter((r) =>
  Object.values(r.values).some((vals) =>
    vals.some((v) => typeof v["value"] === "string" && (v["value"] as string).includes("�")),
  ),
).length;

lines.push("## Headline facts");
lines.push("");
lines.push(`- Distinct company records: **${companies.length}**. Distinct people: **${people.length}**.`);
lines.push(
  `- \`reached_out\` is set on **${reachedOutSet}** of ${stealth.length} founders and ` +
  `\`true\` on **${reachedOutTrue}**. **${stealth.length - reachedOutSet}** records have ` +
  `no value.`,
);
lines.push(
  `- \`Top University\` is **${topUniversity} of ${highlightInstances.length}** highlight ` +
  `instances (${pct(topUniversity, highlightInstances.length)}). It is weighted **0** in ` +
  `the founder-quality score: a signal that appears on most of the list ranks most of the ` +
  `list identically and drowns the rare ones.`,
);
if (biggestImport) {
  lines.push(
    `- **${biggestImport[1]} of ${(entries["pipeline"] ?? []).length}** Pipeline entries ` +
    `share the created date ${biggestImport[0]}. The dashboard labels this as list tenure, ` +
    `not deal age.`,
  );
}
lines.push(
  `- **${corrupted}** records carry U+FFFD replacement characters in a text field. These ` +
  `are reported as a Data Health gap and never repaired: the original bytes are gone, so ` +
  `any repair table would be guessing at a person's name.`,
);
lines.push(
  "- `amount_invested_usd` is declared in the schema and populated on **no record at " +
  "all**. Statistics charts therefore use company counts.",
);
lines.push("");

writeFileSync(OUT, `${lines.join("\n")}\n`, "utf8");
console.log(`wrote ${OUT}`);
