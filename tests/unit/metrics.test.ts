import { matchCoInvestors } from "@/lib/matchmaking";
import type { TrackedPerson } from "@/lib/people-derive";
import { escapeCsv } from "@/lib/csv";
import { describe, it, expect } from "vitest";
import { aggregate, type StagedCompany } from "@/lib/aggregate";
import { stageDistribution, momentumView, MOMENTUM_METRICS } from "@/lib/momentum";
import { safeSampleLink } from "@/lib/sample-links";
const company = (patch: Partial<StagedCompany>): StagedCompany => ({
  recordId: "a",
  name: "Same name",
  theme: "AI",
  canonicalSector: "Software",
  subSectors: ["Search"],
  rounds: ["Seed"],
  stages: ["pipeline"],
  domains: [],
  pipelineStage: null,
  headcountGrowth: null,
  webTrafficGrowth: null,
  industry: [],
  investmentThemes: [],
  logoUrl: null,
  fundingRaisedUsd: null,
  description: null,
  location: null,
  employeeRange: null,
  estimatedArr: null,
  yearFounded: null,
  createdAt: "2026-10-08T00:00:00Z",
  portfolioStatus: null,
  summary: null,
  summarySource: null,
  primaryRelationships: null,
  linkedin: null,
  googleFolder: null,
  enrichedFundingUsd: null,
  teamStructure: null,
  dealType: [],
  vehicle: [],
  raisingLowM: null,
  raisingHighM: null,
  valuationText: null,
  lastFundingEur: null,
  categories: [],
  clientFocus: [],
  ownershipTypes: [],
  headcount: null,
  twitter: null,
  addedToListAt: null,
  connectionUser: null,
  connectionStrength: null,
  connectionScore: null,
  teamRecordIds: [],
  ...patch,
});
describe("independent metric fixtures", () => {
  it("counts unique ids across lists and separates multi-tag memberships", () => {
    const rows = [
      company({ stages: ["pipeline", "portfolio"], subSectors: ["Search", "Tools"] }),
      company({ recordId: "b", theme: null, canonicalSector: null, subSectors: [] }),
    ];
    const result = aggregate(rows, ["pipeline", "portfolio"]);
    expect(result.total).toBe(2);
    expect(result.rows.reduce((n, r) => n + r.companies, 0)).toBe(3);
    expect(result.rows.find((r) => r.subSector === "Search")?.pctOfTotal).toBe(50);
  });
  it("derives stage percentages from the same population and handles empty data", () => {
    const result = stageDistribution([
      company({}),
      company({ recordId: "b", pipelineStage: "Initial review" }),
      company({ recordId: "c", pipelineStage: "Initial review" }),
    ]);
    expect(result.find((r) => r.stage === "Unset")?.pct).toBeCloseTo(100 / 3);
    expect(result.reduce((n, r) => n + r.count, 0)).toBe(3);
    expect(stageDistribution([])).toEqual([]);
  });
  it("preserves disclosed zero, negative growth and missing values", () => {
    const result = momentumView(
      [
        company({ stages: ["portfolio"], headcountGrowth: 0 }),
        company({ recordId: "b", stages: ["portfolio"], headcountGrowth: -10 }),
        company({ recordId: "c", stages: ["portfolio"] }),
      ],
      MOMENTUM_METRICS[0]!,
    );
    expect(result.inScope).toBe(3);
    expect(result.covered).toBe(2);
    expect(result.rows.map((r) => r.value)).toEqual([0, -10]);
    expect(result.coveragePct).toBeCloseTo(200 / 3);
    expect(momentumView([], MOMENTUM_METRICS[0]!).meetsBar).toBe(false);
  });
  it("disables fictional links and dangerous schemes while preserving source links", () => {
    expect(safeSampleLink("mailto:alex@firm.example")).toBeUndefined();
    expect(safeSampleLink("https://firm.example/person")).toBeUndefined();
    expect(safeSampleLink("javascript:alert(1)")).toBeUndefined();
    expect(safeSampleLink("https://github.com/bkhandpur")).toBe("https://github.com/bkhandpur");
  });
});

it("CSV text cannot execute as a spreadsheet formula", () => {
  expect(escapeCsv('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
  expect(escapeCsv("  +1")).toBe("'  +1");
  expect(escapeCsv("a,b")).toBe('"a,b"');
  expect(escapeCsv("ordinary")).toBe("ordinary");
});

it("match weights have independently expected points and missing-data limits", () => {
  const target = company({
    theme: "Health",
    canonicalSector: "Clinical Care",
    rounds: ["Seed"],
    summary: null,
    description: null,
  });
  const investor: TrackedPerson = {
    recordId: "i",
    name: "Investor",
    fundFirm: "Sample",
    sectorThesisFocus: "Digital Health",
    stageFocus: "Seed",
    dealsCoInvested: [],
    createdAt: "2026-10-08T00:00:00Z",
    email: null,
    description: null,
    linkedin: null,
    linkedinCompany: null,
    linkedinPosition: null,
    jobTitle: null,
    highlights: [],
    sourcedBy: [],
    reachedOut: null,
    avatarUrl: null,
    location: null,
    education: null,
    twitter: null,
    sourceDocumentUrl: null,
    connectedCompanyId: null,
    checkSizeRange: null,
  };
  const result = matchCoInvestors(target, [investor], []).matches[0]!;
  expect(result.score).toBe(70);
  expect(result.components.map((c) => c.points)).toEqual([45, 25, 0, 0]);
  expect(
    matchCoInvestors(target, [{ ...investor, sectorThesisFocus: null, stageFocus: null }], [])
      .matches[0]?.score,
  ).toBe(0);
});
