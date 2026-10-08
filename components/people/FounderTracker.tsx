"use client";

import { safeSampleLink } from "@/lib/sample-links";
import { ArrowUpRight, Check, Linkedin, Mail, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { CompanyAvatar } from "@/components/CompanyAvatar";
import {
  Badge,
  Callout,
  cx,
  EmptyState,
  Footnote,
  Input,
  Meter,
  PageHeader,
  Panel,
  PanelHeader,
  StatTile,
  TogglePill,
} from "@/components/ui";
import { errorMessage, postJson } from "@/components/command-palette/shared";
import { useCountUp } from "@/components/useCountUp";
import { Button } from "@/components/ui";
import { scoreFounderQuality } from "@/lib/founder-quality";
import { buildOutreachQueue } from "@/lib/outreach";
import { crmRecordUrl } from "@/lib/constants";
import { fuzzySearch } from "@/lib/fuzzy";
import {
  founderStats,
  OUTREACH_LABELS,
  outreachState,
  personSubtitle,
  rollupBySourcer,
  UNATTRIBUTED,
  type OutreachState,
  type TrackedPerson,
} from "@/lib/people-derive";

/** Filterable tracker for generated founder records and simulated outreach state. */
export function FounderTracker({
  people,
  enrichedHighlights = [],
  generatedAt,
}: {
  people: TrackedPerson[];
  /** Generated highlights keyed by local record id. */
  enrichedHighlights?: { recordId: string; highlights: string[] }[];
  generatedAt: string;
}) {
  /** Marked contacted in THIS session — same local-only rule as the outreach queue. */
  const [markedLocally, setMarkedLocally] = useState<Set<string>>(new Set());

  const highlightMap = useMemo(
    () => new Map(enrichedHighlights.map((h) => [h.recordId, h.highlights])),
    [enrichedHighlights],
  );

  /** Position in the same deterministic rotation used by the outreach queue. */
  const queueRank = useMemo(() => {
    const queue = buildOutreachQueue(people, people.length, highlightMap);
    return new Map(queue.entries.map((e) => [e.person.recordId, e.position]));
  }, [people, highlightMap]);
  const [query, setQuery] = useState("");
  const [sourcer, setSourcer] = useState<string | null>(null);
  const [outreach, setOutreach] = useState<OutreachState | null>(null);

  const stats = useMemo(() => founderStats(people), [people]);
  const sourcers = useMemo(() => rollupBySourcer(people), [people]);

  const filtered = useMemo(() => {
    let list = people;
    if (sourcer) {
      list = list.filter((p) =>
        sourcer === UNATTRIBUTED ? p.sourcedBy.length === 0 : p.sourcedBy.includes(sourcer),
      );
    }
    if (outreach) list = list.filter((p) => outreachState(p) === outreach);
    if (query.trim()) {
      list = fuzzySearch(query, list, (p) => [
        p.name ?? "",
        p.linkedinCompany ?? "",
        p.linkedinPosition ?? p.jobTitle ?? "",
        p.highlights.join(" "),
        p.education ?? "",
        p.location ?? "",
      ]).map((m) => m.item);
    } else {
      list = [...list].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    }
    return list;
  }, [people, sourcer, outreach, query]);

  const total = useCountUp(stats.total);

  return (
    <>
      <PageHeader
        eyebrow="Explore"
        title="Stealth Founders"
        description="Sourced founders and outreach status."
      />

      <div className="ws-enter ws-delay-1 mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Tracked" value={total.toLocaleString("en-US")} hint="on the CRM list" />
        <StatTile
          label="With signals"
          value={`${Math.round((stats.withHighlights / Math.max(stats.total, 1)) * 100)}%`}
          hint={`${stats.withHighlights} profiles`}
        />
        <StatTile
          label="With LinkedIn"
          value={`${Math.round((stats.withLinkedin / Math.max(stats.total, 1)) * 100)}%`}
          hint={`${stats.withLinkedin} profiles`}
        />
        <StatTile
          label="With an email"
          value={`${Math.round((stats.withEmail / Math.max(stats.total, 1)) * 100)}%`}
          hint={`${stats.withEmail} addresses on file · ${stats.withEducation} have education`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="ws-enter ws-delay-3 overflow-hidden">
          <PanelHeader
            title="By sourcing teammate"
            description="Whose network each founder came from."
          />
          {sourcers.length === 0 ? (
            <EmptyState title="No sourcing attribution" />
          ) : (
            <ul className="divide-y divide-line">
              {sourcers.map((row) => {
                const selected = sourcer === row.name;
                return (
                  <li key={row.name}>
                    <button
                      type="button"
                      onClick={() => setSourcer(selected ? null : row.name)}
                      className={cx(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-[var(--dur-quick)]",
                        selected ? "bg-accent-soft" : "hover:bg-surface-sunken",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className={cx(
                            "block truncate text-[13px]",
                            row.name === UNATTRIBUTED
                              ? "text-ink-subtle italic"
                              : "font-medium text-ink",
                          )}
                        >
                          {row.name}
                        </span>
                        <span className="mt-1 block">
                          <Meter
                            pct={(row.total / Math.max(sourcers[0]?.total ?? 1, 1)) * 100}
                            tone={selected ? "accent" : "accent"}
                          />
                        </span>
                      </span>
                      <span className="ws-nums shrink-0 text-[13px] font-medium text-ink">
                        {row.total}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="px-4 pb-3">
            <Footnote>
              <code className="text-[10px]">sourced_by</code> is a multiselect, so a founder
              credited to two teammates is counted in both — these are tag counts and can sum above{" "}
              {people.length}.
            </Footnote>
          </div>
        </Panel>

        <Panel className="ws-enter ws-delay-4 overflow-hidden lg:col-span-2">
          <PanelHeader
            title={`Founders${filtered.length !== people.length ? ` · ${filtered.length} of ${people.length}` : ""}`}
            actions={
              <div className="flex items-center gap-2">
                {(["contacted", "not-contacted", "unset"] as const).map((state) => (
                  <TogglePill
                    key={state}
                    active={outreach === state}
                    onClick={() => setOutreach((o) => (o === state ? null : state))}
                  >
                    {OUTREACH_LABELS[state]}
                  </TogglePill>
                ))}
              </div>
            }
          />

          <div className="border-b border-line px-4 py-2.5">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name, company, role, school or location…"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No founders match">
              Clear the filters above to see the whole list.
            </EmptyState>
          ) : (
            <ul className="max-h-[34rem] divide-y divide-line overflow-y-auto">
              {filtered.map((person, index) => (
                <FounderRow
                  key={person.recordId}
                  person={person}
                  index={index}
                  rank={queueRank.get(person.recordId) ?? null}
                  enrichedHighlights={highlightMap.get(person.recordId) ?? []}
                  markedLocally={markedLocally.has(person.recordId)}
                  onMarked={(id) => setMarkedLocally((prev) => new Set(prev).add(id))}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Footnote>
        Snapshot taken {new Date(generatedAt).toLocaleString("en-US", { timeZone: "UTC" })}.
      </Footnote>
    </>
  );
}

/** One founder row with separate headline, body and supporting-detail tiers. */
function FounderRow({
  person,
  index,
  rank,
  enrichedHighlights,
  markedLocally,
  onMarked,
}: {
  person: TrackedPerson;
  index: number;
  rank: number | null;
  enrichedHighlights: string[];
  markedLocally: boolean;
  onMarked: (recordId: string) => void;
}) {
  const state = markedLocally ? "contacted" : outreachState(person);
  const subtitle = personSubtitle(person);

  /**
   * The single strongest signal for the headline.
   *
   * Reuse the queue's weighting so an unranked source tag does not become the headline.
   */
  const strongest = useMemo(() => {
    const score = scoreFounderQuality(enrichedHighlights);
    return score.hits.length > 0 ? score.hits[0]!.label : null;
  }, [enrichedHighlights]);

  return (
    <li className="ws-enter px-4 py-3" style={{ animationDelay: `${Math.min(index, 12) * 16}ms` }}>
      <div className="flex items-start gap-3">
        <CompanyAvatar
          name={person.name}
          logoUrl={person.avatarUrl}
          size={34}
          className="rounded-full"
        />

        <div className="min-w-0 flex-1">
          {/* ── Tier 1 ─────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[14px] leading-tight font-semibold text-ink">
              {person.name ?? "Unnamed"}
            </span>
            {strongest && <Badge tone="accent">{strongest}</Badge>}
            {rank !== null && rank <= 20 && (
              <Badge tone="neutral">
                <span title="Position in the outreach rotation">Queue #{rank}</span>
              </Badge>
            )}
          </div>

          {/* ── Tier 2 ─────────────────────────────────────────────────────── */}
          {subtitle && (
            <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{subtitle}</p>
          )}
          {person.highlights.length > 0 && (
            <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">
              {person.highlights.join(" · ")}
            </p>
          )}

          <Affiliations value={person.linkedinCompany} />

          {/* ── Tier 3 ─────────────────────────────────────────────────────── */}
          <p className="mt-1.5 text-[11px] text-ink-subtle">
            {[
              person.education,
              person.location,
              person.sourcedBy[0] ? `Sourced by ${person.sourcedBy[0]}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge
            tone={state === "contacted" ? "positive" : state === "unset" ? "neutral" : "warning"}
          >
            {OUTREACH_LABELS[state]}
          </Badge>
          <span className="flex items-center gap-1.5">
            {person.email && (
              <a
                href={safeSampleLink(`mailto:${person.email}`)}
                aria-disabled={!safeSampleLink(`mailto:${person.email}`)}
                title={
                  !safeSampleLink(`mailto:${person.email}`) ? "Fictional sample contact" : undefined
                }

                className="text-ink-subtle transition-colors hover:text-accent"
              >
                <Mail className="size-3.5" />
              </a>
            )}
            {person.linkedin && (
              <a
                href={safeSampleLink(person.linkedin)}
                aria-disabled={!safeSampleLink(person.linkedin)}
                title={!safeSampleLink(person.linkedin) ? "Fictional sample contact" : undefined}
                target="_blank"
                rel="noreferrer"

                className="text-ink-subtle transition-colors hover:text-accent"
              >
                <Linkedin className="size-3.5" />
              </a>
            )}
            <a
              href={crmRecordUrl("people", person.recordId)}
              target="_blank"
              rel="noreferrer"
              title="Open in the CRM"
              className="text-ink-subtle transition-colors hover:text-accent"
            >
              <ArrowUpRight className="size-3.5" />
            </a>
          </span>
        </div>
      </div>

      {state !== "contacted" && <LogOutreach person={person} onMarked={onMarked} />}
    </li>
  );
}

/**
 * Affiliated companies, truncated.
 *
 * `linkedin_company` can hold a semicolon-separated list on a founder with more than
 * one affiliation. Rendered raw and long, it buries everything below it — so this shows
 * three, then an inline expander that reveals the rest in place, no navigation, just
 * local state.
 */
function Affiliations({ value }: { value: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const all = useMemo(
    () =>
      (value ?? "")
        .split(";")
        .map((v) => v.trim())
        .filter(Boolean),
    [value],
  );

  if (all.length <= 1) return null;

  const shown = expanded ? all : all.slice(0, 3);
  const hidden = all.length - shown.length;

  return (
    <p className="mt-1 flex flex-wrap items-center gap-1">
      {shown.map((name) => (
        <span
          key={name}
          className="rounded border border-line bg-surface-sunken px-1.5 py-0.5 text-[11px] text-ink-muted"
        >
          {name}
        </span>
      ))}
      {(hidden > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] font-medium text-accent hover:underline"
        >
          {expanded ? "Show fewer" : `+${hidden} more`}
        </button>
      )}
    </p>
  );
}

/**
 * Inline "Log outreach", mirroring how Data Health links a gap straight to the record
 * that has it — see it, fix it, in the same view.
 *
 * ⚠️ This is NOT a second write path. It POSTs to the same
 * `/api/crm/people/mark-reached-out` route the outreach queue uses, which calls the
 * same `setPersonReachedOut()`. And it shows the same confirm step: the entry point
 * being more casual than the palette is not a reason to skip confirmation on a write to
 * the firm's CRM.
 */
function LogOutreach({
  person,
  onMarked,
}: {
  person: TrackedPerson;
  onMarked: (recordId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const confirm = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      await postJson("/api/crm/people/mark-reached-out", {
        recordId: person.recordId,
        reachedOut: true,
      });
      onMarked(person.recordId);
      setConfirming(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [person.recordId, onMarked]);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="mt-2 ml-[46px] inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-subtle transition-colors hover:text-accent"
      >
        <Sparkles className="size-3" /> Log outreach
      </button>
    );
  }

  return (
    <div className="mt-2 ml-[46px] space-y-2">
      <Callout tone="warn">
        Mark <strong>{person.name ?? "this person"}</strong> as contacted? This updates local demo
        data; it does not send a message.
      </Callout>
      {error && <Callout tone="error">{error}</Callout>}
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => void confirm()} disabled={saving}>
          {saving ? (
            "Saving…"
          ) : (
            <>
              <Check className="size-3.5" /> Confirm
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
