"use client";

import { Check, Copy, ExternalLink, Mail } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import { CompanyAvatar } from "@/components/CompanyAvatar";
import { MatchList } from "@/components/match/MatchList";
import { ThemeSwatch } from "@/components/statistics/ThemeSwatch";
import { Badge, Button, Footnote, Input, Panel } from "@/components/ui";
import type { StagedCompany } from "@/lib/aggregate";
import { crmRecordUrl, STAGE_LABELS } from "@/lib/constants";
import { fuzzyScore } from "@/lib/fuzzy";
import { matchCoInvestors, topMatches } from "@/lib/matchmaking";
import type { TrackedPerson } from "@/lib/people-derive";

import { usePaletteSnapshot } from "./CommandPaletteProvider";
import { ActionShell, type PaletteActionProps } from "./shared";

/**
 * Call prep in one keystroke.
 *
 * ⚠️ READ-ONLY. This action assembles and displays; it writes nothing, so it correctly
 * has no confirm step — the confirm pattern exists to gate mutations, and adding one
 * here would dilute what it means everywhere else.
 *
 * Everything comes from the cached snapshots already in the page, so it renders
 * instantly with no request at all — the point is to be usable thirty seconds before a
 * call. There is deliberately no live the CRM fetch even as an option: a spinner is the
 * one thing this action cannot afford.
 *
 * The copy affordances hand off to the clipboard and to the user's own mail client.
 * Nothing is ever sent on the user's behalf.
 */
export function QuickSummary({ onBack }: PaletteActionProps) {
  const snapshot = usePaletteSnapshot();
  const [selected, setSelected] = useState<StagedCompany | null>(null);

  return (
    <ActionShell
      title="Quick summary"
      subtitle="Call prep from the cached snapshot — read-only, nothing is written"
      onBack={onBack}
    >
      {!selected ? (
        <LocalCompanyPicker
          companies={snapshot.companies}
          onSelect={setSelected}
        />
      ) : (
        <SummaryBody
          company={selected}
          companies={snapshot.companies}
          coInvestors={snapshot.coInvestors}
          onClear={() => setSelected(null)}
        />
      )}
    </ActionShell>
  );
}

/**
 * A local picker rather than the shared `CompanyTypeahead`.
 *
 * The typeahead debounces and calls our CRM-backed search route, which is right for
 * the write actions — they may need a company we do not hold on any list. This action
 * only ever summarises a company we already have cached, and its whole purpose is to be
 * instant, so it filters the snapshot in memory and never issues a request.
 */
function LocalCompanyPicker({
  companies,
  onSelect,
}: {
  companies: StagedCompany[];
  onSelect: (company: StagedCompany) => void;
}) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);

  const results = useMemo(() => {
    const q = deferred.trim();
    // Pipeline and Portfolio first — these are the companies anyone is about to call
    // about. Archive is reachable by typing its name.
    const ranked = q
      ? companies
          .map((c) => ({ c, score: fuzzyScore(q, c.name ?? "")?.score ?? -1 }))
          .filter((r) => r.score >= 0)
          .sort((a, b) => b.score - a.score)
          .map((r) => r.c)
      : companies.filter(
          (c) => c.stages.includes("pipeline") || c.stages.includes("portfolio"),
        );
    return ranked.slice(0, 24);
  }, [deferred, companies]);

  return (
    <div className="space-y-2">
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Which company are you about to talk about?"
        aria-label="Find a company"
      />
      <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-md border border-line">
        {results.map((company, index) => (
          <li key={company.recordId}>
            <button
              type="button"
              onClick={() => onSelect(company)}
              className="ws-settle ws-stagger flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-sunken"
              style={{ "--i": index } as React.CSSProperties}
            >
              <CompanyAvatar name={company.name} logoUrl={company.logoUrl} size={22} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink">
                  {company.name ?? "(unnamed)"}
                </span>
                <span className="block truncate text-[11px] text-ink-subtle">
                  {[company.pipelineStage, company.canonicalSector, company.location]
                    .filter(Boolean)
                    .join(" · ") || company.domains.join(", ")}
                </span>
              </span>
              {company.theme && <ThemeSwatch theme={company.theme} />}
            </button>
          </li>
        ))}
        {results.length === 0 && (
          <li className="px-3 py-4 text-center text-[12px] text-ink-subtle">
            No company in the snapshot matches “{deferred}”.
          </li>
        )}
      </ul>
    </div>
  );
}

function SummaryBody({
  company,
  companies,
  coInvestors,
  onClear,
}: {
  company: StagedCompany;
  companies: StagedCompany[];
  coInvestors: TrackedPerson[];
  onClear: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const report = useMemo(
    () => matchCoInvestors(company, coInvestors, companies),
    [company, coInvestors, companies],
  );
  // Only the names that clear the floor well — this is a 30-second read, not a board.
  const matches = useMemo(() => topMatches(report, 3), [report]);

  const text = useMemo(
    () => summaryToText(company, matches.map((m) => m.label)),
    [company, matches],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  const funding = company.fundingRaisedUsd ?? company.enrichedFundingUsd;
  const fundingSource = company.fundingRaisedUsd !== null ? "the CRM" : "enrichment";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <CompanyAvatar name={company.name} logoUrl={company.logoUrl} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-ink">
              {company.name ?? "Unnamed company"}
            </h3>
            {company.theme && <ThemeSwatch theme={company.theme} />}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {company.stages.map((s) => (
              <Badge key={s} tone={s === "portfolio" ? "accent" : "neutral"}>
                {STAGE_LABELS[s]}
              </Badge>
            ))}
            {company.pipelineStage && <Badge tone="accent">{company.pipelineStage}</Badge>}
          </div>
        </div>
        <Button variant="ghost" onClick={onClear}>
          Change
        </Button>
      </div>

      <Panel className="divide-y divide-line">
        <Row label="Classification">
          {[company.theme, company.canonicalSector].filter(Boolean).join(" → ") ||
            "Unclassified"}
          {company.subSectors.length > 0 && (
            <span className="block text-[11px] text-ink-subtle">
              {company.subSectors.join(", ")}
            </span>
          )}
        </Row>
        {(company.rounds.length > 0 || company.dealType.length > 0 ||
          company.vehicle.length > 0) && (
          <Row label="Deal">
            {[
              company.rounds.join(", "),
              company.dealType.join(", "),
              company.vehicle.length ? `via ${company.vehicle.join(", ")}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Row>
        )}
        {funding !== null && (
          <Row label="Raised">
            {formatUsd(funding)}
            <span className="block text-[11px] text-ink-subtle">
              Total from all investors ({fundingSource}) — the CRM records nothing about
              our own cheque.
            </span>
          </Row>
        )}
        {company.location && <Row label="Location">{company.location}</Row>}
      </Panel>

      {company.summary && (
        <Block title="What they do">{company.summary}</Block>
      )}
      {company.teamStructure && (
        <Block title="Founders &amp; team">{company.teamStructure}</Block>
      )}
      {company.primaryRelationships && (
        <Block title="How we know them">{company.primaryRelationships}</Block>
      )}

      {matches.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium tracking-[0.04em] text-ink-subtle uppercase">
            Co-investors who fit
          </p>
          <Panel className="overflow-hidden">
            <MatchList report={report} matches={matches} compact />
          </Panel>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={copy}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy as text"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            // Opens the user's own mail client with a draft. It never sends.
            const subject = encodeURIComponent(`${company.name ?? "Company"} — call prep`);
            window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(text)}`;
          }}
        >
          <Mail className="size-3.5" /> Draft an email
        </Button>
        <a
          href={crmRecordUrl("companies", company.recordId)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-3 py-1.5 text-[13px] font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
        >
          <ExternalLink className="size-3.5" /> Open in the CRM
        </a>
      </div>

      <Footnote>
        Built from the current snapshot. &ldquo;Draft an email&rdquo; opens a prefilled
        message in your mail client.
      </Footnote>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-3 py-2 text-[13px]">
      <span className="w-28 shrink-0 text-ink-subtle">{label}</span>
      <span className="min-w-0 flex-1 text-ink">{children}</span>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium tracking-[0.04em] text-ink-subtle uppercase">
        {title}
      </p>
      <p className="text-[12.5px] leading-relaxed text-ink-muted">{children}</p>
    </div>
  );
}

/** Plain text for the clipboard / mail draft. */
function summaryToText(company: StagedCompany, investors: string[]): string {
  const funding = company.fundingRaisedUsd ?? company.enrichedFundingUsd;
  const lines = [company.name ?? "Unnamed company", ""];

  const classification = [company.theme, company.canonicalSector].filter(Boolean).join(" → ");
  if (classification) lines.push(`Classification: ${classification}`);
  if (company.subSectors.length) lines.push(`Sub-sectors: ${company.subSectors.join(", ")}`);
  if (company.pipelineStage) lines.push(`Stage: ${company.pipelineStage}`);
  if (company.rounds.length) lines.push(`Round: ${company.rounds.join(", ")}`);
  if (company.vehicle.length) lines.push(`Vehicle: ${company.vehicle.join(", ")}`);
  if (funding !== null) {
    lines.push(`Raised: ${formatUsd(funding)} total from all investors (not our cheque)`);
  }
  if (company.location) lines.push(`Location: ${company.location}`);

  if (company.summary) lines.push("", "What they do:", company.summary);
  if (company.teamStructure) lines.push("", "Founders & team:", company.teamStructure);
  if (company.primaryRelationships) {
    lines.push("", "How we know them:", company.primaryRelationships);
  }
  if (investors.length) lines.push("", `Co-investors who fit: ${investors.join(", ")}`);

  return lines.join("\n");
}

function formatUsd(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}
