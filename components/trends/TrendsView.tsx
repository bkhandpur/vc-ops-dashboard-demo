"use client";

import { TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { ThemeSwatch } from "@/components/statistics/ThemeSwatch";
import {
  Badge,
  Callout,
  EmptyState,
  Footnote,
  PageHeader,
  Panel,
  PanelHeader,
  Segmented,
  StatTile,
} from "@/components/ui";
import { STAGE_LABELS, type StageKey } from "@/lib/constants";
import {
  conversionByTheme,
  delta,
  healthSeries,
  pipelineSizeSeries,
  rollingConversion,
  sectorCoverageSeries,
  themeMixSeries,
  type TrendSeries,
} from "@/lib/trends";

import { LineChart } from "./LineChart";
import { ThemeMixChart } from "./ThemeMixChart";

/** Illustrative history generated from the fixed sample dataset. */
export function TrendsView({
  series,
  storedDigests,
}: {
  series: TrendSeries;
  storedDigests: number;
}) {
  const [mixStage, setMixStage] = useState<StageKey>("pipeline");

  const sizeSeries = useMemo(() => pipelineSizeSeries(series), [series]);
  const coverage = useMemo(() => sectorCoverageSeries(series), [series]);
  const mix = useMemo(() => themeMixSeries(series, mixStage), [series, mixStage]);
  const conversion = useMemo(() => conversionByTheme(series), [series]);
  const rolling = useMemo(() => rollingConversion(series, 12), [series]);
  const health = useMemo(() => healthSeries(series), [series]);

  const pipelineDelta = delta(sizeSeries[0]!);
  const portfolioDelta = delta(sizeSeries[1]!);
  const coverageDelta = delta(coverage[0]!);

  if (!series.hasTrend) {
    return (
      <>
        <PageHeader
          eyebrow="Analyze"
          title="Trends"
          description="Illustrative weekly history, generated from the sample as of October 8, 2026."
        />
        <Panel>
          <EmptyState
            title={series.points.length === 1 ? "One data point so far" : "No history to chart yet"}
            icon={<TrendingUp className="size-8" />}
          >
            <p>
              These charts use deterministic sample snapshots. They do not represent collected
              observations or an active scheduler.
            </p>
            <p className="mt-2">
              {storedDigests === 0 ? (
                <>
                  No digests are stored yet. Run one from{" "}
                  <strong>Weekly Digest → Run diff now</strong> to create the baseline.
                </>
              ) : series.points.length === 1 ? (
                <>
                  One snapshot is stored. The first chart appears after the second run — using{" "}
                  <strong>Weekly Digest → Run diff now</strong>.
                </>
              ) : (
                <>
                  {storedDigests} {storedDigests === 1 ? "digest is" : "digests are"} stored, but{" "}
                  {series.skipped} of them predate the metrics block these charts need. They will
                  start populating from the next run.
                </>
              )}
            </p>
          </EmptyState>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Analyze"
        title="Trends"
        description={`Change over time across ${series.points.length} weekly snapshots.`}
      />

      {series.skipped > 0 && (
        <div className="ws-enter mb-5">
          <Callout>
            {series.skipped} older {series.skipped === 1 ? "digest" : "digests"} predate the stored
            metrics these charts read, so {series.skipped === 1 ? "it is" : "they are"} omitted
            rather than shown as zero.
          </Callout>
        </div>
      )}

      <div className="ws-enter ws-delay-1 mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Pipeline now"
          value={pipelineDelta?.to.toLocaleString("en-US") ?? "—"}
          hint={
            pipelineDelta ? changeLabel(pipelineDelta.change, "since first snapshot") : undefined
          }
          tone={(pipelineDelta?.change ?? 0) >= 0 ? "positive" : "negative"}
        />
        <StatTile
          label="Portfolio now"
          value={portfolioDelta?.to.toLocaleString("en-US") ?? "—"}
          hint={
            portfolioDelta ? changeLabel(portfolioDelta.change, "since first snapshot") : undefined
          }
          tone={(portfolioDelta?.change ?? 0) >= 0 ? "positive" : "negative"}
        />
        <StatTile
          label="Sector coverage"
          value={coverageDelta ? `${coverageDelta.to.toFixed(0)}%` : "—"}
          hint={
            coverageDelta
              ? `Pipeline · ${
                  coverageDelta.change === 0
                    ? "unchanged"
                    : `${coverageDelta.change > 0 ? "+" : ""}${Math.round(coverageDelta.change)}pt`
                } since first snapshot`
              : undefined
          }
          tone={(coverageDelta?.change ?? 0) >= 0 ? "positive" : "warning"}
        />
        <StatTile
          label="Snapshots"
          value={series.points.length.toString()}
          hint={`since ${new Date(series.points[0]!.at).toLocaleDateString("en-US", { timeZone: "UTC" })}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="ws-enter ws-delay-2 overflow-hidden">
          <PanelHeader
            title="Pipeline and Portfolio size"
            description="Companies on each list at each weekly snapshot."
          />
          <div className="px-4 py-4">
            <LineChart series={sizeSeries} />
          </div>
        </Panel>

        <Panel className="ws-enter ws-delay-3 overflow-hidden">
          <PanelHeader
            title="Canonical sector coverage"
            description="Share of companies with a level-2 classification — is data quality improving?"
          />
          <div className="px-4 py-4">
            <LineChart series={coverage} percentage format={(v) => `${v.toFixed(0)}%`} />
          </div>
        </Panel>
      </div>

      <Panel className="ws-enter ws-delay-4 mt-4 overflow-hidden">
        <PanelHeader
          title="Theme mix drift"
          description="How the balance of themes has shifted, as a share of the list."
          actions={
            <Segmented<StageKey>
              ariaLabel="Choose a list for the theme mix"
              value={mixStage}
              onChange={setMixStage}
              options={[
                { value: "pipeline", label: STAGE_LABELS.pipeline },
                { value: "portfolio", label: STAGE_LABELS.portfolio },
                { value: "archive", label: STAGE_LABELS.archive },
              ]}
            />
          }
        />
        <div className="px-4 py-4">
          <ThemeMixChart points={mix} themes={series.themes} />
          <Footnote>
            Shares, not counts — the question is whether the mix is drifting, which a stacked count
            chart would hide behind overall growth. Theme is a single-select in the CRM, so these
            are exact distinct-company shares and always sum to 100%.
          </Footnote>
        </div>
      </Panel>

      {/* Rolling views require snapshots from more than one calendar day. */}
      <Panel className="ws-enter ws-delay-5 mt-4 overflow-hidden">
        <PanelHeader
          title="Rolling conversion and data health"
          description="Across the whole book, over the last 12 stored snapshots."
          actions={
            <Badge tone={series.spansMultipleDays ? "accent" : "warning"}>
              {series.points.length} sample snapshots
            </Badge>
          }
        />

        {!series.spansMultipleDays ? (
          <div className="px-4 py-4">
            <Callout tone="warn">
              <span className="block font-medium">History is still accruing.</span>
              All {series.points.length} stored snapshots were written on the same day (
              {new Date(series.points[0]!.at).toLocaleDateString("en-US", { timeZone: "UTC" })}), so
              there is no elapsed time to plot yet — a rolling chart drawn from them would show
              unobserved movement. The public demo uses illustrative points rather than scheduled
              collection.
            </Callout>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <StatTile
                label="Carried to Portfolio"
                value={`${rolling.values[rolling.values.length - 1]?.rate.toFixed(0) ?? 0}%`}
                hint={`${rolling.values[rolling.values.length - 1]?.portfolio ?? 0} portfolio / ${
                  rolling.values[rolling.values.length - 1]?.pipeline ?? 0
                } pipeline, at the latest snapshot`}
              />
              <StatTile
                label="Data health completeness"
                value={
                  health.values.length
                    ? `${health.values[health.values.length - 1]!.value.toFixed(0)}%`
                    : "—"
                }
                hint={
                  health.values.length
                    ? "Pipeline + Portfolio, recorded on each digest"
                    : "Recorded from the next digest run onwards"
                }
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-4 px-4 py-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-[12px] font-medium text-ink">Share carried to Portfolio</p>
              <LineChart
                series={[
                  {
                    label: "Portfolio share",
                    values: rolling.values.map((v) => ({ at: v.at, value: v.rate })),
                  },
                ]}
                percentage
                format={(v) => `${v.toFixed(1)}%`}
              />
            </div>
            <div>
              <p className="mb-2 text-[12px] font-medium text-ink">Data health completeness</p>
              {health.values.length >= 2 ? (
                <LineChart series={[health]} percentage format={(v) => `${v.toFixed(0)}%`} />
              ) : (
                <p className="py-8 text-center text-[12px] text-ink-subtle">
                  {health.values.length} of {series.points.length} snapshots include this metric.
                  Missing values are skipped rather than shown as zero.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="px-4 pb-4">
          <Footnote>
            Conversion here is portfolio ÷ (portfolio + pipeline) across the whole book, and carries
            the same caveat as the per-theme table below — it is the share of what we currently
            carry that has reached Portfolio, not a funnel rate. Completeness is the same figure the
            Data Health page shows, over Pipeline and Portfolio only, recorded automatically on
            every digest run rather than transcribed by hand.
          </Footnote>
        </div>
      </Panel>

      <Panel className="ws-enter ws-delay-6 mt-4 overflow-hidden">
        <PanelHeader
          title="Pipeline → Portfolio by theme"
          description="What share of the companies we carry in each theme have reached Portfolio."
        />
        <ul className="divide-y divide-line">
          {conversion.map((row) => {
            const latest = row.values[row.values.length - 1];
            const first = row.values[0];
            const change = (latest?.rate ?? 0) - (first?.rate ?? 0);
            return (
              <li key={row.theme} className="flex items-center gap-3 px-4 py-3">
                <ThemeSwatch theme={row.theme} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                  {row.theme}
                </span>
                <span className="ws-nums shrink-0 text-[11px] text-ink-subtle">
                  {latest?.portfolio ?? 0} portfolio / {latest?.pipeline ?? 0} pipeline
                </span>
                <span className="ws-nums w-14 shrink-0 text-right text-[13px] font-semibold text-ink">
                  {row.latestRate.toFixed(0)}%
                </span>
                <span className="w-16 shrink-0 text-right">
                  {Math.abs(change) < 0.5 ? (
                    <Badge>flat</Badge>
                  ) : (
                    <Badge tone={change > 0 ? "positive" : "negative"}>
                      {change > 0 ? "+" : ""}
                      {change.toFixed(0)}pt
                    </Badge>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="px-4 pb-4">
          <Footnote>
            Measured as portfolio ÷ (portfolio + pipeline) within each theme. This is deliberately{" "}
            <em>not</em> called a conversion rate: the CRM records no &ldquo;we passed at stage
            X&rdquo; event, so a true funnel rate is not recoverable from this data. What it
            measures is the share of what we are currently carrying that has reached Portfolio.
          </Footnote>
        </div>
      </Panel>

      <Footnote>
        Illustrative history begins at (
        {new Date(series.points[0]!.at).toLocaleDateString("en-US", { timeZone: "UTC" })}
        ). The nine metric-bearing weekly points are generated from deterministic prefixes of the
        fixed sample; they are not observed operating history.
      </Footnote>
    </>
  );
}

function changeLabel(change: number, suffix: string): string {
  if (change === 0) return `no change ${suffix}`;
  return `${change > 0 ? "+" : ""}${change.toLocaleString("en-US")} ${suffix}`;
}
