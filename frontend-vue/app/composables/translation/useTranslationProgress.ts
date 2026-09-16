type TranslationValue = string | number | boolean | null | undefined
type LocaleFallback = string | string[] | Record<string, string[]> | false

const API_BASE = '/api/lang/translations'
const TRANSLATION_FLAT_ENDPOINT = `${API_BASE}/flat`
const DEFAULT_LOCALE = 'en'

export interface FlatTranslationRow {
  key: string
  values: Record<string, TranslationValue>
  /** Per-locale inherited module value (default workspace only). */
  inherited?: Record<string, TranslationValue>
}

export interface FlatTranslations {
  defaultLocale: string
  locales: string[]
  rows: FlatTranslationRow[]
  localeProgress: Record<string, number>
  localeMissing: Record<string, number>
  totalKeys: number
}

export const EMPTY_FLAT: FlatTranslations = {
  defaultLocale: '',
  locales: [],
  rows: [],
  localeProgress: {},
  localeMissing: {},
  totalKeys: 0,
}

export function isLocaleValueMissing(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

export function resolveDefaultLocale(fallback: LocaleFallback): string {
  if (typeof fallback === 'string') return fallback
  if (Array.isArray(fallback)) return fallback[0] ?? DEFAULT_LOCALE
  return (fallback && fallback.default?.[0]) || DEFAULT_LOCALE
}

export const useTranslationProgress = () => {
  const { $authFetch } = useAuthFetch()
  const { fallbackLocale } = useI18n()

  async function fetchFlat(
    workspace: string = DEFAULT_WORKSPACE,
  ): Promise<FlatTranslations | null> {
    const defaultLocale = resolveDefaultLocale(fallbackLocale.value)
    try {
      const response = await $authFetch<Partial<FlatTranslations>>(
        TRANSLATION_FLAT_ENDPOINT,
        { query: { defaultLocale, workspace } },
      )

      return {
        defaultLocale: response?.defaultLocale ?? String(defaultLocale),
        locales: response?.locales ?? [],
        rows: response?.rows ?? [],
        localeProgress: response?.localeProgress ?? {},
        localeMissing: response?.localeMissing ?? {},
        totalKeys: response?.totalKeys ?? 0,
      }
    } catch {
      return null
    }
  }

  return {
    fetchFlat,
  }
}
