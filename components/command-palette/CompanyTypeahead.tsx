"use client";

import { useEffect, useRef, useState } from "react";

import { CompanyAvatar } from "../CompanyAvatar";
import { Input, Spinner } from "../ui";
import { errorMessage } from "./shared";

export interface CompanyHit {
  recordId: string;
  name: string | null;
  domains: string[];
  crmUrl: string;
  logoUrl?: string | null;
}

/**
 * Debounced company search. Hits /api/crm/companies/search (server-side), never
 * the CRM directly.
 */
export function CompanyTypeahead({
  onSelect,
  placeholder = "Search companies by name…",
  autoFocus = true,
}: {
  onSelect: (company: CompanyHit) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CompanyHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      setError(null);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/crm/companies/search?q=${encodeURIComponent(trimmed)}`);
        const payload = (await res.json()) as { companies?: CompanyHit[]; error?: string };
        if (id !== requestId.current) return;
        if (!res.ok) throw new Error(payload.error || `Search failed (${res.status})`);
        setHits(payload.companies ?? []);
        setError(null);
      } catch (err) {
        if (id === requestId.current) setError(errorMessage(err));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="space-y-2">
      <Input
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
      />
      {loading && <Spinner label="Searching…" />}
      {error && <p className="text-[12px] text-negative">{error}</p>}
      {hits.length > 0 && (
        <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-md border border-line">
          {hits.map((hit) => (
            <li key={hit.recordId}>
              <button
                type="button"
                onClick={() => onSelect(hit)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-sunken"
              >
                <CompanyAvatar name={hit.name} logoUrl={hit.logoUrl} size={22} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-ink">
                    {hit.name ?? "(unnamed)"}
                  </span>
                  {hit.domains.length > 0 && (
                    <span className="block truncate text-[11px] text-ink-subtle">
                      {hit.domains.join(", ")}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!loading && !error && query.trim().length >= 2 && hits.length === 0 && (
        <p className="text-[12px] text-ink-subtle">No companies matched.</p>
      )}
    </div>
  );
}
