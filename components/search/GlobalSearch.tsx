"use client";

import { ArrowUpRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { CompanyAvatar } from "@/components/CompanyAvatar";
import { ThemeSwatch } from "@/components/statistics/ThemeSwatch";
import { KIND_LABELS, searchAll, type SearchHit, type SearchIndex } from "@/lib/search";

/**
 * Read-only search across companies, stealth founders and co-investors in one box.
 *
 * Everything is client-side over the cached snapshot, so results appear as you type with
 * no request at all. There are no actions here — selecting a result navigates. Writes
 * live in the command palette (⌘K), behind a confirm step.
 */
export function GlobalSearch({
  open,
  onClose,
  index,
  generatedAt,
}: {
  open: boolean;
  onClose: () => void;
  index: SearchIndex;
  generatedAt: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  const groups = useMemo(() => searchAll(query, index), [query, index]);
  // One flat list behind the grouped display, so ↑↓ crosses group boundaries the way a
  // reader expects rather than trapping the cursor inside "Companies".
  const flat = useMemo(() => groups.flatMap((g) => g.hits), [groups]);

  useEffect(() => setHighlight(0), [query]);

  if (!open) return null;

  function go(hit: SearchHit) {
    onClose();
    if (hit.external) window.open(hit.href, "_blank", "noopener,noreferrer");
    else router.push(hit.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, flat.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const chosen = flat[highlight];
      if (chosen) go(chosen);
    }
  }

  let cursor = -1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/25 px-4 pt-[12vh] backdrop-blur-[2px]"
      onKeyDown={onKeyDown}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="ws-enter w-full max-w-xl overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface-overlay shadow-[var(--shadow-overlay)]">
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="size-4 shrink-0 text-ink-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies, founders and co-investors…"
            className="w-full bg-transparent py-3 text-[14px] text-ink placeholder:text-ink-subtle focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-subtle">
            esc
          </kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto py-1">
          {query.trim() === "" ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-subtle">
              Type to search across {index.companies.length} companies,{" "}
              {index.founders.length} stealth founders and {index.coInvestors.length}{" "}
              co-investors.
            </p>
          ) : flat.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-ink-subtle">
              Nothing matches “{query}”.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.kind}>
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-[0.08em] text-ink-subtle uppercase">
                  {KIND_LABELS[group.kind]}
                </p>
                <ul>
                  {group.hits.map((hit) => {
                    cursor += 1;
                    const index = cursor;
                    return (
                      <li key={`${hit.kind}-${hit.recordId}`}>
                        <button
                          type="button"
                          onMouseEnter={() => setHighlight(index)}
                          onClick={() => go(hit)}
                          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${
                            index === highlight ? "bg-accent-soft" : "bg-transparent"
                          }`}
                        >
                          <CompanyAvatar name={hit.title} logoUrl={hit.logoUrl} size={22} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              {hit.theme && <ThemeSwatch theme={hit.theme} />}
                              <span className="truncate text-[13px] font-medium text-ink">
                                {hit.title}
                              </span>
                            </span>
                            {hit.subtitle && (
                              <span className="block truncate text-[11px] text-ink-subtle">
                                {hit.subtitle}
                              </span>
                            )}
                          </span>
                          {hit.meta && (
                            <span className="shrink-0 text-[11px] text-ink-subtle">{hit.meta}</span>
                          )}
                          {hit.external && (
                            <ArrowUpRight className="size-3.5 shrink-0 text-ink-subtle" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[11px] text-ink-subtle">
          <span>↑↓ to navigate · ↵ to open</span>
          <span>
            {generatedAt
              ? `Snapshot ${new Date(generatedAt).toLocaleDateString()} · read-only`
              : "Read-only"}
          </span>
        </div>
      </div>
    </div>
  );
}
