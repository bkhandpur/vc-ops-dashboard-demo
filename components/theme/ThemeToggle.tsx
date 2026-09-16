"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { cx } from "../ui";
import { useTheme, type ThemePreference } from "./ThemeProvider";

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "system", label: "System", Icon: Monitor },
  { value: "dark", label: "Dark", Icon: Moon },
];

/**
 * Three states rather than a two-way flip: "system" is the default and the only option
 * that keeps following the OS, so collapsing it away would silently pin everyone to
 * whichever mode they happened to land on.
 */
export function ThemeToggle({
  compact = false,
  inverted = false,
}: {
  compact?: boolean;
  inverted?: boolean;
}) {
  const { preference, setPreference } = useTheme();

  // In the collapsed rail there is no room for three side-by-side buttons, so they
  // stack. Still all three — see the note above about not collapsing "system" away.
  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cx(
        "inline-flex items-center gap-0.5 rounded-[3px] border p-0.5",
        inverted ? "border-white/10 bg-black/10" : "border-line bg-surface-sunken",
        compact && "flex-col",
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
            className={cx(
              "grid size-6 place-items-center rounded-md transition-colors",
              active
                ? inverted
                  ? "bg-white/14 text-white"
                  : "bg-surface text-ink shadow-sm"
                : inverted
                  ? "text-white/40 hover:text-white"
                  : "text-ink-subtle hover:text-ink",
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
