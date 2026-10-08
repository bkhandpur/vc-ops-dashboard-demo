"use client";
import { mutateDemo } from "@/lib/demo-mutation";

import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { Children, useState } from "react";

import type { Digest } from "@/lib/digest";
import { crmRecordUrl, STAGE_LABELS } from "@/lib/constants";
import { CompanyAvatar } from "../CompanyAvatar";
import { Button, Callout, Panel, cx } from "../ui";

export function DigestList({ digests }: { digests: Digest[] }) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(digests[0]?.id ?? null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runDiff() {
    setRunning(true);
    setError(null);
    try {
      const res = await mutateDemo(() => fetch("/api/digest/run", { method: "POST" }));
      const payload = (await res.json()) as { error?: string; digestId?: string };
      if (!res.ok) throw new Error(payload.error || `Failed (${res.status})`);
      if (payload.digestId) setOpenId(payload.digestId);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run the digest job");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] text-ink-subtle">
          Illustrative weekly snapshots are generated from the sample. Run a diff to compare this
          browser’s edits with the original seed. No scheduled collection is active.
        </p>
        <Button variant="secondary" onClick={runDiff} disabled={running}>
          {running ? "Running…" : "Run diff now"}
        </Button>
      </div>

      {error && <Callout tone="error">{error}</Callout>}

      {digests.length === 0 && (
        <Panel className="p-6 text-[13px] text-ink-muted">
          No sample digests are available. Run a diff to compare your edits with the seed.
        </Panel>
      )}

      {digests.map((digest) => (
        <DigestCard
          key={digest.id}
          digest={digest}
          open={openId === digest.id}
          onToggle={() => setOpenId(openId === digest.id ? null : digest.id)}
        />
      ))}
    </div>
  );
}

function DigestCard({
  digest,
  open,
  onToggle,
}: {
  digest: Digest;
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateSummary() {
    setGenerating(true);
    setError(null);
    try {
      const res = await mutateDemo(() =>
        fetch(`/api/digest/${encodeURIComponent(digest.id)}/summarize`, {
          method: "POST",
        }),
      );
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error || `Failed (${res.status})`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate a summary");
    } finally {
      setGenerating(false);
    }
  }

  const changeCount =
    digest.newInPipeline.length +
    digest.stageMoves.length +
    digest.newStealthFounders.length +
    digest.newNotes.length;

  return (
    <Panel>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {open ? (
          <ChevronDown className="size-4 shrink-0 text-ink-subtle" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-ink-subtle" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-ink">{digest.periodLabel}</span>
          <span className="block text-[11px] text-ink-subtle">
            {digest.comparedTo === null
              ? "Baseline snapshot — nothing to compare against yet"
              : `${changeCount} change${changeCount === 1 ? "" : "s"}`}
            {" · "}
            {Object.entries(digest.totals)
              .map(
                ([stage, count]) => `${STAGE_LABELS[stage as keyof typeof STAGE_LABELS]} ${count}`,
              )
              .join(" · ")}
          </span>
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-line px-4 py-4">
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-[12px] font-medium tracking-wide text-ink-subtle uppercase">
                Summary
              </h3>
              <Button variant="ghost" onClick={generateSummary} disabled={generating}>
                <FileText className="size-3.5" />
                {generating
                  ? "Writing…"
                  : digest.summary
                    ? "Regenerate summary"
                    : "Generate summary"}
              </Button>
            </div>
            {error && <Callout tone="error">{error}</Callout>}
            {digest.summary ? (
              <div className="space-y-2 text-[13px] leading-relaxed text-ink">
                {digest.summary.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-wrap">
                    {paragraph}
                  </p>
                ))}
                <p className="text-[11px] text-ink-subtle">
                  Drafted{" "}
                  {digest.summaryGeneratedAt &&
                    new Date(digest.summaryGeneratedAt).toLocaleString("en-US", {
                      timeZone: "UTC",
                    })}
                  {digest.summaryGeneratedBy ? ` by ${digest.summaryGeneratedBy}` : ""} from the
                  structured diff below. Review before sharing.
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-ink-subtle">
                No summary drafted yet. The structured diff appears below.
              </p>
            )}
          </section>

          <Section title="New companies on Pipeline" count={digest.newInPipeline.length}>
            {digest.newInPipeline.map((c) => (
              <Row
                key={c.recordId}
                primary={c.name ?? c.recordId}
                secondary={`${c.theme} · ${c.canonicalSector}`}
                href={crmRecordUrl("companies", c.recordId)}
                avatar={<CompanyAvatar name={c.name} logoUrl={c.logoUrl} size={20} />}
              />
            ))}
          </Section>

          <Section title="Stage movements" count={digest.stageMoves.length}>
            {digest.stageMoves.map((m) => (
              <Row
                key={m.recordId}
                primary={m.name ?? m.recordId}
                secondary={`${m.from ? STAGE_LABELS[m.from] : "off-list"} → ${
                  m.to ? STAGE_LABELS[m.to] : "removed from all lists"
                }`}
                href={crmRecordUrl("companies", m.recordId)}
              />
            ))}
          </Section>

          <Section title="New Stealth Founders" count={digest.newStealthFounders.length}>
            {digest.newStealthFounders.map((p) => (
              <Row
                key={p.recordId}
                primary={p.name ?? p.recordId}
                href={crmRecordUrl("people", p.recordId)}
              />
            ))}
          </Section>

          <Section title="New notes & interactions" count={digest.newNotes.length}>
            {digest.newNotes.map((n) => (
              <Row
                key={n.noteId}
                primary={n.title || "(untitled note)"}
                secondary={new Date(n.createdAt).toLocaleString("en-US", { timeZone: "UTC" })}
              />
            ))}
          </Section>

          <Section title="Portfolio theme mix shifts" count={digest.themeShifts.length}>
            {digest.themeShifts.map((s) => (
              <Row
                key={s.label}
                primary={s.label}
                secondary={`${s.previous} → ${s.current}`}
                delta={s.delta}
              />
            ))}
          </Section>

          <Section title="Portfolio sector mix shifts" count={digest.sectorShifts.length}>
            {digest.sectorShifts.map((s) => (
              <Row
                key={s.label}
                primary={s.label}
                secondary={`${s.previous} → ${s.current}`}
                delta={s.delta}
              />
            ))}
          </Section>
        </div>
      )}
    </Panel>
  );
}

/** Beyond this many rows a section is a wall of text, so it collapses behind a toggle. */
const SECTION_PREVIEW = 12;

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = Children.toArray(children);
  const overflowing = items.length > SECTION_PREVIEW;
  const visible = expanded ? items : items.slice(0, SECTION_PREVIEW);

  return (
    <section>
      <h3 className="mb-1.5 text-[12px] font-medium tracking-wide text-ink-subtle uppercase">
        {title} <span className="tabular-nums">({count})</span>
      </h3>
      {count === 0 ? (
        <p className="text-[13px] text-ink-subtle">Nothing this period.</p>
      ) : (
        <>
          <ul className="divide-y divide-line/60">{visible}</ul>
          {overflowing && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-1.5 text-[12px] text-accent hover:underline"
            >
              {expanded
                ? "Show fewer"
                : `Show all ${items.length} (${items.length - SECTION_PREVIEW} more)`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function Row({
  primary,
  secondary,
  delta,
  href,
  avatar,
}: {
  primary: string;
  secondary?: string;
  delta?: number;
  /** the CRM record URL, so a digest row is a jumping-off point rather than a dead end. */
  href?: string;
  avatar?: React.ReactNode;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
      <span className="flex min-w-0 items-center gap-2.5">
        {avatar}
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-ink hover:text-accent hover:underline"
          >
            {primary}
          </a>
        ) : (
          <span className="text-ink">{primary}</span>
        )}
        {secondary && <span className="ml-2 text-[11px] text-ink-subtle">{secondary}</span>}
      </span>
      {delta !== undefined && (
        <span
          className={cx("shrink-0 tabular-nums", delta > 0 ? "text-positive" : "text-negative")}
        >
          {delta > 0 ? "+" : ""}
          {delta}
        </span>
      )}
    </li>
  );
}
