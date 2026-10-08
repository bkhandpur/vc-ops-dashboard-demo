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

/**
 * Sidebar layout state, shared by the sidebar itself and the top bar's hamburger.
 *
 * ── THREE LAYOUTS, DRIVEN BY WIDTH ───────────────────────────────────────────
 *   ≥1024px  "full"    label + icon, as it has always been
 *   640–1023 "rail"    icon-only, 3.25rem, label on hover as a tooltip
 *   <640px   "overlay" off-canvas, opened by the hamburger in the top bar
 *
 * The breakpoint is read in JS rather than done purely in CSS because the *overlay*
 * needs real open/closed state and a focus trap — a CSS-only version cannot close
 * itself on navigation, which is the single most annoying failure mode of a mobile nav.
 *
 * The manual collapse choice persists only for the desktop layout. Narrower layouts
 * follow the viewport and ignore that stored preference.
 */

import { useHydrated } from "./useHydrated";

export type SidebarLayout = "full" | "rail" | "overlay";

interface SidebarState {
  layout: SidebarLayout;
  /** Only meaningful in "overlay" — whether the off-canvas nav is showing. */
  overlayOpen: boolean;
  openOverlay: () => void;
  closeOverlay: () => void;
  /** User's manual collapse toggle. Only honoured at ≥1024px. */
  collapsed: boolean;
  toggleCollapsed: () => void;
}

const SidebarContext = createContext<SidebarState | null>(null);

export function useSidebar(): SidebarState {
  const hydrated = useHydrated();
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside <SidebarProvider>");
  return hydrated ? ctx : { ...ctx, layout: "full", collapsed: false, overlayOpen: false };
}

const STORAGE_KEY = "vc-ops:sidebar-collapsed";

/** Matches the Tailwind breakpoints used elsewhere in the app. */
const RAIL_MAX = 1024;
const OVERLAY_MAX = 640;

function layoutForWidth(width: number, collapsed: boolean): SidebarLayout {
  if (width < OVERLAY_MAX) return "overlay";
  if (width < RAIL_MAX) return "rail";
  return collapsed ? "rail" : "full";
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Start "full" so the server and first client render agree; the effect below
  // corrects it before paint via a layout-ish effect on mount.
  const [width, setWidth] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* private mode — fall back to expanded */
    }
    const onResize = () => setWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const layout = layoutForWidth(width ?? 1280, collapsed);

  // An overlay left open while the viewport grows back to desktop would sit there as a
  // dead scrim over a perfectly good sidebar.
  useEffect(() => {
    if (layout !== "overlay") setOverlayOpen(false);
  }, [layout]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const openOverlay = useCallback(() => setOverlayOpen(true), []);
  const closeOverlay = useCallback(() => setOverlayOpen(false), []);

  const value = useMemo(
    () => ({
      layout,
      overlayOpen,
      openOverlay,
      closeOverlay,
      collapsed,
      toggleCollapsed,
    }),
    [layout, overlayOpen, openOverlay, closeOverlay, collapsed, toggleCollapsed],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}
