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

import { CommandPalette } from "./CommandPalette";

interface CommandPaletteContextValue {
  open: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

/**
 * The cached snapshot, available to palette actions.
 *
 * It is the same object the global search already receives from the server layout — a
 * cache read, not a CRM call. Exposing it here is what lets "Quick summary" render
 * with no request at all: an action meant to be used thirty seconds before a call
 * cannot afford a round trip, and the typeahead used by the write actions does hit
 * the CRM (via our own route) because those need to search records we may not hold.
 */
const SnapshotContext = createContext<SearchIndex | null>(null);

export function usePaletteSnapshot(): SearchIndex {
  const ctx = useContext(SnapshotContext);
  if (!ctx) throw new Error("usePaletteSnapshot must be used inside <CommandPaletteProvider>");
  return ctx;
}

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette must be used inside <CommandPaletteProvider>");
  return ctx;
}

export function CommandPaletteProvider({
  children,
  index,
}: {
  children: ReactNode;
  index: SearchIndex;
}) {
  const [open, setOpen] = useState(false);

  const openPalette = useCallback(() => setOpen(true), []);
  const closePalette = useCallback(() => setOpen(false), []);
  const togglePalette = useCallback(() => setOpen((o) => !o), []);

  // Cmd/Ctrl+K anywhere in the app.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(
    () => ({ open, openPalette, closePalette, togglePalette }),
    [open, openPalette, closePalette, togglePalette],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      <SnapshotContext.Provider value={index}>
        {children}
        <CommandPalette open={open} onClose={closePalette} />
      </SnapshotContext.Provider>
    </CommandPaletteContext.Provider>
  );
}
