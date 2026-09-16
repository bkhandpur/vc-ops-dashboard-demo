/**
 * Global search — pure, isomorphic, over the cached snapshots only.
 *
 * Read-only by design. This box finds things; it never writes. Writing to the CRM stays in
 * the command palette, where every action carries a confirm step showing the exact
 * payload. Keeping the two apart means a fast, low-friction search can never become a
 * fast, low-friction way to mutate the CRM by accident.
 *
 * It searches the snapshot rather than calling the CRM's own search endpoint, which is
 * what makes it instant and keeps the "page loads never call an external service" rule intact. The
 * trade-off is that it only knows what the last refresh knew — the UI states the
 * snapshot age.
 */

import type { StagedCompany } from "./aggregate";
import { crmRecordUrl, STAGE_LABELS, type StageKey } from "./constants";
import { fuzzySearch } from "./fuzzy";
import type { TrackedPerson } from "./people-derive";
import { personSubtitle } from "./people-derive";

export type SearchKind = "company" | "founder" | "coInvestor";

export interface SearchHit {
  kind: SearchKind;
  recordId: string;
  title: string;
  subtitle: string | null;
  /** Small right-aligned label: the stage list, or the person list. */
  meta: string | null;
  /** Where clicking goes. Companies have an in-app detail page; people go to the CRM. */
  href: string;
  external: boolean;
  logoUrl: string | null;
  /** Theme, so a company row can carry its identity swatch. */
  theme: string | null;
}

export const KIND_LABELS: Record<SearchKind, string> = {
  company: "Companies",
  founder: "Stealth Founders",
  coInvestor: "Co-Investors",
};

function stageMeta(stages: StageKey[]): string | null {
  if (!stages.length) return null;
  // Most-invested list wins the label — a company on both reads as Portfolio.
  const order: StageKey[] = ["portfolio", "pipeline", "archive"];
  const best = order.find((s) => stages.includes(s));
  return best ? STAGE_LABELS[best] : null;
}

export interface SearchIndex {
  companies: StagedCompany[];
  founders: TrackedPerson[];
  coInvestors: TrackedPerson[];
}

/**
 * Rank across all three record types at once.
 *
 * Results are capped per kind rather than globally, so a query matching 60 companies
 * cannot bury the one founder who also matched. That is the whole point of a single box
 * over three lists — if companies could crowd everything out, you would just have
 * company search with extra steps.
 */
export function searchAll(
  query: string,
  index: SearchIndex,
  perKindLimit = 6,
): { kind: SearchKind; hits: SearchHit[] }[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Ordered by weight: name beats domain beats prose beats tags. `summary` is the
  // best-covered prose (100% of Pipeline) so it earns a place ahead of the tag soup.
  const companyHits = fuzzySearch(trimmed, index.companies, (c) => [
    c.name ?? "",
    c.domains[0] ?? "",
    c.summary ?? "",
    c.location ?? "",
    [...c.industry, ...c.categories].join(" "),
  ])
    .slice(0, perKindLimit)
    .map(
      ({ item }): SearchHit => ({
        kind: "company",
        recordId: item.recordId,
        title: item.name ?? "Untitled company",
        subtitle: item.domains[0] ?? item.summary ?? null,
        // The Pipeline list's own status is more informative than the list name when
        // we have it — "Sourcing" tells you more than "Pipeline".
        meta: item.pipelineStage ?? stageMeta(item.stages),
        href: `/company/${item.recordId}`,
        external: false,
        logoUrl: item.logoUrl,
        theme: item.theme,
      }),
    );

  const personHits = (people: TrackedPerson[], kind: SearchKind, meta: string) =>
    fuzzySearch(trimmed, people, (p) => [
      p.name ?? "",
      p.linkedinCompany ?? "",
      p.linkedinPosition ?? p.jobTitle ?? "",
      p.highlights.join(" "),
      p.fundFirm ?? "",
    ])
      .slice(0, perKindLimit)
      .map(
        ({ item }): SearchHit => ({
          kind,
          recordId: item.recordId,
          title: item.name ?? "Unnamed person",
          subtitle: item.fundFirm ?? personSubtitle(item),
          meta,
          href: crmRecordUrl("people", item.recordId),
          external: true,
          logoUrl: item.avatarUrl,
          theme: null,
        }),
      );

  const groups = [
    { kind: "company" as const, hits: companyHits },
    {
      kind: "founder" as const,
      hits: personHits(index.founders, "founder", "Stealth Founder"),
    },
    {
      kind: "coInvestor" as const,
      hits: personHits(index.coInvestors, "coInvestor", "Co-Investor"),
    },
  ];

  return groups.filter((g) => g.hits.length > 0);
}
