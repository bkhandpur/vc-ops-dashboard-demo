/** Build a human-triggered summary from the stored digest. No external model is called. */

import { guarded } from "@/app/api/_lib/route-helpers";
import { getDigest, saveDigest, type Digest } from "@/lib/digest";

/**
 * Compose the summary deterministically from the digest's own numbers.
 *
 * It uses only stored values and skips empty sections.
 */
function cannedSummary(digest: Digest): string {
  const parts: string[] = [];
  const { pipeline, portfolio, archive } = digest.totals;

  parts.push(
    `${digest.periodLabel}. The book stands at ${pipeline} on Pipeline, ` +
      `${portfolio} in Portfolio and ${archive} archived.`,
  );

  if (digest.newInPipeline.length > 0) {
    const themes = new Map<string, number>();
    for (const c of digest.newInPipeline) themes.set(c.theme, (themes.get(c.theme) ?? 0) + 1);
    const spread = [...themes.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([theme, n]) => `${n} in ${theme}`)
      .join(", ");
    parts.push(
      `${digest.newInPipeline.length} ${digest.newInPipeline.length === 1 ? "company" : "companies"} ` +
        `joined the Pipeline this period. ${spread}. ` +
        `The largest addition by name is ${digest.newInPipeline[0]?.name ?? "unnamed"}.`,
    );
  }

  if (digest.stageMoves.length > 0) {
    parts.push(
      `${digest.stageMoves.length} ${digest.stageMoves.length === 1 ? "record" : "records"} moved ` +
        `between lists. Movements are list-membership changes, not stage transitions inside ` +
        `the Pipeline. The demo data has no passed-at-stage event, so a funnel ` +
        `rate is not recoverable from this.`,
    );
  }

  if (digest.newStealthFounders.length > 0) {
    parts.push(
      `${digest.newStealthFounders.length} new stealth ` +
        `${digest.newStealthFounders.length === 1 ? "founder was" : "founders were"} added. ` +
        `None has been contacted; the outreach queue is where that gets acted on.`,
    );
  }

  if (digest.newNotes.length > 0) {
    parts.push(`${digest.newNotes.length} new notes were logged against company records.`);
  }

  const shifts = [...digest.themeShifts, ...digest.sectorShifts].filter((s) => s.delta !== 0);
  if (shifts.length > 0) {
    const biggest = shifts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]!;
    parts.push(
      `The largest mix shift is ${biggest.label}, ${biggest.previous} → ${biggest.current} ` +
        `(${biggest.delta > 0 ? "+" : ""}${biggest.delta}).`,
    );
  } else {
    parts.push("Portfolio theme and sector mix are unchanged.");
  }

  parts.push(
    "This summary was composed locally from the numbers above.",
  );

  return parts.join("\n\n");
}

export function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return guarded(async () => {
    const { id } = await context.params;

    const digest = await getDigest(id);
    if (!digest) throw new Error(`No digest found with id ${id}`);

    const updated: Digest = {
      ...digest,
      summary: cannedSummary(digest),
      summaryGeneratedAt: new Date().toISOString(),
      summaryGeneratedBy: "demo (no model called)",
    };
    await saveDigest(updated);

    return { summary: updated.summary, summaryGeneratedAt: updated.summaryGeneratedAt };
  });
}
