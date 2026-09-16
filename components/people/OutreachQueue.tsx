"use client";

import {
  ArrowUpRight,
  Check,
  GraduationCap,
  Linkedin,
  Mail,
  MapPin,
  Sparkles,
} from "lucide-react";
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
  Panel,
  PanelHeader,
  PageHeader,
  Segmented,
  StatTile,
  cx,
} from "@/components/ui";
import { crmRecordUrl } from "@/lib/constants";
import { buildOutreachQueue, outreachSummary, type QueueEntry } from "@/lib/outreach";
import { outreachState, personSubtitle, type TrackedPerson } from "@/lib/people-derive";

const SIZES = ["5", "10", "20"] as const;
type Size = (typeof SIZES)[number];

/**
 * The weekly outreach queue.
 *
 * ⚠️ Not an agent and not a recommendation engine. The order is a deterministic
 * round-robin across sourcing teammates (see lib/outreach.ts) recomputed on every
 * render from the cached snapshot. It decides display order; a human decides who to
 * contact, and the only write happens behind a confirm step.
 */
export function OutreachQueue({
  founders,
  enrichedHighlights,
  generatedAt,
  enrichmentGeneratedAt,
}: {
  founders: TrackedPerson[];
  /** Generated highlights keyed by local record id. */
  enrichedHighlights: { recordId: string; highlights: string[] }[];
  generatedAt: string;
  enrichmentGeneratedAt: string | null;
}) {
  const [size, setSize] = useState<Size>("5");

  /**
   * Record ids marked contacted in THIS session, so a row updates without forcing a
   * full snapshot refresh. Deliberately local: the shared snapshot is one consistent
   * point in time, and patching a record into it would make its "snapshot taken at…"
   * caption a lie — the same rule the company detail page follows.
   */
  const [markedLocally, setMarkedLocally] = useState<Set<string>>(new Set());

  const summary = useMemo(() => outreachSummary(founders), [founders]);

  const highlightMap = useMemo(
    () => new Map(enrichedHighlights.map((h) => [h.recordId, h.highlights])),
    [enrichedHighlights],
  );

  const queue = useMemo(() => {
    const remaining = founders.filter((p) => !markedLocally.has(p.recordId));
    return buildOutreachQueue(remaining, Number(size), highlightMap);
  }, [founders, size, markedLocally, highlightMap]);

  return (
    <div>
      <PageHeader
        eyebrow="Stealth Founders"
        title="Outreach queue"
        description="A weekly action list rotated across sourcing teammates."
        actions={
          <Link href="/founders" className="text-[13px] text-accent hover:underline">
            Full tracker
          </Link>
        }
      />

      <div className="ws-enter mb-4 grid gap-3 sm:grid-cols-4">
        <StatTile label="Tracked" value={summary.total} />
        <StatTile
          label="Open"
          value={summary.notContacted + summary.untriaged}
          hint={`${summary.notContacted} triaged · ${summary.untriaged} untriaged`}
          tone="warning"
        />
        <StatTile
          label="Contacted"
          value={summary.contacted + markedLocally.size}
          tone={summary.contacted + markedLocally.size > 0 ? "positive" : "default"}
          hint={markedLocally.size > 0 ? `${markedLocally.size} this session` : undefined}
        />
        <StatTile label="Sourcing teammates" value={summary.backlogBySourcer.length} />
      </div>

      <Panel className="ws-enter ws-delay-1 overflow-hidden">
        <PanelHeader
          title="This week"
          description="One founder per teammate, in rotation, ranked inside each teammate's own backlog."
          actions={
            <Segmented<Size>
              ariaLabel="Queue size"
              value={size}
              onChange={setSize}
              options={SIZES.map((s) => ({ value: s, label: s }))}
            />
          }
        />

        {queue.entries.length === 0 ? (
          <EmptyState title="Queue is empty" icon={<Check className="size-6" />}>
            Every tracked founder has been marked as contacted. Nothing left to rotate.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {queue.entries.map((entry, index) => (
              <QueueRow
                key={entry.person.recordId}
                entry={entry}
                index={index}
                hasEnrichment={Boolean(enrichmentGeneratedAt)}
                onMarked={(recordId) =>
                  setMarkedLocally((prev) => new Set(prev).add(recordId))
                }
              />
            ))}
          </ul>
        )}

        <div className="px-4 pb-3">
          <Footnote>
            {queue.remaining} records remain after this week&rsquo;s {queue.entries.length}.
            Profile completeness and founder signals break ties within each teammate&rsquo;s
            backlog; they do not change the teammate rotation.
          </Footnote>
        </div>
      </Panel>

      <Panel className="ws-enter ws-delay-2 mt-4 overflow-hidden">
        <PanelHeader
          title="Backlog by teammate"
          description="Open records by sourcing teammate."
        />
        <ul className="divide-y divide-line">
          {summary.backlogBySourcer.map((row, index) => (
            <li
              key={row.name}
              className="ws-settle ws-stagger flex items-center gap-3 px-4 py-2"
              style={{ "--i": index } as React.CSSProperties}
            >
              <span className="flex-1 text-[13px] text-ink">{row.name}</span>
              <span className="ws-nums text-[13px] text-ink-muted">{row.count}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <p className="mt-4 text-[11px] text-ink-subtle">
        CRM snapshot {new Date(generatedAt).toLocaleString()}
        {enrichmentGeneratedAt
          ? ` · enrichment snapshot ${new Date(enrichmentGeneratedAt).toLocaleString()}`
          : ""}
        .
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

type RowState = "idle" | "confirming" | "saving" | "done";

/**
 * One founder, with the mark-as-reached-out flow.
 *
 * The confirm step is not optional just because the payload is a single boolean: it
 * writes to the firm's CRM, and the project rule is that every write shows the exact
 * payload first. The confirm names the field, the value and the record.
 */
function QueueRow({
  entry,
  index,
  hasEnrichment,
  onMarked,
}: {
  entry: QueueEntry;
  index: number;
  hasEnrichment: boolean;
  onMarked: (recordId: string) => void;
}) {
  const [state, setState] = useState<RowState>("idle");
  const [error, setError] = useState<string | null>(null);

  const person = entry.person;
  const crmUrl = crmRecordUrl("people", person.recordId);
  const triaged = outreachState(person) === "not-contacted";

  async function confirm() {
    setState("saving");
    setError(null);
    try {
      await postJson("/api/crm/people/mark-reached-out", {
        recordId: person.recordId,
        reachedOut: true,
      });
      setState("done");
      onMarked(person.recordId);
    } catch (err) {
      setError(errorMessage(err));
      setState("confirming");
    }
  }

  return (
    <li
      className="ws-settle ws-stagger px-4 py-3"
      style={{ "--i": index } as React.CSSProperties}
    >
      <div className="flex items-start gap-3">
        <span className="ws-nums mt-0.5 w-5 shrink-0 text-[12px] text-ink-subtle">
          {entry.position}
        </span>

        <CompanyAvatar name={person.name} logoUrl={person.avatarUrl} size={32} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-ink">
              {person.name ?? "Unnamed founder"}
            </span>
            <Badge tone="neutral">{entry.sourcer}</Badge>
            {!triaged && <Badge tone="warning">Untriaged</Badge>}
          </div>

          {personSubtitle(person) && (
            <p className="mt-0.5 truncate text-[12px] text-ink-muted">
              {personSubtitle(person)}
            </p>
          )}
          {person.highlights && (
            <p className="mt-1 text-[12px] text-ink-muted">{person.highlights}</p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-subtle">
            {person.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" /> {person.location}
              </span>
            )}
            {person.education && (
              <span className="inline-flex items-center gap-1">
                <GraduationCap className="size-3" /> {person.education}
              </span>
            )}
            {person.email && (
              <a
                href={`mailto:${person.email}`}
                className="inline-flex items-center gap-1 hover:text-accent"
              >
                <Mail className="size-3" /> {person.email}
              </a>
            )}
            {person.linkedin && (
              <a
                href={person.linkedin}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-accent"
              >
                <Linkedin className="size-3" /> LinkedIn
              </a>
            )}
            <a
              href={crmUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-accent"
            >
              the CRM <ArrowUpRight className="size-3" />
            </a>
          </div>

          {/* What we have to write with — the reason this founder is at this position. */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] text-ink-subtle">Profile</span>
            <span className="relative h-1.5 w-24 overflow-hidden rounded-full bg-surface-sunken">
              <span
                className="ws-bar-grow ws-stagger absolute inset-y-0 left-0 rounded-full bg-accent"
                style={
                  {
                    width: `${entry.completeness.pct}%`,
                    "--i": index,
                  } as React.CSSProperties
                }
              />
            </span>
            <span className="ws-nums text-[11px] text-ink-subtle">
              {Math.round(entry.completeness.pct)}%
            </span>
            {entry.completeness.missing.length > 0 && (
              <span className="text-[11px] text-ink-subtle">
                no {entry.completeness.missing.map((f) => f.label.toLowerCase()).join(", ")}
              </span>
            )}
          </div>

          {/*
            Show the generated founder signals that fired rather than a bare score. An
            empty set is shown as missing data, not a negative verdict.
          */}
          {hasEnrichment && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-ink-subtle">Signals</span>
              {entry.quality.hits.length > 0 ? (
                entry.quality.hits.map((hit) => (
                  <span
                    key={hit.label}
                    title={hit.meaning}
                    className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent"
                  >
                    {hit.label}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-ink-subtle">
                  {entry.quality.noData
                    ? "the enrichment provider has no highlights for this person"
                    : "no notable founder signals"}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0">
          {state === "done" ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-positive">
              <Check className="size-3.5" /> Marked
            </span>
          ) : state === "idle" ? (
            <Button variant="secondary" onClick={() => setState("confirming")}>
              <Sparkles className="size-3.5" /> Mark reached out
            </Button>
          ) : null}
        </div>
      </div>

      {(state === "confirming" || state === "saving") && (
        <div className="mt-3 ml-8 space-y-2">
          <Callout tone="warn">
            Mark <strong>{person.name ?? "this person"}</strong> as contacted? This
            updates local demo data; it does not send a message.
          </Callout>
          {error && <Callout tone="error">{error}</Callout>}
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={confirm}
              disabled={state === "saving"}
            >
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
