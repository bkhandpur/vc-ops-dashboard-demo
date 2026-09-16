"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { fuzzySearch } from "@/lib/fuzzy";
import { Input } from "../ui";

/** Article shape passed from the server — content included so search covers bodies. */
export interface HelpIndexEntry {
  slug: string;
  title: string;
  summary: string;
  content: string;
}

/**
 * Sidebar nav + client-side fuzzy search over titles, summaries and bodies.
 * Articles come from /content/help/*.md — dropping in a new file adds it here
 * automatically, no code change.
 */
export function HelpBrowser({ articles }: { articles: HelpIndexEntry[] }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  const matches = useMemo(
    () =>
      fuzzySearch(query, articles, (a) => [a.title, a.summary, a.content]).map((m) => m.item),
    [query, articles],
  );

  return (
    <aside className="w-64 shrink-0">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-2 left-2.5 size-3.5 text-ink-subtle" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help…"
          className="pl-8"
        />
      </div>

      <nav className="space-y-0.5">
        {matches.length === 0 && (
          <p className="px-2 py-2 text-[12px] text-ink-subtle">No articles matched.</p>
        )}
        {matches.map((article) => {
          const href = `/help/${article.slug}`;
          const active = pathname === href;
          return (
            <Link
              key={article.slug}
              href={href}
              className={`block rounded-md px-2.5 py-2 text-[13px] ${
                active
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
              }`}
            >
              <span className="block">{article.title}</span>
              {article.summary && (
                <span className="mt-0.5 block text-[11px] text-ink-subtle">
                  {article.summary}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
