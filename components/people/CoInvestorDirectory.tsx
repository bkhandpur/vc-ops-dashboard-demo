"use client";

import { ArrowUpRight, Linkedin } from "lucide-react";
import { useMemo, useState } from "react";

import { CompanyAvatar } from "@/components/CompanyAvatar";
import {
  Badge,
  Callout,
  cx,
  EmptyState,
  Footnote,
  Input,
  PageHeader,
  Panel,
  PanelHeader,
  StatTile,
  TogglePill,
} from "@/components/ui";
import { crmRecordUrl, ROUND_ORDER } from "@/lib/constants";
import { fuzzySearch } from "@/lib/fuzzy";
import {
  parseThesisFocus,
  personSubtitle,
  rollupByDeal,
  rollupByFocus,
  rollupByInvestor,
  rollupByStageFocus,
  type TrackedPerson,
} from "@/lib/people-derive";

/**
 * The Co-Investor view — 96 investors, and who we have actually co-invested with.
 *
 * ── A CORRECTION WORTH READING ───────────────────────────────────────────────
 * An earlier pass shipped this as a directory only, concluding that no co-investor→deal
 * link existed anywhere in the workspace. **That was wrong.** It checked
 * `GET /v2/objects/people/attributes` and every reference field on the people object —
 * and missed that the link lives on the **Co-Investors LIST ENTRY**, in
 * `deals_co_invested`, which is **100% populated**. List attributes do not appear in an
 * object-attribute query at all.
 *
 * The lesson, now encoded in `npm run coverage`: enumerate objects **and** lists,
 * and rank by measured coverage. Do not conclude "the data does not exist" from a query
 * that structurally cannot see it.
 *
 * `fund_firm` and `check_size_range` are also 100% on the list entry and were invisible
 * for the same reason.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Deal names are free text, matched to real company records by a normalised comparison
 * (`normaliseCompanyName`). A name that matches nothing is still counted and shown — it
 * is a real co-investment, it just is not on a list we snapshot.
 */
/** How many rows each syndicate panel shows before "Show all". */
const PREVIEW_ROWS = 5;

export function CoInvestorDirectory({
  people,
  companies,
  generatedAt,
}: {
  people: TrackedPerson[];
  /** Snapshot companies, so deal names can resolve to real records. */
  companies: { recordId: string; name: string | null; logoUrl: string | null; theme: string | null }[];
  generatedAt: string;
}) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [deal, setDeal] = useState<string | null>(null);

  const byDeal = useMemo(() => rollupByDeal(people, companies), [people, companies]);
  const byInvestor = useMemo(() => rollupByInvestor(people), [people]);
  const withDeals = byInvestor.length;
  const matchedDeals = byDeal.filter((d) => d.recordId !== null).length;

  const stageRollup = useMemo(() => {
    const rows = rollupByStageFocus(people);
    const order = (name: string) => {
      const i = (ROUND_ORDER as readonly string[]).indexOf(name);
      return i === -1 ? 999 : i;
    };
    return rows.sort((a, b) => order(a.name) - order(b.name));
  }, [people]);

  const focusRollup = useMemo(() => rollupByFocus(people).slice(0, 10), [people]);

  // Show-more controls keep both long panels usable without nested scrolling.
  const [showAllDeals, setShowAllDeals] = useState(false);
  const [showAllInvestors, setShowAllInvestors] = useState(false);

  const withThesis = people.filter((p) => parseThesisFocus(p.sectorThesisFocus).length > 0).length;

  const filtered = useMemo(() => {
    let list = people;
    if (deal) list = list.filter((p) => p.dealsCoInvested.includes(deal));
    if (stage) list = list.filter((p) => p.stageFocus === stage);
    if (focus) list = list.filter((p) => parseThesisFocus(p.sectorThesisFocus).includes(focus));
    if (query.trim()) {
      list = fuzzySearch(query, list, (p) => [
        p.fundFirm ?? p.name ?? "",
        p.dealsCoInvested.join(" "),
        p.sectorThesisFocus ?? "",
        p.linkedinCompany ?? "",
      ]).map((m) => m.item);
    } else {
      list = [...list].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    }
    return list;
  }, [people, stage, focus, query, deal]);

  return (
    <>
      <PageHeader
        eyebrow="Explore"
        title="Co-Investors"
        description="Who we actually co-invest with, and the stage and sectors each firm backs."
      />

      <div className="ws-enter ws-delay-1 mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Co-investors" value={people.length.toLocaleString()} />
        <StatTile
          label="Shared deals"
          value={byDeal.length.toString()}
          hint={`${matchedDeals} matched to a company we hold`}
        />
        <StatTile
          label="With a stage focus"
          value={`${Math.round((stageRollup.reduce((s, r) => s + r.count, 0) / Math.max(people.length, 1)) * 100)}%`}
        />
        <StatTile
          label="With a thesis"
          value={`${Math.round((withThesis / Math.max(people.length, 1)) * 100)}%`}
          hint={`${withThesis} have a parseable focus`}
        />
      </div>

      <div className="ws-enter ws-delay-2 mb-5 grid gap-4 lg:grid-cols-2">
        <Panel className="overflow-hidden">
          <PanelHeader
            title="Most-syndicated companies"
            description="Our companies, by how many co-investors we share them with."
          />
          <ul className="divide-y divide-line">
            {byDeal.slice(0, showAllDeals ? undefined : PREVIEW_ROWS).map((row) => {
              const selected = deal === row.name;
              return (
                <li key={row.name}>
                  <button
                    type="button"
                    onClick={() => setDeal(selected ? null : row.name)}
                    className={cx(
                      "flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors duration-[var(--dur-quick)]",
                      selected ? "bg-accent-soft" : "hover:bg-surface-sunken",
                    )}
                  >
                    <CompanyAvatar name={row.name} logoUrl={row.logoUrl} size={22} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                      {row.name}
                      {row.recordId === null && (
                        <span className="ml-1.5 text-[10px] text-ink-subtle">
                          not on a tracked list
                        </span>
                      )}
                    </span>
                    <span className="ws-nums shrink-0 text-[13px] font-semibold text-ink">
                      {row.investors.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <ShowMore
            total={byDeal.length}
            shown={showAllDeals ? byDeal.length : Math.min(PREVIEW_ROWS, byDeal.length)}
            expanded={showAllDeals}
            onToggle={() => setShowAllDeals((v) => !v)}
            noun="companies"
          />
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHeader
            title="Most frequent co-investors"
            description="Firms we appear alongside on the most deals."
          />
          <ul className="divide-y divide-line">
            {byInvestor.slice(0, showAllInvestors ? undefined : PREVIEW_ROWS).map((row) => (
              <li
                key={row.person.recordId}
                className="flex items-center gap-3 px-4 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">{row.label}</span>
                  <span className="block truncate text-[11px] text-ink-subtle">
                    {row.deals.join(" · ")}
                  </span>
                </span>
                <span className="ws-nums shrink-0 text-[13px] font-semibold text-ink">
                  {row.deals.length}
                </span>
              </li>
            ))}
          </ul>
          <ShowMore
            total={byInvestor.length}
            shown={
              showAllInvestors ? byInvestor.length : Math.min(PREVIEW_ROWS, byInvestor.length)
            }
            expanded={showAllInvestors}
            onToggle={() => setShowAllInvestors((v) => !v)}
            noun="co-investors"
          />
          <div className="px-4 pb-3">
            <Footnote>
              {withDeals} of {people.length} co-investors have at least one recorded deal.
              Most appear on exactly one, so this ranks depth of relationship, not volume.
            </Footnote>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Panel className="ws-enter ws-delay-3 overflow-hidden">
            <PanelHeader title="Stage focus" />
            {stageRollup.length === 0 ? (
              <EmptyState title="No stage data" />
            ) : (
              <div className="flex flex-wrap gap-1.5 px-4 py-3">
                {stageRollup.map((row) => (
                  <TogglePill
                    key={row.name}
                    active={stage === row.name}
                    onClick={() => setStage((s) => (s === row.name ? null : row.name))}
                  >
                    {row.name}
                    <span className="ws-nums ml-1.5 text-ink-subtle">{row.count}</span>
                  </TogglePill>
                ))}
              </div>
            )}
          </Panel>

          <Panel className="ws-enter ws-delay-4 overflow-hidden">
            <PanelHeader
              title="Sector focus"
              description="Parsed from each investor's thesis sentence."
            />
            {focusRollup.length === 0 ? (
              <EmptyState title="No thesis data" />
            ) : (
              <ul className="divide-y divide-line">
                {focusRollup.map((row) => {
                  const selected = focus === row.name;
                  return (
                    <li key={row.name}>
                      <button
                        type="button"
                        onClick={() => setFocus((f) => (f === row.name ? null : row.name))}
                        className={cx(
                          "flex w-full items-center gap-3 px-4 py-2 text-left text-[12px] transition-colors duration-[var(--dur-quick)]",
                          selected ? "bg-accent-soft text-accent" : "hover:bg-surface-sunken",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">{row.name}</span>
                        <span className="ws-nums shrink-0 font-medium">{row.count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <Panel className="ws-enter ws-delay-5 overflow-hidden lg:col-span-2">
          <PanelHeader
            title={`Directory${filtered.length !== people.length ? ` · ${filtered.length} of ${people.length}` : ""}`}
            actions={
              (stage || focus || deal) && (
                <button
                  type="button"
                  onClick={() => {
                    setStage(null);
                    setFocus(null);
                    setDeal(null);
                  }}
                  className="text-[12px] font-medium text-accent hover:underline"
                >
                  Clear filters
                </button>
              )
            }
          />

          <div className="border-b border-line px-4 py-2.5">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name, firm or thesis…"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No co-investors match">
              Clear the filters to see the whole directory.
            </EmptyState>
          ) : (
            // This list keeps its inner scroll, unlike the two syndicate panels above:
            // it is the page's main directory and runs to 96 rows, where show-more
            // would just mean one extra click before the same long scroll. It gets the
            // visible `.ws-scroll` scrollbar instead
            // so it can never read as a stuck page.
            <ul className="ws-scroll max-h-[38rem] divide-y divide-line overflow-y-auto">
              {filtered.map((person, index) => {
                const focuses = parseThesisFocus(person.sectorThesisFocus);
                return (
                  <li
                    key={person.recordId}
                    className="ws-enter flex items-start gap-3 px-4 py-2.5"
                    style={{ animationDelay: `${Math.min(index, 12) * 16}ms` }}
                  >
                    <CompanyAvatar
                      name={person.name}
                      logoUrl={person.avatarUrl}
                      size={30}
                      className="mt-0.5 rounded-full"
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">
                        {person.fundFirm ?? person.name ?? "Unnamed"}
                      </span>
                      {person.fundFirm && person.name && person.fundFirm !== person.name && (
                        <span className="block truncate text-[11px] text-ink-subtle">
                          {person.name}
                        </span>
                      )}
                      {person.checkSizeRange && (
                        <span className="block truncate text-[11px] text-ink-muted">
                          Cheque {person.checkSizeRange}
                        </span>
                      )}
                      {personSubtitle(person) && (
                        <span className="block truncate text-[11px] text-ink-subtle">
                          {personSubtitle(person)}
                        </span>
                      )}
                      {focuses.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {focuses.map((f) => (
                            <Badge key={f}>{f}</Badge>
                          ))}
                        </span>
                      )}
                    </span>

                    {person.stageFocus && (
                      <Badge tone="accent" className="mt-0.5">
                        {person.stageFocus}
                      </Badge>
                    )}

                    <span className="mt-0.5 flex shrink-0 items-center gap-1.5">
                      {person.sourceDocumentUrl && (
                        <a
                          href={person.sourceDocumentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="the enrichment provider profile"
                          className="text-[10px] text-ink-subtle transition-colors hover:text-accent"
                        >
                          H
                        </a>
                      )}
                      {person.linkedin && (
                        <a
                          href={person.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="LinkedIn profile"
                          className="text-ink-subtle transition-colors hover:text-accent"
                        >
                          <Linkedin className="size-3.5" />
                        </a>
                      )}
                      <a
                        href={crmRecordUrl("people", person.recordId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in the CRM"
                        className="text-ink-subtle transition-colors hover:text-accent"
                      >
                        <ArrowUpRight className="size-3.5" />
                      </a>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Footnote>
        Sector focus is parsed from a free-text field that reads either &ldquo;Invests
        primarily in X, Y&rdquo; or the literal string &ldquo;unavailable&rdquo;; the
        latter is treated as no data rather than as a focus area called
        &ldquo;unavailable&rdquo;. Snapshot taken {new Date(generatedAt).toLocaleString()}.
      </Footnote>
    </>
  );
}

/**
 * "Showing 5 of 21 — Show all" footer.
 *
 * Replaces the fixed-height inner scrollers these panels used to have. A nested scroll
 * region with no visible scrollbar is indistinguishable from a frozen page, which is
 * exactly how the usability pass read it. This states the count outright, so the amount
 * of hidden data is legible before you decide to expand.
 */
function ShowMore({
  total,
  shown,
  expanded,
  onToggle,
  noun,
}: {
  total: number;
  shown: number;
  expanded: boolean;
  onToggle: () => void;
  noun: string;
}) {
  if (total <= shown && !expanded) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2">
      <span className="text-[11px] text-ink-subtle">
        Showing {shown} of {total} {noun}
      </span>
      {total > PREVIEW_ROWS && (
        <button
          type="button"
          onClick={onToggle}
          className="text-[12px] font-medium text-accent hover:underline"
        >
          {expanded ? "Show top 5" : `Show all ${total}`}
        </button>
      )}
    </div>
  );
}
