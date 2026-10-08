"use client";

import { safeSampleLink } from "@/lib/sample-links";
import { ArrowUpRight, Check, Link2, Rocket, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { CompanyAvatar } from "@/components/CompanyAvatar";
import { errorMessage, postJson } from "@/components/command-palette/shared";
import {
  Badge,
  Button,
  Callout,
  EmptyState,
  Footnote,
  Input,
  Panel,
  PanelHeader,
  PageHeader,
  Segmented,
  StatTile,
} from "@/components/ui";
import type { StagedCompany } from "@/lib/aggregate";
import { crmRecordUrl } from "@/lib/constants";
import {
  buildLaunchReport,
  type FounderLaunchSignal,
  type LaunchConfidence,
  type LaunchSuggestion,
} from "@/lib/founder-launch";
import { normaliseCompanyName, type TrackedPerson } from "@/lib/people-derive";

/**
 * "Which of our stealth founders have launched something?"
 *
 * ⚠️ Every row is a SUGGESTION. Nothing here writes on its own. The link field
 * (`launched_company_ref`) is 0% populated and filling it is an owner
 * decision — a human reads the evidence, decides, and confirms.
 *
 * False positives are expected and fine: a founder can take a job at a named company
 * without launching anything, which is exactly what the `possible` tier means.
 */
export function LaunchSuggestions({
  signals,
  founders,
  companies,
  generatedAt,
  enrichmentGeneratedAt,
}: {
  signals: FounderLaunchSignal[];
  founders: TrackedPerson[];
  companies: StagedCompany[];
  generatedAt: string;
  enrichmentGeneratedAt: string | null;
}) {
  const [filter, setFilter] = useState<LaunchConfidence | "all">("all");
  const [query, setQuery] = useState("");
  const [linked, setLinked] = useState<Set<string>>(new Set());

  const founderById = useMemo(() => new Map(founders.map((f) => [f.recordId, f])), [founders]);

  /**
   * Resolve a launched company name to a CRM company record, so the link can point
   * somewhere. A suggestion whose company is not in the CRM yet can still be read — it
   * just cannot be linked until someone adds the company, which the card says.
   */
  const companyByName = useMemo(() => {
    const map = new Map<string, StagedCompany>();
    for (const c of companies) {
      if (c.name) map.set(normaliseCompanyName(c.name), c);
    }
    return map;
  }, [companies]);

  const report = useMemo(
    () => buildLaunchReport(signals, founders.length),
    [signals, founders.length],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return report.suggestions.filter((s) => {
      if (filter !== "all" && s.confidence !== filter) return false;
      if (!q) return true;
      const founder = founderById.get(s.signal.recordId);
      return (
        (founder?.name ?? "").toLowerCase().includes(q) ||
        (s.signal.companyName ?? "").toLowerCase().includes(q)
      );
    });
  }, [report.suggestions, filter, query, founderById]);

  const counts = useMemo(
    () => ({
      confirmed: report.suggestions.filter((s) => s.confidence === "confirmed").length,
      likely: report.suggestions.filter((s) => s.confidence === "likely").length,
      possible: report.suggestions.filter((s) => s.confidence === "possible").length,
    }),
    [report.suggestions],
  );

  if (!enrichmentGeneratedAt) {
    return (
      <>
        <PageHeader
          eyebrow="Stealth Founders"
          title="Launch signals"
          description="Which tracked founders appear to have launched a company."
        />
        <Panel>
          <EmptyState title="No enrichment snapshot yet" icon={<Rocket className="size-6" />}>
            Use Refresh in the top bar to build one.
          </EmptyState>
        </Panel>
      </>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Stealth Founders"
        title="Launch signals"
        description="Tracked founders whose current employer may be a newly launched company."
        actions={
          <Link href="/founders" className="text-[13px] text-accent hover:underline">
            Full tracker
          </Link>
        }
      />

      <div className="ws-enter mb-4 grid gap-3 sm:grid-cols-4">
        <StatTile label="Tracked founders" value={report.total} />
        <StatTile
          label="Resolved in enrichment"
          value={report.resolved}
          hint={`${Math.round((report.resolved / Math.max(report.total, 1)) * 100)}% matched by LinkedIn`}
        />
        <StatTile
          label="Appear to have launched"
          value={report.suggestions.length}
          tone="positive"
          hint={`${counts.confirmed} confirmed · ${counts.likely} likely · ${counts.possible} possible`}
        />
        <StatTile label="Still in stealth" value={report.stillStealth} />
      </div>

      <Panel className="ws-enter ws-delay-1 overflow-hidden">
        <PanelHeader
          title="Suggested links"
          description="Ordered by how strong the evidence is."
          actions={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-subtle" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter"
                  className="w-40 pl-8"
                  aria-label="Filter suggestions"
                />
              </div>
              <Segmented<LaunchConfidence | "all">
                ariaLabel="Confidence"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "confirmed", label: `Confirmed ${counts.confirmed}` },
                  { value: "likely", label: `Likely ${counts.likely}` },
                  { value: "possible", label: `Possible ${counts.possible}` },
                ]}
              />
            </div>
          }
        />

        {visible.length === 0 ? (
          <EmptyState title="Nothing matches" icon={<Rocket className="size-6" />}>
            No suggestion matches the current filter.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((suggestion, index) => {
              const founder = founderById.get(suggestion.signal.recordId);
              if (!founder) return null;
              const crmCompany = suggestion.signal.companyName
                ? (companyByName.get(normaliseCompanyName(suggestion.signal.companyName)) ?? null)
                : null;
              return (
                <SuggestionRow
                  key={suggestion.signal.recordId}
                  suggestion={suggestion}
                  founder={founder}
                  crmCompany={crmCompany}
                  index={index}
                  alreadyLinked={linked.has(suggestion.signal.recordId)}
                  onLinked={(id) => setLinked((prev) => new Set(prev).add(id))}
                />
              );
            })}
          </ul>
        )}

        <div className="px-4 pb-3">
          <Footnote>
            Matches use LinkedIn identity and current-position data. &ldquo;Possible&rdquo; means
            the employer changed, but a founder role was not confirmed.
          </Footnote>
        </div>
      </Panel>

      <p className="mt-4 text-[11px] text-ink-subtle">
        CRM snapshot {new Date(generatedAt).toLocaleString("en-US", { timeZone: "UTC" })} ·
        enrichment snapshot{" "}
        {new Date(enrichmentGeneratedAt).toLocaleString("en-US", { timeZone: "UTC" })}.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

const CONFIDENCE_TONE: Record<LaunchConfidence, "positive" | "accent" | "neutral"> = {
  confirmed: "positive",
  likely: "accent",
  possible: "neutral",
};

type RowState = "idle" | "confirming" | "saving" | "done";

function SuggestionRow({
  suggestion,
  founder,
  crmCompany,
  index,
  alreadyLinked,
  onLinked,
}: {
  suggestion: LaunchSuggestion;
  founder: TrackedPerson;
  crmCompany: StagedCompany | null;
  index: number;
  alreadyLinked: boolean;
  onLinked: (recordId: string) => void;
}) {
  const [state, setState] = useState<RowState>(alreadyLinked ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);

  const { signal } = suggestion;

  async function confirm() {
    if (!crmCompany) return;
    setState("saving");
    setError(null);
    try {
      await postJson("/api/crm/people/link-company", {
        personRecordId: founder.recordId,
        companyRecordId: crmCompany.recordId,
      });
      setState("done");
      onLinked(founder.recordId);
    } catch (err) {
      setError(errorMessage(err));
      setState("confirming");
    }
  }

  return (
    <li className="ws-settle ws-stagger px-4 py-3" style={{ "--i": index } as React.CSSProperties}>
      <div className="flex items-start gap-3">
        <CompanyAvatar name={founder.name} logoUrl={founder.avatarUrl} size={32} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-ink">
              {founder.name ?? "Unnamed founder"}
            </span>
            <span className="text-[13px] text-ink-subtle">→</span>
            <span className="text-[13px] font-medium text-ink">{signal.companyName}</span>
            <Badge tone={CONFIDENCE_TONE[suggestion.confidence]}>{suggestion.confidence}</Badge>
            {founder.sourcedBy.length > 0 && (
              <Badge tone="neutral">{founder.sourcedBy.join(", ")}</Badge>
            )}
          </div>

          <ul className="mt-1.5 space-y-0.5">
            {suggestion.evidence.map((line) => (
              <li key={line} className="text-[12px] text-ink-muted">
                • {line}
              </li>
            ))}
          </ul>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-subtle">
            {founder.linkedin && (
              <a
                href={safeSampleLink(founder.linkedin)}
                aria-disabled={!safeSampleLink(founder.linkedin)}
                title={!safeSampleLink(founder.linkedin) ? "Fictional sample contact" : undefined}
                target="_blank"
                rel="noreferrer"
                className="hover:text-accent"
              >
                LinkedIn
              </a>
            )}
            <a
              href={crmRecordUrl("people", founder.recordId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-accent"
            >
              Founder in the CRM <ArrowUpRight className="size-3" />
            </a>
            {crmCompany && (
              <Link
                href={`/company/${crmCompany.recordId}`}
                className="inline-flex items-center gap-1 hover:text-accent"
              >
                {crmCompany.name} in this dashboard
              </Link>
            )}
          </div>
        </div>

        <div className="shrink-0">
          {state === "done" ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-positive">
              <Check className="size-3.5" /> Linked
            </span>
          ) : !crmCompany ? (
            <span
              className="text-[11px] text-ink-subtle"
              title="The link field points at a CRM company record, so the company has to exist there first."
            >
              Not in the CRM yet
            </span>
          ) : state === "idle" ? (
            <Button variant="secondary" onClick={() => setState("confirming")}>
              <Link2 className="size-3.5" /> Confirm &amp; link
            </Button>
          ) : null}
        </div>
      </div>

      {(state === "confirming" || state === "saving") && crmCompany && (
        <div className="mt-3 ml-11 space-y-2">
          <Callout tone="warn">
            Link <strong>{founder.name}</strong> to <strong>{crmCompany.name}</strong>? This updates
            local demo data.
          </Callout>
          {error && <Callout tone="error">{error}</Callout>}
          <div className="flex gap-2">
            <Button variant="primary" onClick={confirm} disabled={state === "saving"}>
              {state === "saving" ? "Saving…" : "Confirm"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setState("idle");
                setError(null);
              }}
              disabled={state === "saving"}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
