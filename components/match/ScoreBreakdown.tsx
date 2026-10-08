"use client";

import { ThemeSwatch } from "@/components/statistics/ThemeSwatch";
import { cx } from "@/components/ui";
import type { ScoreComponent } from "@/lib/matchmaking";

/**
 * The score, showing its work.
 *
 * A partner will not act on a rank they cannot reconstruct, so every component is drawn
 * — including the ones that contributed nothing, because "no stage focus recorded" is
 * itself the useful fact about why a name sits where it does.
 *
 * ── COLOUR ───────────────────────────────────────────────────────────────────
 * These bars are MAGNITUDE, not identity, so they wear the monochrome accent, exactly
 * like the `Meter` primitive and the Data Health bars. They deliberately do NOT borrow
 * a series hue: in this app hue means `thesis_theme` and nothing else, and colouring
 * a "stage focus" bar orange would quietly assert it meant Work & Craft.
 *
 * The one place a theme colour appears here is the theme swatch beside a shared deal,
 * where it genuinely does encode the theme.
 */
export function ScoreBreakdown({
  components,
  /** Stagger index, so a list of these assembles rather than flashing in. */
  index = 0,
}: {
  components: ScoreComponent[];
  index?: number;
}) {
  const max = components.reduce((m, c) => Math.max(m, c.weight), 0);

  return (
    <div className="space-y-1.5">
      {components.map((component, i) => {
        // Width is the component's share of the widest possible component, so the bars
        // are comparable to each other rather than each filling its own row.
        const trackPct = max === 0 ? 0 : (component.weight / max) * 100;
        const fillPct = component.raw * 100;

        return (
          <div key={component.key} className="flex items-center gap-2.5">
            <span className="w-[104px] shrink-0 text-[11px] text-ink-muted">{component.label}</span>

            <span
              className="relative h-1.5 shrink-0 overflow-hidden rounded-full bg-surface-sunken"
              style={{ width: `${trackPct}%` }}
              role="img"
              aria-label={`${component.label}: ${component.points.toFixed(0)} of ${component.weight} points`}
            >
              <span
                className={cx(
                  "absolute inset-y-0 left-0 rounded-full bg-accent",
                  component.raw > 0 && "ws-bar-grow ws-stagger",
                )}
                style={
                  {
                    width: `${fillPct}%`,
                    "--i": index * 4 + i,
                  } as React.CSSProperties
                }
              />
            </span>

            <span className="ws-nums w-8 shrink-0 text-right text-[11px] tabular-nums text-ink-subtle">
              {component.points > 0 ? `+${component.points.toFixed(0)}` : "—"}
            </span>

            {component.detail && (
              <span className="min-w-0 truncate text-[11px] text-ink-subtle">
                {component.detail}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Shared-deal chips, where the theme swatch is a genuine theme encoding. */
export function SharedDeals({ deals, theme }: { deals: string[]; theme: string | null }) {
  if (deals.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-ink-subtle">Co-invested with us on</span>
      {deals.map((deal) => (
        <span
          key={deal}
          className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-sunken px-2 py-0.5 text-[11px] text-ink-muted"
        >
          {theme && <ThemeSwatch theme={theme} />}
          {deal}
        </span>
      ))}
    </div>
  );
}
