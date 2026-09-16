"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { EntryBackdrop, EntryHero } from "./EntryHero";

const SESSION_KEY = "entry-splash-shown";
/** How long the mark holds before it starts leaving. */
const HOLD_MS = 2600;
/** The dissolve. */
const FADE_MS = 620;

type Phase = "hidden" | "showing" | "leaving";

/**
 * The wordmark fills the screen once on arrival, water rising through the letters, then
 * dissolves into the dashboard.
 *
 * ── THE CONSTRAINTS ARE THE FEATURE ──────────────────────────────────────────
 * A splash on a tool somebody opens twenty times a day stops being delightful very fast.
 * So:
 *   - once per browser SESSION, not once per navigation
 *   - any click or keypress skips it instantly
 *   - skipped entirely under `prefers-reduced-motion`
 *   - never blocks data — the dashboard is already rendered underneath, so this is
 *     purely a curtain and not a loading screen
 *
 * The hold is 2.6s, which is long enough for the water to finish rising through the
 * letters and the second line to land, and short enough that a returning visitor who
 * came for the dashboard is not waiting on it.
 *
 * ── A BUG WORTH REMEMBERING ──────────────────────────────────────────────────
 * An earlier version registered the skip listeners in an effect that *also* set a
 * `setTimeout(…, FADE_MS)` to hide the splash. That timer fired ~600ms in regardless of
 * HOLD_MS, so the whole animation was killed almost immediately and read as a flicker —
 * and the obvious diagnosis, "the hold is too short", was wrong. The timeline now lives
 * in exactly one effect, and nothing else ever schedules "hidden".
 */
export function EntrySplash() {
  // Start hidden so the server and the first client render agree; the effect decides.
  const [phase, setPhase] = useState<Phase>("hidden");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  /** Skip: go straight to leaving, then hidden after the dissolve. */
  const skip = useCallback(() => {
    clearTimers();
    setPhase((current) => (current === "showing" ? "leaving" : current));
    timers.current.push(setTimeout(() => setPhase("hidden"), FADE_MS));
  }, [clearTimers]);

  // The one and only timeline.
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      // Storage blocked — treat as shown, so nobody gets trapped behind a splash on
      // every single page load.
      alreadyShown = true;
    }
    if (reduceMotion || alreadyShown) return;

    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* not fatal */
    }

    setPhase("showing");
    timers.current.push(setTimeout(() => setPhase("leaving"), HOLD_MS));
    timers.current.push(setTimeout(() => setPhase("hidden"), HOLD_MS + FADE_MS));

    return clearTimers;
  }, [clearTimers]);

  // Skip listeners, attached only while the mark is actually up.
  useEffect(() => {
    if (phase !== "showing") return;
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);
    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [phase, skip]);

  if (phase === "hidden") return null;
  const leaving = phase === "leaving";

  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[100] grid place-items-center overflow-hidden"
      style={{
        backgroundColor: "var(--brand-navy)",
        opacity: leaving ? 0 : 1,
        // Lifting away as it fades reads as moving through the mark rather than a cut.
        transform: leaving ? "scale(1.04)" : "scale(1)",
        transition: `opacity ${FADE_MS}ms ease-out, transform ${FADE_MS}ms cubic-bezier(0.4, 0, 1, 1)`,
        pointerEvents: leaving ? "none" : "auto",
      }}
    >
      <EntryBackdrop />
      <div className="relative flex w-full justify-center px-6">
        <EntryHero />
      </div>
    </div>
  );
}
