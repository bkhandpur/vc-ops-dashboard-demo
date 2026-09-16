/**
 * The write overlay for the demo build.
 *
 * Store confirmed demo actions locally so write flows can be exercised safely.
 *
 * A public demo obviously cannot write to anyone's CRM. But deleting the write actions
 * would delete the most interesting UX in the app — the confirm-before-write dialog is
 * a deliberate architectural position, not a formality — so instead the writes land
 * here: an in-process overlay applied on top of the immutable seed on every read.
 *
 * Consequences, stated rather than hidden:
 *   - Writes are visible immediately, across every page, because every read applies the
 *     overlay.
 *   - Writes do NOT persist. The overlay lives in the process, so a redeploy, a cold
 *     start, or a second serverless instance will not have them. The UI says so in the
 *     confirm copy and again after the write lands. This mirrors the real build's
 *     honesty about its own cache: when no durable backend was configured it fell back
 *     to memory and warned in the UI rather than pretending to be durable.
 *   - The seed JSON is never mutated. Nothing in this repository writes to disk.
 */

import "server-only";

import type { CrmListEntry, CrmNote, CrmRecord } from "./crm";
import type { ParentObject } from "./constants";

interface Overlay {
  /** Records created by an upsert, keyed by record id. */
  newRecords: { companies: CrmRecord[]; people: CrmRecord[] };
  /** Field patches applied to existing records: object → recordId → slug → raw values. */
  patches: {
    companies: Map<string, Record<string, unknown[]>>;
    people: Map<string, Record<string, unknown[]>>;
  };
  /** Entries added to a list, keyed by list slug. */
  newEntries: Map<string, CrmListEntry[]>;
  newNotes: CrmNote[];
  /** An append-only log, surfaced in the UI so a visitor can see what they changed. */
  log: DemoWrite[];
  seq: number;
}

export interface DemoWrite {
  at: string;
  action: string;
  detail: string;
}

/**
 * Held on `globalThis` rather than in a module-level `const`, because Next's dev server
 * re-evaluates modules on hot reload and a plain const would silently reset mid-session
 * — which looks exactly like "the write did not work".
 */
const globalStore = globalThis as unknown as { __demoOverlay?: Overlay };

function overlay(): Overlay {
  if (!globalStore.__demoOverlay) {
    globalStore.__demoOverlay = {
      newRecords: { companies: [], people: [] },
      patches: { companies: new Map(), people: new Map() },
      newEntries: new Map(),
      newNotes: [],
      log: [],
      seq: 0,
    };
  }
  return globalStore.__demoOverlay;
}

export function demoWriteLog(): DemoWrite[] {
  return [...overlay().log].reverse();
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Wrap a plain value in the timestamped array shape the readers expect, so an
 * overlay-written value is indistinguishable from a seeded one to everything upstream.
 * If the write path produced a different shape, every reader would need a special case.
 */
function wrap(slug: string, value: unknown): unknown[] {
  const stamp = { active_from: now(), active_until: null };
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "object" && item !== null ? { ...stamp, ...item } : { ...stamp, option: { title: item } },
    );
  }
  if (typeof value === "boolean" || typeof value === "number") return [{ ...stamp, value }];
  if (slug.endsWith("_usd") || slug.endsWith("_eur")) {
    return [{ ...stamp, currency_value: value, currency_code: "USD" }];
  }
  return [{ ...stamp, value }];
}

// ---------------------------------------------------------------------------
// Applied on every read
// ---------------------------------------------------------------------------

export const applyOverlay = {
  records(object: ParentObject, base: CrmRecord[]): CrmRecord[] {
    const o = overlay();
    const patches = o.patches[object];
    const created = o.newRecords[object];
    if (patches.size === 0 && created.length === 0) return base;

    const patched = base.map((record) => {
      const patch = patches.get(record.id.record_id);
      if (!patch) return record;
      return {
        ...record,
        values: { ...record.values, ...(patch as CrmRecord["values"]) },
      };
    });
    return [...created, ...patched];
  },

  entries(listSlug: string, base: CrmListEntry[]): CrmListEntry[] {
    const added = overlay().newEntries.get(listSlug);
    return added && added.length > 0 ? [...added, ...base] : base;
  },

  notes(base: CrmNote[]): CrmNote[] {
    const added = overlay().newNotes;
    return added.length > 0 ? [...added, ...base] : base;
  },
};

// ---------------------------------------------------------------------------
// Applied by the write functions in lib/crm.ts
// ---------------------------------------------------------------------------

export const recordWrite = {
  /**
   * Upsert on a matching attribute. Matches an existing record by that attribute's
   * value before creating, which is what makes the "add to Pipeline" action safe to
   * click twice.
   */
  upsertRecord(
    object: ParentObject,
    matchingSlug: string,
    matchingValue: string,
    values: Record<string, unknown>,
  ): CrmRecord {
    const o = overlay();
    const existing = o.newRecords[object].find((r) => {
      const raw = r.values[matchingSlug]?.[0];
      const candidate = raw?.["domain"] ?? raw?.["value"];
      return candidate === matchingValue;
    });

    const wrapped: Record<string, unknown[]> = {};
    for (const [slug, value] of Object.entries(values)) wrapped[slug] = wrap(slug, value);

    if (existing) {
      Object.assign(existing.values, wrapped);
      o.log.push({ at: now(), action: "update", detail: `${object} ${matchingValue}` });
      return existing;
    }

    o.seq += 1;
    const record: CrmRecord = {
      id: { record_id: `demo_${object === "companies" ? "cmp" : "per"}_${o.seq}` },
      created_at: now(),
      values: wrapped as CrmRecord["values"],
    };
    o.newRecords[object].push(record);
    o.log.push({ at: now(), action: "create", detail: `${object} ${matchingValue}` });
    return record;
  },

  /**
   * Merge exactly the attributes given, leaving everything else alone.
   *
   * This is the PATCH-not-PUT rule made concrete: a PUT would replace the record's
   * whole values payload, so a write that meant to set one checkbox would wipe every
   * field nobody mentioned.
   */
  patchRecord(
    object: ParentObject,
    recordId: string,
    values: Record<string, unknown>,
    /**
     * The record as it currently stands.
     *
     * Required, because the caller returns whatever comes back from here straight to the
     * UI. Without it this function had nothing but the patch itself to build a response
     * from, so a write that set one checkbox returned a record with a null name — and the
     * success message read "marked this person as contacted" instead of naming them.
     * The stored state was correct; only the echo was wrong, which is the kind of bug
     * that survives a long time because nothing is actually broken.
     */
    base: CrmRecord,
  ): CrmRecord {
    const o = overlay();
    const existingPatch = o.patches[object].get(recordId) ?? {};
    for (const [slug, value] of Object.entries(values)) {
      existingPatch[slug] = wrap(slug, value);
    }
    o.patches[object].set(recordId, existingPatch);
    o.log.push({
      at: now(),
      action: "patch",
      detail: `${recordId} ← ${Object.keys(values).join(", ")}`,
    });

    return { ...base, values: { ...base.values, ...(existingPatch as CrmRecord["values"]) } };
  },

  addEntry(
    listSlug: string,
    recordId: string,
    entryValues: Record<string, unknown>,
  ): CrmListEntry {
    const o = overlay();
    o.seq += 1;
    const wrapped: Record<string, unknown[]> = {};
    for (const [slug, value] of Object.entries(entryValues)) wrapped[slug] = wrap(slug, value);
    const entry: CrmListEntry = {
      id: { entry_id: `demo_ent_${o.seq}` },
      parent_record_id: recordId,
      created_at: now(),
      entry_values: wrapped as CrmListEntry["entry_values"],
    };
    const list = o.newEntries.get(listSlug) ?? [];
    list.push(entry);
    o.newEntries.set(listSlug, list);
    o.log.push({ at: now(), action: "add to list", detail: `${recordId} → ${listSlug}` });
    return entry;
  },

  addNote(input: {
    parentObject: ParentObject;
    recordId: string;
    title: string;
    content: string;
  }): CrmNote {
    const o = overlay();
    o.seq += 1;
    const note: CrmNote = {
      id: { note_id: `demo_note_${o.seq}` },
      parent_object: input.parentObject,
      parent_record_id: input.recordId,
      title: input.title,
      content_plaintext: input.content,
      created_at: now(),
    };
    o.newNotes.push(note);
    o.log.push({ at: now(), action: "note", detail: `${input.recordId}: ${input.title}` });
    return note;
  },
};
