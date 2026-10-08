/** Deterministic sample diffs. Summaries run only on an explicit browser action. */

import "server-only";
import { demoSession } from "./demo-session";

import { getCompaniesInList, getPeopleInList, listNotes } from "./crm";
import { cacheGet, cacheSet, type Cached } from "./cache";
import { CACHE_KEYS, STAGE_LISTS, UNCLASSIFIED, type StageKey } from "./constants";
import { computeHealth } from "./health";
import type { StatsSnapshot } from "./stats";

// ---------------------------------------------------------------------------
// Snapshot — the state we compare against next week
// ---------------------------------------------------------------------------

export interface CompanyStub {
  recordId: string;
  name: string | null;
  theme: string;
  canonicalSector: string;
  /** enrichment-populated logo, so digest rows can carry a company mark. */
  logoUrl: string | null;
}

export interface DigestSnapshot {
  takenAt: string;
  /** recordId → stub, per stage list. */
  stages: Record<StageKey, Record<string, CompanyStub>>;
  stealthFounders: Record<string, { recordId: string; name: string | null }>;
  /** Note ids we have already reported, so a note is only "new" once. */
  noteIds: string[];
  /** Portfolio mix, for "notable theme/sector shifts". */
  portfolioThemeMix: Record<string, number>;
  portfolioSectorMix: Record<string, number>;
}

export async function takeSnapshot(): Promise<DigestSnapshot> {
  const [pipeline, portfolio, archive, founders, notes] = await Promise.all([
    getCompaniesInList("pipeline"),
    getCompaniesInList("portfolio"),
    getCompaniesInList("archive"),
    getPeopleInList("stealthFounders"),
    listNotes(500),
  ]);

  const stub = (list: Awaited<ReturnType<typeof getCompaniesInList>>) =>
    Object.fromEntries(
      list.map((c) => [
        c.recordId,
        {
          recordId: c.recordId,
          name: c.name,
          theme: c.theme ?? UNCLASSIFIED,
          canonicalSector: c.canonicalSector ?? UNCLASSIFIED,
          logoUrl: c.logoUrl,
        },
      ]),
    );

  const tally = (values: string[]): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const v of values) out[v] = (out[v] ?? 0) + 1;
    return out;
  };

  return {
    takenAt: new Date().toISOString(),
    stages: { pipeline: stub(pipeline), portfolio: stub(portfolio), archive: stub(archive) },
    stealthFounders: Object.fromEntries(
      founders.map((p) => [p.recordId, { recordId: p.recordId, name: p.name }]),
    ),
    noteIds: notes.map((n) => n.id.note_id),
    portfolioThemeMix: tally(portfolio.map((c) => c.theme ?? UNCLASSIFIED)),
    portfolioSectorMix: tally(portfolio.map((c) => c.canonicalSector ?? UNCLASSIFIED)),
  };
}

// ---------------------------------------------------------------------------
// Digest record
// ---------------------------------------------------------------------------

export interface StageMove {
  recordId: string;
  name: string | null;
  from: StageKey | null;
  to: StageKey | null;
}

export interface MixShift {
  label: string;
  previous: number;
  current: number;
  delta: number;
}

export interface NoteStub {
  noteId: string;
  title: string;
  parentObject: string;
  parentRecordId: string;
  createdAt: string;
}

/**
 * Absolute state at the moment a digest ran — the raw material for the Trends view.
 *
 * The digest record already stored `totals` and the week-over-week *shifts*, but a shift
 * is a delta: you cannot reconstruct an absolute theme mix from a series of deltas
 * without a starting point, and the baseline digest has no shifts at all. So each digest
 * now carries its own absolute snapshot summary. This is deliberately computed from data
 * the job has already fetched, without another CRM call or processing pipeline.
 *
 * `metrics` is optional because digests written before this existed do not have it.
 * The Trends view skips those points rather than inventing values for them.
 */
export interface DigestMetrics {
  totals: Record<StageKey, number>;
  /** Distinct company counts by theme, per stage. Theme is single-select, so these sum. */
  themeMix: Record<StageKey, Record<string, number>>;
  /** Canonical-sector completeness per stage — "is our data quality improving?". */
  sectorCoverage: Record<StageKey, { covered: number; total: number }>;
  /**
   * Overall Data Health completeness from 0 to 100 over Pipeline and Portfolio.
   * Archive is excluded so its larger generated list does not dominate the result.
   *
   * Optional because it is computed from the cached stats snapshot, which may not exist
   * on a very first run. Absent is recorded as absent — never as 0, which would draw a
   * cliff that never happened (the same rule lib/trends.ts already enforces).
   */
  healthPct?: number;
}

/**
 * Read the completeness figure from the cached stats snapshot.
 *
 * Deliberately reuses `computeHealth` and its HEALTH_CHECKS rather than re-implementing
 * the checks here. A second definition of "complete" would drift from the Data Health
 * page within one session, and then the chart and the page it links to would disagree.
 *
 * Returns undefined rather than 0 when there is no snapshot to read.
 */
async function readHealthPct(): Promise<number | undefined> {
  const cached = await cacheGet<Cached<StatsSnapshot>>(CACHE_KEYS.stats);
  if (!cached) return undefined;
  const health = computeHealth(cached.data.companies, ["pipeline", "portfolio"]);
  return health.overallCoveragePct;
}

function computeMetrics(snapshot: DigestSnapshot): DigestMetrics {
  const themeMix = {} as Record<StageKey, Record<string, number>>;
  const sectorCoverage = {} as Record<StageKey, { covered: number; total: number }>;

  for (const stage of STAGE_LISTS) {
    const stubs = Object.values(snapshot.stages[stage]);
    const mix: Record<string, number> = {};
    let covered = 0;
    for (const stub of stubs) {
      mix[stub.theme] = (mix[stub.theme] ?? 0) + 1;
      if (stub.canonicalSector !== UNCLASSIFIED) covered += 1;
    }
    themeMix[stage] = mix;
    sectorCoverage[stage] = { covered, total: stubs.length };
  }

  return {
    totals: {
      pipeline: Object.keys(snapshot.stages.pipeline).length,
      portfolio: Object.keys(snapshot.stages.portfolio).length,
      archive: Object.keys(snapshot.stages.archive).length,
    },
    themeMix,
    sectorCoverage,
  };
}

export interface Digest {
  id: string;
  generatedAt: string;
  /** null on the very first run — nothing to diff against yet. */
  comparedTo: string | null;
  periodLabel: string;
  newInPipeline: CompanyStub[];
  stageMoves: StageMove[];
  newStealthFounders: { recordId: string; name: string | null }[];
  newNotes: NoteStub[];
  themeShifts: MixShift[];
  sectorShifts: MixShift[];
  totals: Record<StageKey, number>;
  /** Absolute state at this point in time. */
  metrics?: DigestMetrics;
  /** Prose written by the manual "Generate summary" button. null until clicked. */
  summary: string | null;
  summaryGeneratedAt: string | null;
  summaryGeneratedBy: string | null;
}

function stageOf(snapshot: DigestSnapshot, recordId: string): StageKey | null {
  for (const stage of STAGE_LISTS) {
    if (snapshot.stages[stage][recordId]) return stage;
  }
  return null;
}

function diffMix(previous: Record<string, number>, current: Record<string, number>): MixShift[] {
  const labels = new Set([...Object.keys(previous), ...Object.keys(current)]);
  return [...labels]
    .map((label) => {
      const before = previous[label] ?? 0;
      const after = current[label] ?? 0;
      return { label, previous: before, current: after, delta: after - before };
    })
    .filter((s) => s.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function periodLabel(from: string | null, to: string): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  return from ? `${fmt(from)} → ${fmt(to)}` : `Baseline as of ${fmt(to)}`;
}

/**
 * Pure function: previous snapshot + current snapshot to digest. No I/O.
 *
 * `healthPct` is passed in rather than read here so this stays pure and testable — the
 * I/O to fetch it lives in `runDigestJob()`.
 */
export function buildDigest(
  previous: DigestSnapshot | null,
  current: DigestSnapshot,
  notes: NoteStub[],
  healthPct?: number,
): Digest {
  const knownNoteIds = new Set(previous?.noteIds ?? []);

  const newInPipeline = Object.values(current.stages.pipeline).filter(
    (c) => !previous || !previous.stages.pipeline[c.recordId],
  );

  const stageMoves: StageMove[] = [];
  if (previous) {
    const allIds = new Set([
      ...STAGE_LISTS.flatMap((s) => Object.keys(previous.stages[s])),
      ...STAGE_LISTS.flatMap((s) => Object.keys(current.stages[s])),
    ]);
    for (const recordId of allIds) {
      const from = stageOf(previous, recordId);
      const to = stageOf(current, recordId);
      if (from === to) continue;
      // A brand-new pipeline entry is reported under newInPipeline, not as a move.
      if (from === null && to === "pipeline") continue;
      const stub =
        (to && current.stages[to][recordId]) || (from && previous.stages[from][recordId]) || null;
      stageMoves.push({ recordId, name: stub?.name ?? null, from, to });
    }
  }

  const newStealthFounders = Object.values(current.stealthFounders).filter(
    (p) => !previous || !previous.stealthFounders[p.recordId],
  );

  const newNotes = previous ? notes.filter((n) => !knownNoteIds.has(n.noteId)) : [];

  return {
    id: current.takenAt,
    generatedAt: current.takenAt,
    comparedTo: previous?.takenAt ?? null,
    periodLabel: periodLabel(previous?.takenAt ?? null, current.takenAt),
    newInPipeline,
    stageMoves,
    newStealthFounders,
    newNotes,
    themeShifts: previous ? diffMix(previous.portfolioThemeMix, current.portfolioThemeMix) : [],
    sectorShifts: previous ? diffMix(previous.portfolioSectorMix, current.portfolioSectorMix) : [],
    totals: {
      pipeline: Object.keys(current.stages.pipeline).length,
      portfolio: Object.keys(current.stages.portfolio).length,
      archive: Object.keys(current.stages.archive).length,
    },
    metrics: { ...computeMetrics(current), healthPct },
    summary: null,
    summaryGeneratedAt: null,
    summaryGeneratedBy: null,
  };
}

// ---------------------------------------------------------------------------
// Storage (KV). Digest index holds ids newest-first.
// ---------------------------------------------------------------------------

const MAX_DIGESTS = 104; // ~2 years of weeklies

export async function listDigests(): Promise<Digest[]> {
  const ids = (await cacheGet<string[]>(CACHE_KEYS.digestIndex)) ?? [];
  const digests = await Promise.all(ids.map((id) => cacheGet<Digest>(CACHE_KEYS.digest(id))));
  return digests.filter((d): d is Digest => d !== null);
}

export async function getDigest(id: string): Promise<Digest | null> {
  const { ensureDigestHistory } = await import("./digest-history");
  await ensureDigestHistory();
  return cacheGet<Digest>(CACHE_KEYS.digest(id));
}

export async function saveDigest(digest: Digest, persist = true): Promise<void> {
  if (persist) {
    const session = demoSession();
    // Keep only recent manual results, without an unbounded shared write index.
    session.digests[CACHE_KEYS.digest(digest.id)] = digest;
    const keys = Object.keys(session.digests);
    for (const key of keys.slice(0, Math.max(0, keys.length - 3))) delete session.digests[key];
    session.dirty = true;
  }
  await cacheSet(CACHE_KEYS.digest(digest.id), digest);
  const ids = (await cacheGet<string[]>(CACHE_KEYS.digestIndex)) ?? [];
  const next = [digest.id, ...ids.filter((i) => i !== digest.id)].slice(0, MAX_DIGESTS);
  await cacheSet(CACHE_KEYS.digestIndex, next);
}

/**
 * The whole cron job. Deterministic: snapshot → diff → store. Nothing else.
 * Safe to run manually (there is a "Run diff now" button on /digest).
 *
 * Callers run `refreshAllSnapshots()` first so the digest records current cached stats.
 */
export async function runDigestJob(): Promise<Digest> {
  // Compare visitor edits with the immutable seed, rather than claiming an observed history.
  const session = demoSession();
  const savedOverlay = session.overlay;
  session.overlay = null;
  session.cache.clear();
  const previous = await takeSnapshot();
  session.overlay = savedOverlay;
  session.cache.clear();
  await import("./refresh").then((m) => m.refreshAllSnapshots());
  const current = await takeSnapshot();

  const rawNotes = await listNotes(500);
  const notes: NoteStub[] = rawNotes.map((n) => ({
    noteId: n.id.note_id,
    title: n.title,
    parentObject: n.parent_object,
    parentRecordId: n.parent_record_id,
    createdAt: n.created_at,
  }));

  const healthPct = await readHealthPct();

  const digest = buildDigest(previous, current, notes, healthPct);
  await saveDigest(digest);
  await cacheSet(CACHE_KEYS.snapshot, current);
  return digest;
}
