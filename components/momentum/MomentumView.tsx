"use client";

import { SAMPLE_REFERENCE_DATE } from "@/lib/demo-clock";
import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { CompanyAvatar } from "@/components/CompanyAvatar";
import { ThemeSwatch } from "@/components/statistics/ThemeSwatch";
import {
  Badge,
  Callout,
  EmptyState,
  Footnote,
  Panel,
  PanelHeader,
  PageHeader,
  Segmented,
  cx,
} from "@/components/ui";
import type { StagedCompany } from "@/lib/aggregate";
import {
  MOMENTUM_METRICS,
  momentumView,
  stageDistribution,
  tenureView,
  type EnrichedMomentumFact,
  type MomentumMetric,
} from "@/lib/momentum";

/**
 * Portfolio momentum and Pipeline stage tenure.
 *
 * Read the header of lib/momentum.ts before changing anything here — two of this page's
 * three panels exist in the shape they do because of what the data turned out to be,
 * and a fourth (Pipeline-side growth) is deliberately absent.
 */
export function MomentumView({
  companies,
  enrichedFacts,
  generatedAt,
  enrichmentGeneratedAt,
}: {
  companies: StagedCompany[];
  enrichedFacts: EnrichedMomentumFact[];
  generatedAt: string;
  enrichmentGeneratedAt: string | null;
}) {
  const [metric, setMetric] = useState<MomentumMetric>("headcountGrowth");
  const [stage, setStage] = useState<"portfolio" | "pipeline">("portfolio");

  const stages = useMemo(() => stageDistribution(companies), [companies]);
  const tenure = useMemo(
    () => tenureView(companies, Date.parse(SAMPLE_REFERENCE_DATE)),
    [companies],
  );

  // Prefer generated enrichment facts and use the local CRM shape as a fallback.
  const source = enrichmentGeneratedAt ? "enrichment" : "crm";
  const momentum = useMemo(() => {
    const def = MOMENTUM_METRICS.find((m) => m.key === metric)!;
    return momentumView(companies, def, stage, source, enrichedFacts);
  }, [companies, metric, stage, source, enrichedFacts]);

  const unsetPct = stages.find((row) => row.stage === "Unset")?.pct ?? 0;
  const maxStage = stages.reduce((m, s) => Math.max(m, s.count), 0);

  return (
    <div>
      <PageHeader
        eyebrow="Analyze"
        title="Momentum"
        description="Pipeline stage, time on list and company growth."
      />

      {/* ── Stage funnel: the part that rests on solid data, so it leads ───────── */}
      <Panel className="ws-enter overflow-hidden">
        <PanelHeader
          title="Pipeline by deal stage"
          description={`Pipeline deal-stage field: ${(100 - unsetPct).toFixed(0)}% recorded.`}
        />
        <ul className="p-4">
          {stages.map((row, index) => (
            <li
              key={row.stage}
              className="ws-settle ws-stagger mb-2 flex items-center gap-3 last:mb-0"
              style={{ "--i": index } as React.CSSProperties}
            >
              <span className="w-28 shrink-0 text-[12px] text-ink-muted">{row.stage}</span>
              <span className="relative h-5 flex-1 overflow-hidden rounded-[4px] bg-surface-sunken">
                <span
                  className="ws-bar-grow ws-stagger absolute inset-y-0 left-0 rounded-[4px] bg-accent"
                  style={
                    {
                      width: `${maxStage === 0 ? 0 : (row.count / maxStage) * 100}%`,
                      "--i": index,
                    } as React.CSSProperties
                  }
                />
              </span>
              <span className="ws-nums w-16 shrink-0 text-right text-[12px] text-ink">
                {row.count}
                <span className="ml-1 text-ink-subtle">{row.pct.toFixed(0)}%</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="px-4 pb-3">
          <Footnote>
            Bars are monochrome because they encode magnitude within one funnel, not theme identity.
            &ldquo;Unset&rdquo; is {unsetPct.toFixed(0)}% of Pipeline with no stage recorded, kept
            visible rather than dropped.
          </Footnote>
        </div>
      </Panel>

      {/* ── Tenure: real field, but it measures the import until more data accrues ── */}
      <Panel className="ws-enter ws-delay-1 mt-4 overflow-hidden">
        <PanelHeader
          title="Time on the Pipeline list"
          description="Days since each company was added to the CRM, grouped by deal stage."
          actions={<Badge tone="neutral">{tenure.total} companies</Badge>}
        />

        {tenure.dominatedByImport && (
          <div className="px-4 pt-3">
            <Callout tone="warn">
              Tenure measures time in the CRM, not deal age. {tenure.importCount} of {tenure.total}{" "}
              entries share the {tenure.importDate} import date.
            </Callout>
          </div>
        )}

        <ul className="divide-y divide-line">
          {tenure.buckets.map((bucket, index) => (
            <li
              key={bucket.stage}
              className="ws-settle ws-stagger px-4 py-2.5"
              style={{ "--i": index } as React.CSSProperties}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-ink">{bucket.stage}</span>
                <span className="flex items-center gap-3 text-[12px] text-ink-muted">
                  <span className="ws-nums">
                    {bucket.rows.length}{" "}
                    <span className="text-ink-subtle">
                      {bucket.rows.length === 1 ? "company" : "companies"}
                    </span>
                  </span>
                  <span className="ws-nums">
                    median <strong className="text-ink">{bucket.medianDays}d</strong>
                  </span>
                  <Badge tone={bucket.sinceImport > 0 ? "accent" : "neutral"}>
                    {bucket.sinceImport} since import
                  </Badge>
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="px-4 pb-3">
          <Footnote>
            Measured from the generated list entry&rsquo;s <code>created_at</code>. This shows time
            on the list, not relationship activity.
          </Footnote>
        </div>
      </Panel>

      {/* Company growth, subject to the coverage guard below. */}
      <Panel className="ws-enter ws-delay-2 mt-4 overflow-hidden">
        <PanelHeader
          title="Company momentum"
          description={
            momentum.source === "enrichment"
              ? "Growth from the enrichment time series."
              : momentum.metric.description
          }
          actions={
            <div className="flex items-center gap-2">
              <Segmented<"portfolio" | "pipeline">
                ariaLabel="List"
                value={stage}
                onChange={setStage}
                options={[
                  { value: "portfolio", label: "Portfolio" },
                  { value: "pipeline", label: "Pipeline" },
                ]}
              />
              <Segmented<MomentumMetric>
                ariaLabel="Momentum metric"
                value={metric}
                onChange={setMetric}
                options={MOMENTUM_METRICS.map((m) => ({
                  value: m.key,
                  label: m.key === "headcountGrowth" ? "Headcount" : "Web traffic",
                  title: m.slug,
                }))}
              />
            </div>
          }
        />

        {!momentum.meetsBar ? (
          <EmptyState title="Coverage too thin to draw" icon={<TrendingUp className="size-6" />}>
            Only {momentum.covered} of {momentum.inScope} {stage} companies (
            {momentum.coveragePct.toFixed(0)}%) carry {momentum.metric.label.toLowerCase()} from{" "}
            {momentum.source === "enrichment" ? "the generated enrichment sample" : "the CRM"},
            below the 40% bar this project holds. A chart from that is a ranking of whoever happens
            to be enriched.
          </EmptyState>
        ) : (
          <>
            <ul className="p-4">
              {momentum.rows.map((row, index) => (
                <MomentumRow
                  key={row.company.recordId}
                  company={row.company}
                  value={row.value}
                  maxAbs={momentum.maxAbs}
                  index={index}
                />
              ))}
            </ul>
            <div className="px-4 pb-3">
              <Footnote>
                {momentum.covered} of {momentum.inScope} {stage} companies (
                {momentum.coveragePct.toFixed(0)}%) have a figure, sourced from{" "}
                <strong>
                  {momentum.source === "enrichment"
                    ? "the generated enrichment sample"
                    : "the generated CRM fields"}
                </strong>
                . The rest are absent rather than shown as zero, and negative sample values are
                preserved.
                {momentum.source === "enrichment" && momentum.withoutDomain > 0 && (
                  <>
                    {" "}
                    {momentum.withoutDomain} of them have no domain in the CRM and therefore cannot
                    be matched to the enrichment sample. This is a{" "}
                    <Link href="/data-health" className="text-accent hover:underline">
                      Data Health
                    </Link>{" "}
                    gap, not an enrichment one.
                  </>
                )}
              </Footnote>
            </div>
          </>
        )}
      </Panel>

      <p className="mt-4 text-[11px] text-ink-subtle">
        CRM snapshot {new Date(generatedAt).toLocaleString("en-US", { timeZone: "UTC" })}
        {enrichmentGeneratedAt
          ? ` · enrichment snapshot ${new Date(enrichmentGeneratedAt).toLocaleString("en-US", { timeZone: "UTC" })}`
          : ""}
        .{" "}
        <Link href="/data-health" className="text-accent hover:underline">
          See what else is missing
        </Link>
        .
      </p>
    </div>
  );
}

/**
 * A signed bar on a symmetric axis, so growth and decline read as opposite directions
 * from a shared centre rather than as two lengths you have to compare by their labels.
 */
function MomentumRow({
  company,
  value,
  maxAbs,
  index,
}: {
  company: StagedCompany;
  value: number;
  maxAbs: number;
  index: number;
}) {
  const share = maxAbs === 0 ? 0 : (Math.abs(value) / maxAbs) * 50;
  const positive = value >= 0;

  return (
    <li
      className="ws-settle ws-stagger mb-1.5 flex items-center gap-3 last:mb-0"
      style={{ "--i": index } as React.CSSProperties}
    >
      <Link
        href={`/company/${company.recordId}`}
        className="flex w-52 shrink-0 items-center gap-2 text-[12px] text-ink hover:text-accent"
      >
        <CompanyAvatar name={company.name} logoUrl={company.logoUrl} size={18} />
        <span className="truncate">{company.name ?? "Unnamed"}</span>
        {company.theme && <ThemeSwatch theme={company.theme} />}
      </Link>

      <span className="relative h-4 flex-1 rounded-[3px] bg-surface-sunken">
        {/* The zero line, so the sign is readable without reading the number. */}
        <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
        <span
          className={cx(
            "ws-bar-grow ws-stagger absolute inset-y-0 rounded-[3px]",
            positive ? "bg-positive" : "bg-negative",
          )}
          style={
            {
              left: positive ? "50%" : `${50 - share}%`,
              width: `${share}%`,
              transformOrigin: positive ? "left center" : "right center",
              "--i": index,
            } as React.CSSProperties
          }
        />
      </span>

      <span
        className={cx(
          "ws-nums w-16 shrink-0 text-right text-[12px]",
          positive ? "text-positive" : "text-negative",
        )}
      >
        {positive ? "+" : ""}
        {value.toFixed(1)}%
      </span>
    </li>
  );
}
