/** Counts written in the user's language and regional format. */
export const useLangFormat = () => {
  const { formatNumber } = useRegionalFormat()

  function formatCount(value: number): string {
    return String(formatNumber(value))
  }

  return { formatCount }
}
