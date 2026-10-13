/** A set with every text: the only coverage that reads 100. */
export const FULL_COVERAGE = 100;

/**
 * The share of `total` that is translated, in whole percent rounded down, so
 * that one missing text keeps it under 100 (200 of 201 reads 99). Nothing to
 * translate reads 100. The one rounding rule of every coverage the module
 * shows: the language rows, the KPIs, the summaries and `localeProgress`.
 */
export function coveragePercent(translated: number, total: number): number {
  if (total <= 0) return FULL_COVERAGE;
  return Math.floor((translated * FULL_COVERAGE) / total);
}
