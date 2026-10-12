import { statSync } from "node:fs";

interface CacheEntry {
  stamp: string;
  value: unknown;
}

const MISSING_FILE = "-";
const STAMP_SEPARATOR = "|";

const entries = new Map<string, CacheEntry>();

/** Forgets every cached value: a write of the module changed the files they were read from. */
export function markChanged(): void {
  entries.clear();
}

function fileStamp(path: string): string {
  const stats = statSync(path, { throwIfNoEntry: false, bigint: true });
  if (!stats) return `${path}:${MISSING_FILE}`;
  return `${path}:${stats.mtimeNs}:${stats.size}`;
}

/**
 * What a set of files looks like on disk (path, modification time, size):
 * a cached value read from them is stale as soon as it changes, a file edited
 * by hand included.
 */
export function filesStamp(paths: string[]): string {
  return paths.map(fileStamp).join(STAMP_SEPARATOR);
}

/**
 * The value cached under `key` while `stamp` is unchanged and no write of the
 * module happened since (see {@link markChanged}); computed and cached
 * otherwise. The value is shared: callers must not change it.
 */
export function memoize<T>(key: string, stamp: string, compute: () => T): T {
  const entry = entries.get(key);
  if (entry?.stamp === stamp) return entry.value as T;
  const value = compute();
  entries.set(key, { stamp, value });
  return value;
}
