"use client";

import { useState } from "react";

import { fillFor, inkOn } from "./statistics/colors";
import { useColorMode } from "./theme/ThemeProvider";
import { cx } from "./ui";

/**
 * Render a local synthetic logo when available and a theme-tinted monogram otherwise.
 * `NEXT_PUBLIC_DISABLE_REMOTE_LOGOS=1` forces the fallback state.
 */
export function CompanyAvatar({
  name,
  logoUrl,
  size = 20,
  className,
  theme,
}: {
  name: string | null;
  logoUrl?: string | null;
  size?: number;
  className?: string;
  /**
   * The company's theme. When supplied, the monogram fallback is tinted with that theme's
   * validated hue instead of neutral grey, so a logo-less tile still carries the same
   * identity colour as its row in every chart. Omit it (people, unclassified companies)
   * and the monogram stays neutral — the reserved neutral is never a theme identity.
   */
  theme?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const mode = useColorMode();
  const remoteAllowed = process.env.NEXT_PUBLIC_DISABLE_REMOTE_LOGOS !== "1";
  const showImage = remoteAllowed && Boolean(logoUrl) && !failed;

  const label = name?.trim() || "?";

  // Theme fill + inkOn() is exactly what the charts do: inkOn measures the fill's own
  // luminance and picks white or near-black, so contrast holds in both colour modes
  // without a second palette. No new colour is introduced.
  const themeFill = !showImage && theme ? fillFor(theme, 0, mode) : null;

  return (
    <span
      className={cx(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded",
        showImage ? "bg-surface" : !themeFill && "bg-surface-sunken",
        className,
      )}
      style={{
        width: size,
        height: size,
        ...(themeFill ? { backgroundColor: themeFill } : {}),
      }}
      aria-hidden
      title={name ?? undefined}
    >
      {showImage ? (
        // The generated marks are local SVGs and do not need image optimization.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl!}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="size-full object-contain"
        />
      ) : (
        <span
          className={cx("font-medium", !themeFill && "text-ink-muted")}
          style={{
            fontSize: Math.max(9, Math.round(size * 0.44)),
            ...(themeFill ? { color: inkOn(themeFill) } : {}),
          }}
        >
          {monogram(label)}
        </span>
      )}
    </span>
  );
}

/**
 * Up to two initials from the first two meaningful words. Leading articles and legal
 * suffixes would make half the book read "TH" or "IN", so they are skipped.
 */
const SKIP_WORDS = new Set(["the", "a", "an", "of", "and", "inc", "inc.", "llc", "ltd", "co"]);

function monogram(name: string): string {
  const words = name
    .split(/[\s\-_/]+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((w) => w.length > 0 && !SKIP_WORDS.has(w.toLowerCase()));

  if (words.length === 0) return name.slice(0, 1).toUpperCase();
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}
