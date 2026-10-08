"use client";

import { safeSampleLink } from "@/lib/sample-links";
import { ArrowLeft, ArrowUpRight, Check, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";

import { CompanyAvatar } from "@/components/CompanyAvatar";
import { useAsyncAction } from "@/components/useAsyncAction";
import { CoInvestorMatchPanel } from "@/components/company/CoInvestorMatchPanel";
import { SyndicatePanel } from "@/components/enrichment/SyndicatePanel";
import { ThemeSwatch } from "@/components/statistics/ThemeSwatch";
import { Badge, Button, Callout, cx, Footnote, Panel, PanelHeader } from "@/components/ui";
import type { Company } from "@/lib/crm";
import type { StagedCompany } from "@/lib/aggregate";
import type { EnrichedCompanyFact } from "@/lib/enrichment-snapshot";
import { crmRecordUrl, STAGE_LABELS, type StageKey } from "@/lib/constants";
import type { TrackedPerson } from "@/lib/people-derive";
import { personSubtitle } from "@/lib/people-derive";

/**
 * Everything the CRM holds about one company, from the cached snapshot.
 *
 * Only fields that are actually populated get a row. Rendering "Location: —" for the 97%
 * of companies with no location turns the page into a wall of dashes and buries the
 * facts that do exist; a field that is missing is reported once, at the bottom, as a
 * link to fix it.
 */
export function CompanyDetail({
  company,
  team,
  companies,
  coInvestors,
  enrichedFact,
  generatedAt,
}: {
  company: StagedCompany;
  team: TrackedPerson[];
  /** The full snapshot — the match panel resolves prior deal names against it. */
  companies: StagedCompany[];
  coInvestors: TrackedPerson[];
  /** Enrichment data for this company, or null when unavailable. */
  enrichedFact: EnrichedCompanyFact | null;
  generatedAt: string;
}) {
  /** Live values from an explicit "Refresh from the CRM" click, if one has happened. */
  const [live, setLive] = useState<Company | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  // Shared with the top-bar Refresh so both behave identically: disabled while running
  // (no double-fetch), and a brief success tick rather than silently going idle.
  const refresh = useAsyncAction(
    useCallback(async () => {
      const res = await fetch(`/api/crm/companies/${company.recordId}`);
      const body = (await res.json()) as
        { company: Company; fetchedAt: string } | { error: string };
      if (!res.ok || "error" in body) {
        throw new Error("error" in body ? body.error : `Failed (${res.status})`);
      }
      setLive(body.company);
      setFetchedAt(body.fetchedAt);
    }, [company.recordId]),
  );
  const refreshing = refresh.busy;
  const error = refresh.error;

  // Live values win when present; otherwise the snapshot.
  const name = live?.name ?? company.name;
  const description =
    live?.productOverview ?? live?.companySummary ?? live?.description ?? company.summary;
  const theme = live?.theme ?? company.theme;
  const canonicalSector = live?.canonicalSector ?? company.canonicalSector;
  const subSectors = live?.subSectors ?? company.subSectors;
  const rounds = live?.rounds ?? company.rounds;
  const domains = live?.domains ?? company.domains;
  const logoUrl = live?.logoUrl ?? company.logoUrl;
  const funding =
    live?.fundingRaisedUsd ??
    live?.enrichedFundingUsd ??
    company.fundingRaisedUsd ??
    company.enrichedFundingUsd;
  const arr = live?.estimatedArr ?? company.estimatedArr;
  const employeeRange = live?.numberOfEmployees ?? live?.employeeRange ?? company.employeeRange;
  // Prefer the list-entry `city` (88% on Pipeline) over `hq_location` (14%). A live
  // record refresh has no entry, so it falls back to the snapshot's city.
  const location = live?.city ?? company.location;
  const yearFounded = live?.yearFounded ?? company.yearFounded;
  const connectionStrength = live?.connectionStrength ?? company.connectionStrength;

  const crmUrl = crmRecordUrl("companies", company.recordId);

  const missing = [
    !canonicalSector && "canonical sector",
    subSectors.length === 0 && "sub-sector",
    rounds.length === 0 && "investment round",
    funding === null && "funding raised",
    !description && "description",
    domains.length === 0 && "domain",
    !location && "location",
    !employeeRange && "employee range",
  ].filter((v): v is string => typeof v === "string");

  return (
    <>
      <Link
        href="/portfolio"
        className="ws-enter mb-4 inline-flex items-center gap-1.5 text-[12px] text-ink-muted transition-colors hover:text-accent"
      >
        <ArrowLeft className="size-3.5" />
        Back to Portfolio
      </Link>

      <header className="ws-enter ws-delay-1 mb-6 flex items-start gap-4">
        <CompanyAvatar name={name} logoUrl={logoUrl} size={56} className="rounded-xl" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] leading-tight font-semibold text-ink">
              {name ?? "Untitled company"}
            </h1>
            {company.stages.map((stage: StageKey) => (
              <Badge key={stage} tone={stage === "portfolio" ? "positive" : "neutral"}>
                {STAGE_LABELS[stage]}
              </Badge>
            ))}
          </div>

          {description && (
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
              {description}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px]">
            {domains[0] && (
              <a
                href={safeSampleLink(`https://${domains[0]}`)}
                aria-disabled={!safeSampleLink(`https://${domains[0]}`)}
                title={
                  !safeSampleLink(`https://${domains[0]}`) ? "Fictional sample contact" : undefined
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                {domains[0]}
                <ArrowUpRight className="size-3" />
              </a>
            )}
            <a
              href={crmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-ink-muted hover:text-accent hover:underline"
            >
              Open in the CRM
              <ArrowUpRight className="size-3" />
            </a>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Button onClick={() => void refresh.run()} disabled={refreshing}>
            {refresh.status === "success" ? (
              <Check className="size-3.5 text-positive" />
            ) : (
              <RefreshCw className={cx("size-3.5", refreshing && "animate-spin")} />
            )}
            {refresh.status === "success"
              ? "Updated"
              : refreshing
                ? "Refreshing…"
                : "Refresh from the CRM"}
          </Button>
          <span className="text-[10px] text-ink-subtle">
            {fetchedAt
              ? `Record refreshed (UTC) ${new Date(fetchedAt).toLocaleTimeString("en-US", { timeZone: "UTC" })}`
              : `Snapshot ${new Date(generatedAt).toLocaleDateString("en-US", { timeZone: "UTC" })}`}
          </span>
        </div>
      </header>

      {error && (
        <div className="mb-4">
          <Callout tone="error">{error}</Callout>
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Panel className="ws-enter ws-delay-2 overflow-hidden lg:col-span-2">
          <PanelHeader title="Classification" />
          <dl className="divide-y divide-line">
            <Row label="Theme">
              {theme ? (
                <span className="inline-flex items-center gap-1.5">
                  <ThemeSwatch theme={theme} />
                  {theme}
                </span>
              ) : null}
            </Row>
            <Row label="Canonical sector">{canonicalSector}</Row>
            <Row label="Sub-sectors">
              {subSectors.length ? (
                <span className="flex flex-wrap gap-1">
                  {subSectors.map((s) => (
                    <Badge key={s}>{s}</Badge>
                  ))}
                </span>
              ) : null}
            </Row>
            <Row label="Investment round">
              {rounds.length ? (
                <span className="flex flex-wrap gap-1">
                  {rounds.map((r) => (
                    <Badge key={r} tone="accent">
                      {r}
                    </Badge>
                  ))}
                </span>
              ) : null}
            </Row>
          </dl>
        </Panel>

        <Panel className="ws-enter ws-delay-3 overflow-hidden">
          <PanelHeader title="Company facts" />
          <dl className="divide-y divide-line">
            <Row label="Funding raised">
              {funding !== null ? <span className="ws-nums">{formatUsd(funding)}</span> : null}
            </Row>
            <Row label="Estimated ARR">{arr}</Row>
            <Row label="Employees">{employeeRange}</Row>
            <Row label="Location">{location}</Row>
            <Row label="Founded">{yearFounded ? String(yearFounded) : null}</Row>
            <Row label="Last round">
              {company.lastFundingEur !== null ? formatEur(company.lastFundingEur) : null}
            </Row>
            <Row label="Valuation">{company.valuationText}</Row>
            <Row label="Headcount growth">
              {company.headcountGrowth !== null ? <Delta value={company.headcountGrowth} /> : null}
            </Row>
            <Row label="Web traffic 90d">
              {company.webTrafficGrowth !== null ? (
                <Delta value={company.webTrafficGrowth} />
              ) : null}
            </Row>
            <Row label="Connection">{connectionStrength}</Row>
            <Row label="Links">
              {company.linkedin || company.googleFolder || company.twitter ? (
                <span className="flex flex-wrap gap-3">
                  {company.linkedin && (
                    <a
                      href={safeSampleLink(company.linkedin)}
                      aria-disabled={!safeSampleLink(company.linkedin)}
                      title={
                        !safeSampleLink(company.linkedin) ? "Fictional sample contact" : undefined
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      LinkedIn
                    </a>
                  )}
                  {company.twitter && (
                    <a
                      href={safeSampleLink(company.twitter)}
                      aria-disabled={!safeSampleLink(company.twitter)}
                      title={
                        !safeSampleLink(company.twitter) ? "Fictional sample contact" : undefined
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      Twitter
                    </a>
                  )}
                  {company.googleFolder && (
                    <a
                      href={company.googleFolder}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      Drive folder
                    </a>
                  )}
                </span>
              ) : null}
            </Row>
          </dl>
          <Footnote>
            <span className="px-4 pb-3 block">
              Funding raised is the generated company total from <em>all</em> investors, not an
              investment position.
            </span>
          </Footnote>
        </Panel>
      </div>

      {(company.pipelineStage ||
        company.portfolioStatus ||
        company.dealType.length > 0 ||
        company.vehicle.length > 0 ||
        (company.raisingLowM ?? 0) > 0) && (
        <Panel className="ws-enter ws-delay-4 mt-4 overflow-hidden">
          <PanelHeader
            title="Deal"
            description="Where this sits in our process, and how we did or would invest."
          />
          <dl className="grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
            <Row label="Stage">{company.pipelineStage}</Row>
            <Row label="Portfolio status">{company.portfolioStatus}</Row>
            <Row label="Deal type">
              {company.dealType.length ? <Tags values={company.dealType} /> : null}
            </Row>
            <Row label="Vehicle">
              {company.vehicle.length ? <Tags values={company.vehicle} tone="accent" /> : null}
            </Row>
            <Row label="Raising">{formatRaise(company.raisingLowM, company.raisingHighM)}</Row>
            <Row label="Added to list">
              {company.addedToListAt
                ? new Date(company.addedToListAt).toLocaleDateString("en-US", { timeZone: "UTC" })
                : null}
            </Row>
          </dl>
        </Panel>
      )}

      {(company.industry.length > 0 ||
        company.categories.length > 0 ||
        company.clientFocus.length > 0 ||
        company.ownershipTypes.length > 0 ||
        company.investmentThemes.length > 0) && (
        <Panel className="ws-enter ws-delay-4 mt-4 overflow-hidden">
          <PanelHeader
            title="Enrichment tags"
            description="From the CRM and the enrichment provider. Separate from the taxonomy above. Statistics counts the company classifications."
          />
          <dl className="divide-y divide-line">
            <Row label="Investment theme">
              {company.investmentThemes.length ? <Tags values={company.investmentThemes} /> : null}
            </Row>
            <Row label="Industry">
              {company.industry.length ? <Tags values={company.industry} /> : null}
            </Row>
            <Row label="Categories">
              {company.categories.length ? <Tags values={company.categories} /> : null}
            </Row>
            <Row label="Client focus">
              {company.clientFocus.length ? <Tags values={company.clientFocus} /> : null}
            </Row>
            <Row label="Ownership">
              {company.ownershipTypes.length ? <Tags values={company.ownershipTypes} /> : null}
            </Row>
          </dl>
        </Panel>
      )}

      {company.teamStructure && (
        <Panel className="ws-enter ws-delay-5 mt-4 overflow-hidden">
          <PanelHeader title="Founders and team" />
          <p className="px-4 py-3 text-[13px] leading-relaxed whitespace-pre-line text-ink-muted">
            {company.teamStructure}
          </p>
        </Panel>
      )}

      {company.primaryRelationships && (
        <Panel className="ws-enter ws-delay-4 mt-4 overflow-hidden">
          <PanelHeader title="Relationships" />
          <p className="px-4 py-3 text-[13px] leading-relaxed whitespace-pre-line text-ink-muted">
            {company.primaryRelationships}
          </p>
        </Panel>
      )}

      {company.teamRecordIds.length > 0 && (
        <Panel className="ws-enter ws-delay-4 mt-4 overflow-hidden">
          <PanelHeader
            title="Team"
            description={`${company.teamRecordIds.length} linked ${
              company.teamRecordIds.length === 1 ? "person" : "people"
            } on the CRM record.`}
          />
          {team.length === 0 ? (
            <p className="px-4 py-4 text-[12px] text-ink-subtle">
              No linked detail is available in this view.{" "}
              <a
                href={crmUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                View the team in the CRM
              </a>
              .
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {team.map((person) => (
                <li key={person.recordId} className="flex items-center gap-3 px-4 py-2.5">
                  <CompanyAvatar name={person.name} logoUrl={person.avatarUrl} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">
                      {person.name ?? "Unnamed"}
                    </span>
                    {personSubtitle(person) && (
                      <span className="block truncate text-[11px] text-ink-subtle">
                        {personSubtitle(person)}
                      </span>
                    )}
                  </span>
                  <a
                    href={crmRecordUrl("people", person.recordId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-ink-subtle hover:text-accent"
                  >
                    <ArrowUpRight className="size-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <SyndicatePanel fact={enrichedFact} coInvestors={coInvestors} />

      <CoInvestorMatchPanel company={company} companies={companies} coInvestors={coInvestors} />

      {missing.length > 0 && (
        <div className="ws-enter ws-delay-5 mt-4">
          <Callout tone="warn">
            Missing in the CRM: {missing.join(", ")}.{" "}
            <a
              href={crmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline"
            >
              Fill them in
            </a>
            , then hit Refresh from the CRM.
          </Callout>
        </div>
      )}
    </>
  );
}

/** A definition row that renders nothing but a muted dash when the value is absent. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className="flex items-baseline gap-4 px-4 py-2.5">
      <dt className="w-36 shrink-0 text-[12px] text-ink-subtle">{label}</dt>
      <dd className={cx("min-w-0 flex-1 text-[13px]", empty ? "text-ink-subtle" : "text-ink")}>
        {empty ? "—" : children}
      </dd>
    </div>
  );
}

/** Compact tag list, so a 12-category company does not become a wall. */
function Tags({ values, tone }: { values: string[]; tone?: "accent" }) {
  return (
    <span className="flex flex-wrap gap-1">
      {values.map((v) => (
        <Badge key={v} tone={tone}>
          {v}
        </Badge>
      ))}
    </span>
  );
}

/** A signed percentage. Growth can legitimately be negative — show that, don't hide it. */
function Delta({ value }: { value: number }) {
  const rounded = Math.round(value * 10) / 10;
  const tone = rounded > 0 ? "text-positive" : rounded < 0 ? "text-negative" : "text-ink-muted";
  return (
    <span className={cx("ws-nums font-medium", tone)}>
      {rounded > 0 ? "+" : ""}
      {rounded}%
    </span>
  );
}

/** "$1M–$3M", "$1M+", or null when neither bound is set. */
function formatRaise(low: number | null, high: number | null): string | null {
  // A recorded 0 means "not raising" / not filled in, not "raising nothing". Treating it
  // as a value renders a meaningless "$0M" on a third of Pipeline.
  const lo = low && low > 0 ? low : null;
  const hi = high && high > 0 ? high : null;
  if (lo === null && hi === null) return null;
  if (lo !== null && hi !== null && hi > lo) return `$${lo}M–$${hi}M`;
  return `$${lo ?? hi}M`;
}

function formatEur(value: number): string {
  if (value >= 1_000_000_000) return `€${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`;
  return `€${value.toLocaleString("en-US")}`;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString("en-US")}`;
}
