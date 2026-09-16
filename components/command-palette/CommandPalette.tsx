"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { fuzzySearch } from "@/lib/fuzzy";
import { PALETTE_ACTIONS, type PaletteAction } from "./actions";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset to the action list every time the palette opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveId(null);
      setHighlight(0);
      // Focus after paint.
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  const results = useMemo(
    () =>
      fuzzySearch(query, PALETTE_ACTIONS, (action) => [
        action.label,
        action.description,
        action.keywords.join(" "),
      ]).map((m) => m.item),
    [query],
  );

  useEffect(() => setHighlight(0), [query]);

  const active = activeId ? PALETTE_ACTIONS.find((a) => a.id === activeId) : null;

  if (!open) return null;

  function onListKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const chosen = results[highlight];
      if (chosen) setActiveId(chosen.id);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/25 px-4 pt-[12vh]"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          if (activeId) setActiveId(null);
          else onClose();
        }
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-line bg-surface shadow-2xl">
        {active ? (
          active.render({ onBack: () => setActiveId(null), onClose })
        ) : (
          <div>
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="size-4 shrink-0 text-ink-subtle" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onListKeyDown}
                placeholder="Search actions…"
                className="w-full bg-transparent py-3 text-[14px] text-ink placeholder:text-ink-subtle focus:outline-none"
              />
              <kbd className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-subtle">
                esc
              </kbd>
            </div>

            <ul className="max-h-80 overflow-y-auto py-1">
              {results.length === 0 && (
                <li className="px-4 py-6 text-center text-[13px] text-ink-subtle">
                  No actions match “{query}”.
                </li>
              )}
              {results.map((action, index) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  highlighted={index === highlight}
                  onHover={() => setHighlight(index)}
                  onSelect={() => setActiveId(action.id)}
                />
              ))}
            </ul>

            <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[11px] text-ink-subtle">
              <span>↑↓ to navigate · ↵ to select</span>
              <span>Writes to the CRM always ask you to confirm first</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionRow({
  action,
  highlighted,
  onHover,
  onSelect,
}: {
  action: PaletteAction;
  highlighted: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  const Icon = action.icon;
  return (
    <li>
      <button
        type="button"
        onMouseEnter={onHover}
        onClick={onSelect}
        className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
          highlighted ? "bg-accent-soft" : "bg-transparent"
        }`}
      >
        <Icon className="size-4 shrink-0 text-ink-muted" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">{action.label}</span>
          <span className="block truncate text-[11px] text-ink-subtle">{action.description}</span>
        </span>
        {action.writes && (
          <span className="shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-subtle">
            writes
          </span>
        )}
      </button>
    </li>
  );
}
