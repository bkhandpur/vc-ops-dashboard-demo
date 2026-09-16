"use client";

import { WatershedWordmark } from "./WatershedWordmark";

/**
 * The entry hero: the brand mark at full size over a lit navy plate.
 *
 * In the internal build this was the sign-in screen — the one place in the app allowed
 * to be cinematic, because the user is waiting on an OAuth round trip anyway. This build
 * has no sign-in, so the same choreography runs once as an entry splash and then
 * dissolves into the dashboard (see EntrySplash.tsx).
 *
 * The choreography is **pure CSS keyed off class names**: no timers, no animation
 * library, no state machine. The whole hero ships with no JavaScript beyond React's own
 * hydration. The only reason it is a client component at all is that the wordmark uses
 * `useId` for its SVG mask.
 *
 * Sizing is viewport-relative (`clamp`) rather than a fixed pixel height. The mark is
 * the whole screen here, and a fixed size would either overflow a laptop or look
 * apologetic on a 27" display.
 */
export function EntryHero() {
  return (
    <div className="relative flex w-full max-w-6xl flex-col items-center">
      <div className="ws-hero-mark w-full">
        <WatershedWordmark
          height={300}
          className="mx-auto h-auto w-full max-w-6xl"
          detail
          filling
        />
      </div>

      {/* The waterline: the signature motif, drawn once under the mark. */}
      <span
        aria-hidden
        className="ws-hero-line mt-1 block h-px w-full max-w-3xl"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--brand-water-2) 35%, var(--brand-crest) 50%, var(--brand-water-2) 65%, transparent 100%)",
        }}
      />

      <div className="mt-9 px-6 text-center">
        <p
          className="ws-hero-slogan text-[clamp(15px,2vw,20px)] font-medium text-white/90"
          style={{ animationDelay: "1450ms" }}
        >
          Venture operations dashboard
        </p>
      </div>
    </div>
  );
}

/**
 * The lit navy plate behind the hero.
 *
 * Separated from the hero so it can cover the full viewport while the hero stays a
 * centred column. Two drifting radial pools read as sunlight through water; a vignette
 * keeps the edges dark so the mark holds the centre.
 *
 * `pointer-events-none` throughout — this is scenery, and it must never intercept a
 * click meant for anything underneath it.
 */
export function EntryBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, var(--brand-navy-lift) 0%, var(--brand-navy) 45%, var(--brand-navy-deep) 100%)",
        }}
      />

      {/* Caustics. Blur is applied via a large radial falloff rather than a CSS filter:
          filter: blur() on a full-screen layer forces a repaint every frame, and this
          animation runs for as long as the splash is on screen. */}
      <div
        className="ws-caustic absolute inset-[-20%]"
        style={{
          background:
            "radial-gradient(42% 38% at 32% 34%, rgba(160,220,245,0.16) 0%, transparent 70%), " +
            "radial-gradient(38% 34% at 68% 62%, rgba(110,190,225,0.13) 0%, transparent 72%)",
        }}
      />

      {/* Vignette — darkens the corners so the wordmark reads as lit from within. */}
      <div
        className="ws-hero-veil absolute inset-0"
        style={{
          background:
            "radial-gradient(78% 70% at 50% 44%, transparent 0%, rgba(6,12,22,0.42) 100%)",
        }}
      />
    </div>
  );
}
