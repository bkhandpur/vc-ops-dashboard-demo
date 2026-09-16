"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { SearchIndex } from "@/lib/search";

import { GlobalSearch } from "./GlobalSearch";

interface SearchContextValue {
  open: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function useGlobalSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error("useGlobalSearch must be used inside <SearchProvider>");
  return ctx;
}

/**
 * Holds the global-search modal and its shortcut.
 *
 * ⌘/ rather than ⌘K, because ⌘K already opens the command palette and the two do
 * genuinely different jobs — one finds, one writes. Overloading a single key with "find
 * or maybe mutate the CRM" is exactly the ambiguity the read/write split exists to
 * avoid. ⌘/ is also what several tools use for search, so it is not a novel binding.
 *
 * The index is passed in from the server layout (it comes out of the cached snapshot),
 * so opening search costs no request at all.
 */
export function SearchProvider({
  children,
  index,
  generatedAt,
}: {
  children: ReactNode;
  index: SearchIndex;
  generatedAt: string | null;
}) {
  const [open, setOpen] = useState(false);

  const openSearch = useCallback(() => setOpen(true), []);
  const closeSearch = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "/" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(() => ({ open, openSearch, closeSearch }), [open, openSearch, closeSearch]);

  return (
    <SearchContext.Provider value={value}>
      {children}
      <GlobalSearch
        open={open}
        onClose={closeSearch}
        index={index}
        generatedAt={generatedAt}
      />
    </SearchContext.Provider>
  );
}
