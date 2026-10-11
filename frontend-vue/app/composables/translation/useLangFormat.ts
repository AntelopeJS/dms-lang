const FULL_COVERAGE = 100
const LAST_INCOMPLETE = FULL_COVERAGE - 1

/**
 * The share of a set that is translated, in whole percent, never rounding a
 * gap away: 200 of 201 reads 99, only a complete set reads 100.
 */
export function honestCoverage(translated: number, total: number): number {
  if (total <= 0 || translated >= total) return FULL_COVERAGE
  return Math.min(
    LAST_INCOMPLETE,
    Math.floor((Math.max(translated, 0) / total) * FULL_COVERAGE),
  )
}

/** Counts written in the user's language and regional format. */
export const useLangFormat = () => {
  const { formatNumber } = useRegionalFormat()

  function formatCount(value: number): string {
    return String(formatNumber(value))
  }

  return { formatCount }
}
