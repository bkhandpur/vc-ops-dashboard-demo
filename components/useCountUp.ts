"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts a number up to its value on mount, and re-runs when the value changes (so a
 * filter change animates rather than snapping).
 *
 * Deliberate constraints:
 *  - Returns the final value immediately under `prefers-reduced-motion`, and on the very
 *    first server/client render, so nothing ever depends on the animation completing.
 *  - Short (420ms). A KPI you have to wait to read is a worse KPI.
 *  - Uses requestAnimationFrame rather than a timer, so it stops when the tab is hidden
 *    instead of burning frames in the background.
 */
export function useCountUp(value: number, durationMs = 420): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const from = fromRef.current;
    fromRef.current = value;

    if (reduce || from === value || durationMs <= 0) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      // easeOutCubic: quick off the mark, settles gently on the real number.
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return display;
}
