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

import type { ColorMode } from "../statistics/colors";

/** What the user chose. "system" follows the OS and is the default. */
export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "vc-ops-theme";

/**
 * Runs before first paint to stamp an explicit choice on <html>, so a dark-mode user
 * never sees a white flash. Deliberately does NOT stamp for "system" — CSS handles that
 * via prefers-color-scheme, which keeps the page correct even with JS disabled.
 *
 * Injected as an inline script in the root layout; keep it small and dependency-free.
 */
export const THEME_INIT_SCRIPT = `
(function(){try{
  var p = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  if (p === "light" || p === "dark") document.documentElement.setAttribute("data-theme", p);
}catch(e){}})();
`.trim();

interface ThemeContextValue {
  preference: ThemePreference;
  /** The mode actually on screen — what charts must colour against. */
  mode: ColorMode;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

/** Charts only ever need the resolved mode. */
export function useColorMode(): ColorMode {
  return useTheme().mode;
}

function systemMode(): ColorMode {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start at the SSR-safe default and correct it after mount, so server and first
  // client render agree and React doesn't complain about a hydration mismatch.
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<ColorMode>("light");

  useEffect(() => {
    let stored: ThemePreference = "system";
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      if (raw === "light" || raw === "dark" || raw === "system") stored = raw;
    } catch {
      /* private mode / storage disabled — fall back to system */
    }
    setPreferenceState(stored);
    setResolved(stored === "system" ? systemMode() : stored);
    applyPreference(stored);
  }, []);

  // Track OS changes, but only while the user is actually following the system.
  useEffect(() => {
    if (preference !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(query.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    setResolved(next === "system" ? systemMode() : next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* not fatal — the choice just won't persist */
    }
    applyPreference(next);
  }, []);

  const value = useMemo(
    () => ({ preference, mode: resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function applyPreference(next: ThemePreference): void {
  const root = document.documentElement;
  if (next === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", next);
}
