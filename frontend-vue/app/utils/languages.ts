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

/**
 * Regional variants and further languages a search finds ("suisse" →
 * fr-CH, de-CH, it-CH) without lengthening the list shown before typing.
 */
export const SEARCHABLE_LANGUAGE_CODES = [
  'en-AU',
  'en-CA',
  'en-IE',
  'en-IN',
  'en-NZ',
  'en-ZA',
  'fr-BE',
  'fr-CH',
  'fr-LU',
  'de-AT',
  'de-CH',
  'it-CH',
  'nl-BE',
  'es-AR',
  'es-CO',
  'es-US',
  'es-419',
  'zh-HK',
  'ca',
  'eu',
  'gl',
  'ga',
  'is',
  'sq',
  'sr',
  'bs',
  'mk',
  'ka',
  'hy',
  'az',
  'kk',
  'ur',
  'ta',
  'te',
  'mr',
  'sw',
  'af',
  'fil',
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

const SUBTAG_SEPARATOR = /[-_]/
const LANGUAGE_SUBTAG_RE = /^[a-z]{2,3}$/i
const WORD_SEPARATOR = /[\s()（）,，、·'’-]+/
const DIACRITICS = /\p{Diacritic}/gu

/** How well a language answers a search, best first; absent when it does not. */
const MATCH_RANKS = {
  exactCode: 0,
  codePrefix: 1,
  namePrefix: 2,
  wordPrefix: 3,
} as const

/** A language a picker offers, with every name it can be searched by. */
export interface LanguageCandidate {
  code: string
  names: string[]
}

/** A language a picker shows: its name with the region, in its own language and in the interface's. */
export interface LanguageOption extends LanguageCandidate {
  name: string
  localName: string
  /** Not known to the browser: offered because the search spells a valid code. */
  isUnknown: boolean
}

export function languageOf(code: string): string {
  return code.split(SUBTAG_SEPARATOR)[0]
}

export function lastSubtag(code: string): string {
  return code.split(SUBTAG_SEPARATOR).at(-1) ?? code
}

/**
 * The canonical BCP 47 form of a code (`fr_FR` → `fr-FR`, `zh-hant-tw` →
 * `zh-Hant-TW`), or null when it is not one.
 */
export function canonicalLocale(code: string): string | null {
  try {
    return Intl.getCanonicalLocales(code.trim().replaceAll('_', '-'))[0] ?? null
  } catch {
    return null
  }
}

/**
 * The code a search spells, when it is a valid BCP 47 code with a real
 * language subtag (two or three letters): `french` is a valid tag, not a code.
 */
export function typedLocaleCode(search: string): string | null {
  const code = canonicalLocale(search)
  if (!code || !LANGUAGE_SUBTAG_RE.test(languageOf(code))) return null
  return code
}

/** A text as a search compares it: lower case, without accents ("Français" → "francais"). */
function folded(text: string): string {
  return text.normalize('NFD').replace(DIACRITICS, '').toLocaleLowerCase()
}

function wordsOf(text: string): string[] {
  return text.split(WORD_SEPARATOR).filter(Boolean)
}

/** Whether each word of the search starts a word of the name ("united kingdom", "royaume-uni"). */
function startsWords(name: string, needleWords: string[]): boolean {
  const words = wordsOf(name)
  return needleWords.every((needle) =>
    words.some((word) => word.startsWith(needle)),
  )
}

/** Whether a search is written as a code with subtags (`pt-BR`, `zh_Hant`), valid or not. */
export function hasSubtags(search: string): boolean {
  return SUBTAG_SEPARATOR.test(search)
}

function isSpelledCode(search: string): boolean {
  return hasSubtags(search) && typedLocaleCode(search) !== null
}

/**
 * How well a language answers one needle. A code (`fr-fr`) is never read as
 * words: "fr" would start "Français".
 */
function rankFor(candidate: LanguageCandidate, needle: string) {
  const code = candidate.code.toLowerCase()
  if (code === needle) return MATCH_RANKS.exactCode
  if (code.startsWith(needle)) return MATCH_RANKS.codePrefix
  const search = folded(needle)
  const names = candidate.names.map(folded)
  if (names.some((name) => name.startsWith(search)))
    return MATCH_RANKS.namePrefix
  if (isSpelledCode(needle)) return undefined
  const needleWords = wordsOf(search)
  if (!needleWords.length) return undefined
  if (names.some((name) => startsWords(name, needleWords)))
    return MATCH_RANKS.wordPrefix
  return undefined
}

function matchRank(candidate: LanguageCandidate, needles: string[]) {
  const ranks = needles
    .map((needle) => rankFor(candidate, needle))
    .filter((rank) => rank !== undefined)
  return ranks.length ? Math.min(...ranks) : undefined
}

/** What a search is matched with: as typed, and as the code it spells (`fra` → `fr`). */
function needlesOf(search: string): string[] {
  const typed = search.trim().toLocaleLowerCase()
  if (!typed) return []
  const code = typedLocaleCode(typed)?.toLowerCase()
  return code && code !== typed ? [typed, code] : [typed]
}

/**
 * The languages a search finds, best first: the exact code, codes starting
 * with it, then names (native, local, English) starting with it, then names
 * where each word of the search starts a word ("united kingdom", "brasil").
 * Case and accents are ignored; a search inside a word ("it" in "British")
 * finds nothing. Ties keep the order given.
 */
export function searchLanguages<T extends LanguageCandidate>(
  candidates: T[],
  search: string,
): T[] {
  const needles = needlesOf(search)
  if (!needles.length) return candidates
  return candidates
    .map((candidate, index) => ({
      candidate,
      index,
      rank: matchRank(candidate, needles),
    }))
    .filter((entry) => entry.rank !== undefined)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || a.index - b.index)
    .map((entry) => entry.candidate)
}

/** Whether another code of the list names the same language (`pt-BR`, `pt-PT`). */
export function sharesLanguage(code: string, codes: string[]): boolean {
  const language = languageOf(code).toLowerCase()
  return codes.some(
    (other) => other !== code && languageOf(other).toLowerCase() === language,
  )
}

/** The direction a language is written in, as the `dir` attribute takes it. */
export type TextDirection = 'rtl' | 'ltr'

export function isRightToLeft(code: string): boolean {
  return RTL_LANGUAGES.has(languageOf(code).toLowerCase())
}

/** The `dir` of a text in a language: right to left for Arabic, Hebrew, Persian… */
export function textDirection(code: string): TextDirection {
  return isRightToLeft(code) ? 'rtl' : 'ltr'
}
