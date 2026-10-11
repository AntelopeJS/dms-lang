/** A cache keeping at most `limit` entries, the oldest one dropped first. */
export interface BoundedCache<T> {
  get: (key: string) => T | undefined
  has: (key: string) => boolean
  set: (key: string, value: T) => T
}

/** A cache keeping at most `limit` entries: every code typed in a search adds one. */
export function boundedCache<T>(limit: number): BoundedCache<T> {
  const entries = new Map<string, T>()
  return {
    get: (key) => entries.get(key),
    has: (key) => entries.has(key),
    set(key, value) {
      entries.delete(key)
      entries.set(key, value)
      const oldest = entries.keys().next().value
      if (entries.size > limit && oldest !== undefined) entries.delete(oldest)
      return value
    },
  }
}
