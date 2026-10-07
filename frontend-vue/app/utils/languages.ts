/** Languages offered first when adding one; any other BCP 47 code can be typed. */
export const SUGGESTED_LANGUAGE_CODES = [
  'en',
  'en-GB',
  'en-US',
  'fr',
  'fr-FR',
  'fr-CA',
  'de',
  'de-DE',
  'es',
  'es-ES',
  'es-MX',
  'it',
  'it-IT',
  'pt',
  'pt-PT',
  'pt-BR',
  'nl',
  'nl-NL',
  'pl',
  'sv',
  'da',
  'fi',
  'nb',
  'cs',
  'sk',
  'hu',
  'ro',
  'bg',
  'el',
  'hr',
  'sl',
  'et',
  'lv',
  'lt',
  'ru',
  'uk',
  'tr',
  'ar',
  'he',
  'fa',
  'hi',
  'bn',
  'ja',
  'ko',
  'zh-CN',
  'zh-TW',
  'th',
  'vi',
  'id',
  'ms',
]

const RTL_LANGUAGES = new Set([
  'ar',
  'he',
  'fa',
  'ur',
  'ps',
  'sd',
  'ug',
  'yi',
  'dv',
])

export function canonicalLocale(code: string): string | null {
  try {
    return Intl.getCanonicalLocales(code.trim())[0] ?? null
  } catch {
    return null
  }
}

export function isRightToLeft(code: string): boolean {
  return RTL_LANGUAGES.has(code.split(/[-_]/)[0].toLowerCase())
}
