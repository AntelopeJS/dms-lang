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
  return `${path}:${stats.ino}:${stats.mtimeNs}:${stats.ctimeNs}:${stats.size}:${written}`;
}

/**
 * What a set of files looks like (path, inode, modification and change
 * times, size, writes of the module): a cached value read from them is stale
 * as soon as one of them changes, a file edited by hand, copied with its
 * modification time kept or moved in place of another included.
 */
export function filesStamp(paths: string[]): string {
  return paths.map(fileStamp).join(STAMP_SEPARATOR);
}

/**
 * The longest a file system can take to move a change time: a few
 * milliseconds of kernel clock tick on Linux, two seconds on FAT. Two changes
 * within one step leave the same times.
 */
const TIMESTAMP_STEP_NS = 2_000_000_000n;

function changedWithinStep(path: string, now: bigint): boolean {
  const stats = statSync(path, { throwIfNoEntry: false, bigint: true });
  return stats !== undefined && now - stats.ctimeNs < TIMESTAMP_STEP_NS;
}

/**
 * The {@link filesStamp} of `paths`, or null while one of them changed too
 * recently for a later change to move its times: a value read from them then
 * cannot be told apart from one read after that change, so it is read again.
 */
export function settledStamp(paths: string[]): string | null {
  const now = BigInt(Date.now()) * 1_000_000n;
  if (paths.some((path) => changedWithinStep(path, now))) return null;
  return filesStamp(paths);
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
