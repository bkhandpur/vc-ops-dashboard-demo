/**
 * Renders the sunburst to a standalone SVG from the real geometry module, and asserts
 * the invariants the drawing depends on. Run it after touching sunburst-geometry.ts:
 *
 *   npx tsx scripts/preview-sunburst.ts            (or: node --experimental-strip-types)
 *
 * Writes preview-sunburst-{root,drilled}-{light,dark}.svg next to the repo root so the
 * geometry and both colour modes can be eyeballed without booting the app.
 */

import { writeFileSync } from "node:fs";

import type { StatsNode } from "../lib/aggregate.ts";
import { fillFor, inkOn, type ColorMode } from "../components/statistics/colors.ts";
import {
  arcPath,
  buildArcs,
  CENTER,
  innerLabel,
  LABEL_FONT_PX,
  RING_1,
  RING_2,
  VIEW,
} from "../components/statistics/sunburst-geometry.ts";

/** Shaped like the dataset: 3 themes, 9 canonical sectors, a long sub-sector tail. */
const TREE: StatsNode[] = [
  theme("Care & Longevity", [
    sector("Clinical Care", 34, [
      ["Clinical Workflow", 9],
      ["Digital Health", 8],
      ["Care Delivery", 7],
      ["Diagnostics", 5],
      ["Life Sciences", 3],
    ]),
    sector("Consumer Wellbeing", 21, [
      ["Mental Health", 8],
      ["Fitness", 6],
      ["Nutrition", 5],
      ["Longevity", 4],
    ]),
    sector("Commerce Enablement", 9, [
      ["Consumer Brands", 5],
      ["Marketplaces", 4],
    ]),
    sector("Unclassified", 4, [["Unclassified", 4]]),
  ]),
  theme("Work & Craft", [
    sector("Workforce Software", 28, [
      ["Sales & Marketing Software", 10],
      ["Developer Tools", 8],
      ["AI Infrastructure", 7],
      ["Data Infrastructure", 5],
      ["Security", 3],
    ]),
    sector("Learning & Skills", 11, [
      ["Future of Work", 6],
      ["Learning", 5],
    ]),
    sector("Life Sciences Tools", 9, [
      ["Financial Infrastructure", 5],
      ["Payments", 4],
    ]),
  ]),
  theme("Planet & Resources", [
    sector("Freight & Mobility", 9, [
      ["Freight", 5],
      ["Fleet", 4],
    ]),
    sector("Energy Systems", 7, [
      ["Energy", 4],
      ["Food Systems", 3],
    ]),
    sector("Built Environment", 3, [["Built Environment", 3]]),
  ]),
];

function theme(name: string, children: StatsNode[]): StatsNode {
  return {
    name,
    level: "theme",
    value: children.reduce((sum, c) => sum + c.value, 0),
    children,
  };
}

function sector(name: string, value: number, subs: [string, number][]): StatsNode {
  return {
    name,
    level: "sector",
    value,
    children: subs.map(([subName, subValue]) => ({
      name: subName,
      level: "subSector" as const,
      value: subValue,
    })),
  };
}

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

let failures = 0;

function check(label: string, ok: boolean, detail = ""): void {
  if (!ok) failures++;
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
}

function verify(path: string[]): ReturnType<typeof buildArcs> {
  const built = buildArcs(TREE, path);
  const { arcs, levelTotal } = built;
  const label = path.length === 0 ? "root" : `drilled into ${path[0]}`;
  console.log(`\n${label}: ${arcs.length} arcs, level total ${levelTotal}`);

  const inner = arcs.filter((a) => a.depth === 0);
  const outer = arcs.filter((a) => a.depth === 1);

  check("no NaN in any path", arcs.every((a) => !arcPath(a).includes("NaN")));
  check(
    "every arc stays inside the viewBox",
    arcs.every((a) => a.rOuter <= CENTER && a.rInner > 0),
  );
  check(
    "inner ring covers the full circle (minus gaps)",
    Math.abs(inner.reduce((sum, a) => sum + (a.a1 - a.a0), 0) - Math.PI * 2) < 0.25,
    `${inner.reduce((sum, a) => sum + (a.a1 - a.a0), 0).toFixed(3)} rad`,
  );
  check("every sweep is positive", arcs.every((a) => a.a1 > a.a0));
  check(
    "inner-ring values sum to the level total",
    inner.reduce((sum, a) => sum + a.value, 0) === levelTotal,
  );
  check(
    "each outer group stays within its parent's sweep",
    inner.every((parent) => {
      const kids = outer.filter((o) => o.parent === parent.name);
      if (kids.length === 0) return true;
      const first = kids[0]!;
      const last = kids[kids.length - 1]!;
      // Padding shrinks children inside the parent's own padded span.
      return first.a0 >= parent.a0 - 0.05 && last.a1 <= parent.a1 + 0.05;
    }),
  );
  check(
    "rings do not overlap radially",
    RING_1.outer < RING_2.inner,
    `${RING_1.outer} < ${RING_2.inner}`,
  );
  check(
    "labels fit both arc length and tangent-in-band",
    inner.every((a) => {
      const lab = innerLabel(a);
      if (!lab) return true;
      const midR = (a.rInner + a.rOuter) / 2;
      const arcLength = (a.a1 - a.a0) * midR;
      const tangentFit = 2 * Math.sqrt(Math.max(0, a.rOuter ** 2 - midR ** 2));
      const width = lab.text.length * 6.4;
      return width <= arcLength - 4 && width <= tangentFit - 4;
    }),
  );
  check(
    "no label reads upside down",
    inner.every((a) => {
      const lab = innerLabel(a);
      return !lab || (lab.rotation >= -90.1 && lab.rotation <= 90.1);
    }),
  );

  return built;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function toSvg(
  built: ReturnType<typeof buildArcs>,
  caption: string,
  mode: ColorMode,
): string {
  const { arcs, levelTotal } = built;
  const surface = mode === "dark" ? "#1a1a19" : "#ffffff";
  const ink = mode === "dark" ? "#f5f5f3" : "#16191d";
  const inkMuted = mode === "dark" ? "#86857f" : "#8b949e";
  const inkSecondary = mode === "dark" ? "#a8a7a0" : "#59636e";
  const body = arcs
    .map((arc) => {
      const fill = fillFor(arc.theme, arc.depth, mode);
      return `<path d="${arcPath(arc)}" fill="${fill}"><title>${escapeXml(
        `${arc.name}: ${arc.valueLabel}, ${arc.shareLabel}`,
      )}</title></path>`;
    })
    .join("\n    ");

  const labels = arcs
    .filter((a) => a.depth === 0)
    .flatMap((arc) => {
      const lab = innerLabel(arc);
      if (!lab) return [];
      return [
        `<text x="${lab.x}" y="${lab.y}" transform="rotate(${lab.rotation} ${lab.x} ${lab.y})" text-anchor="middle" dominant-baseline="middle" font-size="${LABEL_FONT_PX}" font-weight="500" fill="${inkOn(
          fillFor(arc.theme, 0, mode),
        )}">${escapeXml(lab.text)}</text>`,
      ];
    })
    .join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW + 34}" width="440" height="474" font-family="system-ui, -apple-system, sans-serif">
    <rect width="100%" height="100%" fill="${surface}"/>
    ${body}
    ${labels}
    <text x="${CENTER}" y="${CENTER - 6}" text-anchor="middle" dominant-baseline="middle" font-size="46" font-weight="600" fill="${ink}">${levelTotal}</text>
    <text x="${CENTER}" y="${CENTER + 24}" text-anchor="middle" font-size="12" fill="${inkMuted}">companies</text>
    <text x="${CENTER}" y="${VIEW + 22}" text-anchor="middle" font-size="12" fill="${inkSecondary}">${escapeXml(caption)}</text>
  </svg>`;
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : "&quot;",
  );
}

const root = verify([]);
const drilled = verify(["Care & Longevity"]);

for (const mode of ["light", "dark"] as ColorMode[]) {
  writeFileSync(
    `preview-sunburst-root-${mode}.svg`,
    toSvg(root, `All themes → canonical sectors (${mode})`, mode),
  );
  writeFileSync(
    `preview-sunburst-drilled-${mode}.svg`,
    toSvg(drilled, `Care & Longevity → sectors → sub-sectors (${mode})`, mode),
  );
}

console.log(
  `\n${failures === 0 ? "All invariants hold." : `${failures} invariant(s) FAILED.`}`,
);
console.log("Wrote preview-sunburst-{root,drilled}-{light,dark}.svg");
process.exit(failures === 0 ? 0 : 1);
