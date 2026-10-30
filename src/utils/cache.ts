import { statSync } from "node:fs";

interface CacheEntry<T> {
  stamp: string;
  value: T;
}

const MISSING_FILE = "-";
const STAMP_SEPARATOR = "|";

const writes = new Map<string, number>();

/**
 * Counts a write of the module to a file: the values read from it are stale
 * even when the file system keeps its modification time (two writes within
 * its precision).
 */
export function markWritten(path: string): void {
  writes.set(path, (writes.get(path) ?? 0) + 1);
}

function fileStamp(path: string): string {
  const written = writes.get(path) ?? 0;
  const stats = statSync(path, { throwIfNoEntry: false, bigint: true });
  if (!stats) return `${path}:${MISSING_FILE}:${written}`;
  return `${path}:${stats.mtimeNs}:${stats.size}:${written}`;
}

/**
 * What a set of files looks like (path, modification time, size, writes of
 * the module): a cached value read from them is stale as soon as one of them
 * changes, a file edited by hand included.
 */
export function filesStamp(paths: string[]): string {
  return paths.map(fileStamp).join(STAMP_SEPARATOR);
}

/**
 * A cache of values of one type: `memo(key, stamp, compute)` answers the
 * value cached under `key` while `stamp` (see {@link filesStamp}) is
 * unchanged; computed and cached otherwise. The value is shared: callers
 * must not change it.
 */
export function createMemo<T>(): (
  key: string,
  stamp: string,
  compute: () => T,
) => T {
  const entries = new Map<string, CacheEntry<T>>();
  return (key, stamp, compute) => {
    const entry = entries.get(key);
    if (entry?.stamp === stamp) return entry.value;
    const value = compute();
    entries.set(key, { stamp, value });
    return value;
  };
}
