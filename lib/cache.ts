import "server-only";
import { demoSession } from "./demo-session";
export type CacheBackend = "request";
export function cacheBackend(): CacheBackend {
  return "request";
}
export function isDurableCache(): boolean {
  return false;
}
export async function cacheGet<T>(key: string): Promise<T | null> {
  const session = demoSession();
  return (session.cache.get(key) ?? session.digests[key] ?? null) as T | null;
}
export async function cacheSet(key: string, value: unknown): Promise<void> {
  demoSession().cache.set(key, value);
}
export async function cacheDel(key: string): Promise<void> {
  demoSession().cache.delete(key);
}
export interface Cached<T> {
  data: T;
  generatedAt: string;
}
export function envelope<T>(data: T): Cached<T> {
  return { data, generatedAt: new Date().toISOString() };
}
