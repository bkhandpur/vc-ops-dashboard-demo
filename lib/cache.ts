/**
 * Tiny KV abstraction with two backends, picked automatically:
 *
 *   "file"   — a JSON file under .demo-writes/, used when the filesystem is writable.
 *              Survives a dev-server restart, so you do not lose the snapshot and have
 *              to rebuild it after every edit.
 *   "memory" — a process-local Map. Used on serverless, where the filesystem is
 *              read-only. Resets on every cold start, and the UI says so rather than
 *              implying the snapshot is durable.
 *
 * The public demo does not require a hosted cache service, and the
 * honesty about the remaining tiers matters more, not less.
 *
 * The reason the file backend exists at all is worth recording: before it, every
 * dev-server restart wiped the snapshot and you had to re-run the digest job before any
 * page would render. Bad for development and much worse for demoing.
 */

import "server-only";

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

type Json = unknown;

export type CacheBackend = "file" | "memory";

interface KvLike {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: Json): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

/** Serverless filesystems are read-only apart from /tmp, so no file backend there. */
function canUseFiles(): boolean {
  return !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME;
}

export function cacheBackend(): CacheBackend {
  return canUseFiles() ? "file" : "memory";
}

/** True only for a backend that survives a restart in the environment it runs in. */
export function isDurableCache(): boolean {
  return cacheBackend() !== "memory";
}

// ---------------------------------------------------------------------------
// memory
// ---------------------------------------------------------------------------

const globalMemory = globalThis as unknown as { __demoCache?: Map<string, string> };
globalMemory.__demoCache ??= new Map<string, string>();
const memory = globalMemory.__demoCache;

const memoryKv: KvLike = {
  async get<T>(key: string) {
    const raw = memory.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as T);
  },
  async set(key: string, value: Json) {
    memory.set(key, JSON.stringify(value));
    return "OK";
  },
  async del(key: string) {
    memory.delete(key);
    return 1;
  },
};

// ---------------------------------------------------------------------------
// file (local dev)
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), ".demo-writes");
const DATA_FILE = path.join(DATA_DIR, "cache.json");

/**
 * Read-through cache of the file's contents. The dataset is a few hundred companies
 * plus some digests, so whole-file reads and writes are simpler than any indexed format
 * and fast enough.
 */
let fileState: Record<string, Json> | null = null;

function readFileState(): Record<string, Json> {
  if (fileState) return fileState;
  try {
    fileState = existsSync(DATA_FILE)
      ? (JSON.parse(readFileSync(DATA_FILE, "utf8")) as Record<string, Json>)
      : {};
  } catch (err) {
    console.error("[cache] could not read the local cache file, starting empty", err);
    fileState = {};
  }
  return fileState;
}

function writeFileState(state: Record<string, Json>): void {
  fileState = state;
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    // Temp file then rename, so a crash mid-write cannot truncate the cache.
    const tmp = `${DATA_FILE}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(state), "utf8");
    renameSync(tmp, DATA_FILE);
  } catch (err) {
    console.error("[cache] could not write the local cache file", err);
  }
}

const fileKv: KvLike = {
  async get<T>(key: string) {
    const value = readFileState()[key];
    return value === undefined ? null : (value as T);
  },
  async set(key: string, value: Json) {
    writeFileState({ ...readFileState(), [key]: value });
    return "OK";
  },
  async del(key: string) {
    const next = { ...readFileState() };
    delete next[key];
    writeFileState(next);
    return 1;
  },
};

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

function client(): KvLike {
  return canUseFiles() ? fileKv : memoryKv;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    return await client().get<T>(key);
  } catch (err) {
    console.error(`[cache] get ${key} failed`, err);
    return null;
  }
}

export async function cacheSet(key: string, value: Json): Promise<void> {
  try {
    await client().set(key, value);
  } catch (err) {
    console.error(`[cache] set ${key} failed`, err);
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await client().del(key);
  } catch (err) {
    console.error(`[cache] del ${key} failed`, err);
  }
}

/** Envelope so every cached payload carries its own freshness metadata. */
export interface Cached<T> {
  data: T;
  generatedAt: string;
}

export function envelope<T>(data: T): Cached<T> {
  return { data, generatedAt: new Date().toISOString() };
}
