/**
 * Generate deterministic abstract marks for synthetic company and person records.
 */

const PALETTE = [
  ["#2a78d6", "#5b97df"],
  ["#eb6834", "#f3a181"],
  ["#1baf7a", "#5fc7a2"],
  ["#4a3aa7", "#8478c6"],
  ["#0f766e", "#2dd4bf"],
  ["#b45309", "#f59e0b"],
] as const;

/** FNV-1a. Small, stable, and not trying to be a cryptographic hash. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const key = id.replace(/\.svg$/i, "");
  const h = hash(key);

  const [dark, light] = PALETTE[h % PALETTE.length]!;
  // Four mark shapes, so a wall of tiles has visible variety without needing more hues.
  const shape = (h >> 8) % 4;
  const rotation = ((h >> 12) % 4) * 90;

  const marks = [
    `<circle cx="32" cy="32" r="15" fill="${light}"/><circle cx="32" cy="32" r="7" fill="${dark}"/>`,
    `<path d="M16 48 L32 16 L48 48 Z" fill="${light}"/><path d="M24 48 L32 32 L40 48 Z" fill="${dark}"/>`,
    `<rect x="17" y="17" width="30" height="30" rx="6" fill="${light}"/><rect x="17" y="17" width="15" height="15" rx="6" fill="${dark}"/>`,
    `<path d="M18 32 A14 14 0 0 1 46 32 Z" fill="${light}"/><path d="M18 32 A14 14 0 0 0 46 32 Z" fill="${dark}"/>`,
  ];

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img">` +
    `<rect width="64" height="64" rx="14" fill="${dark}" fill-opacity="0.10"/>` +
    `<g transform="rotate(${rotation} 32 32)">${marks[shape]}</g>` +
    `</svg>`;

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      // Immutable: the mark is a pure function of the id, so it can never change.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
