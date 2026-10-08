/**
 * Assert that the coverage percentages written in lib/constants.ts match what the data
 * actually measures. Run with `npm run check:docs`, or `npm run check:docs -- --fix` to
 * rewrite them.
 *
 * ── WHY THIS SCRIPT EXISTS ───────────────────────────────────────────────────
 * lib/constants.ts documents, per field, how much of it is actually populated. That
 * annotation is the most useful thing in the file — it is what stops the next person
 * building a feature on a field that looks important and is empty.
 *
 * It is also the easiest thing in the repo to get quietly wrong. The numbers drifted
 * twice while this project was being assembled: once because they were carried over from
 * a different dataset, and once because the data was regenerated and the comments were
 * not. Neither produced an error. Both produced a file that reads authoritatively and
 * describes something that is not there.
 *
 * A comment that claims a measurement should be checkable against the measurement. This
 * makes it so: `npm run coverage && npm run check:docs` fails the build-adjacent check
 * if any documented figure is off by more than a rounding step.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CONSTANTS = join(ROOT, "lib", "constants.ts");
const COVERAGE = join(ROOT, "COVERAGE.md");

const fix = process.argv.includes("--fix");

// ---------------------------------------------------------------------------
// Parse the measured table
// ---------------------------------------------------------------------------

interface Measured {
  /** Company lists, in Pipeline/Portfolio/Archive order. */
  company?: [number, number, number];
  /** People lists, in Stealth/Co-Investor order. */
  people?: [number, number];
  /** List-entry coverage, keyed by list slug. */
  entry?: Record<string, number>;
}

const measured = new Map<string, Measured>();

function cell(raw: string): number {
  // "30% *(raw 100%)*" → 30. The useful figure is the one that matters.
  const m = /(\d+)%/.exec(raw.trim());
  return m ? Number(m[1]) : 0;
}

let section = "";
for (const line of readFileSync(COVERAGE, "utf8").split("\n")) {
  if (line.startsWith("## ")) {
    section = line.includes("Company")
      ? "company"
      : line.includes("People")
        ? "people"
        : line.includes("LIST-ENTRY")
          ? "entry"
          : "";
    continue;
  }
  if (!line.startsWith("| ")) continue;
  const cells = line
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c !== "");
  if (cells.length < 2) continue;

  if (section === "entry") {
    const [list, slugCell, value] = cells;
    if (!slugCell?.startsWith("`")) continue;
    const slug = slugCell.replaceAll("`", "");
    const prev = measured.get(slug) ?? {};
    prev.entry = { ...(prev.entry ?? {}), [list!]: cell(value ?? "") };
    measured.set(slug, prev);
    continue;
  }

  const slugCell = cells[0]!;
  if (!slugCell.startsWith("`")) continue;
  const slug = slugCell.replaceAll("`", "");
  const prev = measured.get(slug) ?? {};
  if (section === "company" && cells.length >= 4) {
    prev.company = [cell(cells[1]!), cell(cells[2]!), cell(cells[3]!)];
  } else if (section === "people" && cells.length >= 3) {
    prev.people = [cell(cells[1]!), cell(cells[2]!)];
  }
  measured.set(slug, prev);
}

// ---------------------------------------------------------------------------
// Walk constants.ts, pairing each documented triple with the slug it precedes
// ---------------------------------------------------------------------------

const lines = readFileSync(CONSTANTS, "utf8").split("\n");
/** `key: "slug",` — the value is what COVERAGE.md is keyed on. */
const SLUG_LINE = /^\s*\w+:\s*"([a-z0-9_]+)",\s*$/;
/** A documented Pipeline/Portfolio/Archive triple. */
const TRIPLE = /\b(\d{1,3})\/(\d{1,3})\/(\d{1,3})\b/;

interface Finding {
  line: number;
  slug: string;
  documented: string;
  actual: string;
}

const findings: Finding[] = [];
/** Rounding in the report is to whole percents, so allow one step of slack. */
const TOLERANCE = 1;

for (let i = 0; i < lines.length; i += 1) {
  const slugMatch = SLUG_LINE.exec(lines[i]!);
  if (!slugMatch) continue;
  const slug = slugMatch[1]!;
  const m = measured.get(slug);
  if (!m?.company) continue;

  // Look back over the contiguous comment block above this entry.
  for (let j = i - 1; j >= 0 && j > i - 14; j -= 1) {
    const line = lines[j]!;
    if (!/^\s*(\*|\/\*)/.test(line)) break;
    const t = TRIPLE.exec(line);
    if (!t) continue;

    const documented = [Number(t[1]), Number(t[2]), Number(t[3])] as const;
    const actual = m.company;
    const off = documented.some((d, k) => Math.abs(d - actual[k]!) > TOLERANCE);
    if (off) {
      findings.push({
        line: j + 1,
        slug,
        documented: documented.join("/"),
        actual: actual.join("/"),
      });
      if (fix) {
        lines[j] = line.replace(TRIPLE, actual.join("/"));
      }
    }
    break;
  }
}

if (fix && findings.length > 0) {
  writeFileSync(CONSTANTS, lines.join("\n"), "utf8");
  console.log(`rewrote ${findings.length} documented triples in lib/constants.ts`);
  for (const f of findings) {
    console.log(`  line ${f.line}  ${f.slug}: ${f.documented} → ${f.actual}`);
  }
  process.exit(0);
}

if (findings.length === 0) {
  console.log(
    `documented coverage matches measured coverage ` +
      `(${measured.size} slugs in COVERAGE.md, ±${TOLERANCE}%)`,
  );
  process.exit(0);
}

console.error(`${findings.length} documented coverage figure(s) do not match the data:\n`);
for (const f of findings) {
  console.error(`  lib/constants.ts:${f.line}  ${f.slug}`);
  console.error(`    documented ${f.documented}   measured ${f.actual}`);
}
console.error(`\nRun \`npm run coverage\` then \`npm run check:docs -- --fix\`.`);
process.exit(1);
