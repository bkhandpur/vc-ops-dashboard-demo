"use client";

import { useId } from "react";

/**
 * The brand wordmark: letters cut out of moving water.
 *
 * Built as inline SVG rather than shipping the PNG, for three reasons: the water can
 * actually move, it stays sharp at any size and in any colour mode, and there is no
 * asset to keep in sync.
 *
 * ── MATCHING THE REAL MARK ───────────────────────────────────────────────────
 * The brand asset is the word cut out of an ocean photograph: pale foam and sky fill the
 * tops of the letters, a bright crest runs through the middle, and the water deepens to
 * teal at the bottom. Three things do most of the work in reproducing that from vectors:
 *
 *   1. A vertical gradient behind everything, not a flat fill — the letters read as lit
 *      from above the way the photo does.
 *   2. Five bands rather than four, at descending lightness, with different wavelengths
 *      so the surface has chop instead of one rolling sine.
 *   3. A stroked *crest highlight* along the top edge of each band. This is the detail
 *      that sells it as water: in the photograph the breaking edge of each wave is the
 *      brightest thing in the frame, and without it the bands read as flat ribbons.
 *
 * Geometry is in viewBox units and was tuned by rendering, not guessed — charWidth 84 and
 * pad 40 keep the W and D off the edges at 96px/700 with 10 tracking.
 *
 * Motion is suppressed entirely under `prefers-reduced-motion`; the mark still renders,
 * it just holds still.
 */
export function WatershedWordmark({
  text = "WATERSHED",
  className,
  /** Height of the mark in px. Width follows from the text length. */
  height = 72,
  /** Show the deep navy plate behind the letters, as on the brand asset. */
  plate = false,
  /**
   * Splash mode: the water rises up through the letters once, on top of the usual
   * horizontal drift. Composed as two nested groups — the outer one translates on Y
   * (the rise), the inner ones on X (the drift) — because two animations cannot share a
   * single transform property.
   */
  filling = false,
  /**
   * Crest highlights and the vertical gradient. On at display sizes, off for the 20px
   * sidebar glyph where the extra strokes only muddy a mark 20 pixels tall.
   */
  detail = true,
}: {
  text?: string;
  className?: string;
  height?: number;
  plate?: boolean;
  filling?: boolean;
  detail?: boolean;
}) {
  const uid = useId().replace(/:/g, "");
  const maskId = `wm-mask-${uid}`;
  const skyId = `wm-sky-${uid}`;

  const charWidth = 84;
  const pad = 40;
  const width = text.length * charWidth + pad * 2;
  const boxHeight = 150;

  /**
   * baseY descends and amplitude shrinks with depth, so the surface reads as receding
   * toward the bottom of the letterform rather than as five equal ribbons.
   *
   * The range 0.30–0.78 is not arbitrary: at fontSize 96 centred in a 150-unit box the
   * glyphs occupy roughly y 30–120, i.e. 0.20–0.80. A band below 0.80 is drawn entirely
   * outside the letters and is simply invisible — the first version wasted its two
   * deepest bands that way, which is why the mark read as pale and washed out compared
   * to the brand asset. Every band now lands inside the glyphs, so the water genuinely
   * deepens from foam at the top to teal at the bottom.
   */
  const bands = [
    { cls: "ws-wave-1", amplitude: 11, wavelength: 320, baseY: 0.3, phase: 0 },
    { cls: "ws-wave-2", amplitude: 13, wavelength: 235, baseY: 0.42, phase: 1.1 },
    { cls: "ws-wave-3", amplitude: 10, wavelength: 168, baseY: 0.54, phase: 2.3 },
    { cls: "ws-wave-4", amplitude: 8, wavelength: 124, baseY: 0.66, phase: 0.6 },
    { cls: "ws-wave-5", amplitude: 6, wavelength: 92, baseY: 0.78, phase: 3.1 },
  ] as const;

  return (
    <svg
      viewBox={`0 0 ${width} ${boxHeight}`}
      height={height}
      width={(width / boxHeight) * height}
      className={className}
      role="img"
      aria-label={`${text} — deal intelligence`}
    >
      <defs>
        <mask id={maskId}>
          {/* In a mask, white reveals and black hides. */}
          <rect width={width} height={boxHeight} fill="black" />
          <text
            x={width / 2}
            y={boxHeight / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize={96}
            fontWeight={700}
            letterSpacing={10}
            fontFamily='system-ui, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif'
          >
            {text}
          </text>
        </mask>

        {/* Sky/foam above the waterline, brightest at the very top as in the photo. */}
        <linearGradient id={skyId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="var(--brand-foam)" />
          <stop offset="100%" stopColor="var(--brand-water-1)" />
        </linearGradient>
      </defs>

      {plate && <rect width={width} height={boxHeight} fill="var(--brand-navy)" rx={4} />}

      <g mask={`url(#${maskId})`}>
        {/* Empty letters read as pale glass before the water arrives. */}
        <rect
          width={width}
          height={boxHeight}
          fill={detail ? `url(#${skyId})` : "var(--brand-foam)"}
        />

        {/* Each path is drawn at 2x width and travels exactly half of that, so the loop
            is seamless. Varied durations and directions stop them moving as one block. */}
        <g className={filling ? "ws-water-rise" : undefined}>
          {bands.map((band) => (
            <g key={band.cls} className={`ws-wave ${band.cls}`}>
              {wavePath(width, boxHeight, band)}
              {detail && crestPath(width, band)}
            </g>
          ))}
        </g>
      </g>
    </svg>
  );
}

interface BandSpec {
  amplitude: number;
  wavelength: number;
  baseY: number;
  phase: number;
}

/** Sample the crest curve once; both the filled body and the highlight use it. */
function crestPoints(
  width: number,
  { amplitude, wavelength, baseY, phase }: BandSpec,
  height = 150,
): string {
  const totalWidth = width * 2;
  const y0 = height * baseY;
  const step = 6;

  let d = `M 0 ${y0.toFixed(2)}`;
  for (let x = step; x <= totalWidth; x += step) {
    const y = y0 + Math.sin((x / wavelength) * Math.PI * 2 + phase) * amplitude;
    d += ` L ${x} ${y.toFixed(2)}`;
  }
  return d;
}

/**
 * A filled sine crest, drawn twice as wide as the viewBox so it can slide by half its
 * width and land exactly where it started. Sampled rather than approximated with
 * beziers — at this step size the curve is smooth and the maths stays obvious.
 */
function wavePath(width: number, height: number, band: BandSpec) {
  const totalWidth = width * 2;
  // Close down the bottom so the crest is a filled body of water, not a line.
  const d = `${crestPoints(width, band, height)} L ${totalWidth} ${height} L 0 ${height} Z`;
  // The class matters: globals.css fills `.ws-wave-N .ws-band` specifically, so the
  // crest stroke beside it is never caught by the band's fill rule.
  return <path className="ws-band" d={d} />;
}

/**
 * The breaking edge of the wave. Stroked, not filled, and deliberately NOT inside the
 * `.ws-wave-N path { fill: … }` rule — it carries its own colour so it stays bright as
 * the band beneath it darkens with depth.
 */
function crestPath(width: number, band: BandSpec) {
  return (
    <path
      className="ws-crest"
      d={crestPoints(width, band)}
      fill="none"
      stroke="var(--brand-crest)"
      strokeWidth={2}
      strokeOpacity={0.55}
      strokeLinecap="round"
    />
  );
}
