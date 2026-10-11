import {
  SEARCHABLE_LANGUAGE_CODES,
  SUGGESTED_LANGUAGE_CODES,
  languageOf,
  lastSubtag,
  searchLanguages,
  sharesLanguage,
  typedLocaleCode,
  type LanguageOption,
} from '../../utils/languages'
import { boundedCache } from '../../utils/boundedCache'

/** Which names a formatter gives: the language alone, or with its region and script. */
type DisplayKind = 'language' | 'full'

/** A language of the interface, as vue-i18n lists them. */
interface InterfaceLocale {
  code: string
}

const ENGLISH = 'en'
const TILE_REGION_SEPARATOR = '-'
/** Formatters and options kept: a picker's languages, with room for the codes typed. */
const CACHE_LIMIT = 500

const DISPLAY_OPTIONS: Record<DisplayKind, Intl.DisplayNamesOptions> = {
  language: { type: 'language', fallback: 'none' },
  full: { type: 'language', fallback: 'none', languageDisplay: 'standard' },
}

const formatters = boundedCache<Intl.DisplayNames | null>(CACHE_LIMIT)
const optionCache = boundedCache<LanguageOption>(CACHE_LIMIT)

/** One formatter per language and kind of name; none for a language the browser refuses. */
function formatterOf(inLocale: string, kind: DisplayKind) {
  const id = `${kind}:${inLocale}`
  if (formatters.has(id)) return formatters.get(id) ?? null
  try {
    return formatters.set(
      id,
      new Intl.DisplayNames([inLocale], DISPLAY_OPTIONS[kind]),
    )
  } catch {
    return formatters.set(id, null)
  }
}

function displayName(
  code: string,
  inLocale: string,
  kind: DisplayKind = 'language',
): string | undefined {
  try {
    return formatterOf(inLocale, kind)?.of(code)
  } catch {
    return undefined
  }
}

function capitalize(text: string, locale: string): string {
  try {
    return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1)
  } catch {
    return text.charAt(0).toUpperCase() + text.slice(1)
  }
}

function named(name: string | undefined, locale: string, code: string) {
  return name ? capitalize(name, locale) : code
}

/** The language as its speakers write it ("Italiano" for it-IT). */
function nativeName(code: string): string {
  const name = displayName(languageOf(code), code) ?? displayName(code, code)
  return named(name, code, code)
}

/** The language and its region or script as its speakers write them ("English (United Kingdom)"). */
function fullName(code: string): string {
  const name = displayName(code, code, 'full')
  return name ? named(name, code, code) : nativeName(code)
}

/** The language and its region in the interface language ("Portuguese (Brazil)"). */
function fullLocalName(code: string, ui: string): string {
  const name =
    displayName(code, ui, 'full') ?? displayName(languageOf(code), ui)
  return named(name, ui, code)
}

/**
 * Every name a picker finds a language by: native, English and in each
 * language of the interface ("Royaume-Uni" finds en-GB in English too).
 */
function searchNames(code: string, uiLocales: string[]): string[] {
  const [ui = ENGLISH] = uiLocales
  const names = [ENGLISH, ...uiLocales].map((inLocale) =>
    named(displayName(code, inLocale, 'full'), inLocale, code),
  )
  const own = [fullName(code), nativeName(code), fullLocalName(code, ui)]
  return [...new Set([...own, ...names])]
}

/** The letters of a code tile: the language ("PT"), with the last subtag when another language of `codes` shares it ("PT-BR"). */
function tileOf(code: string, codes: string[] = []): string {
  const language = languageOf(code)
  const variant = lastSubtag(code)
  if (!sharesLanguage(code, codes) || variant === language)
    return language.toUpperCase()
  return `${language}${TILE_REGION_SEPARATOR}${variant}`.toUpperCase()
}

function languageOption(code: string, uiLocales: string[]): LanguageOption {
  const [ui = ENGLISH] = uiLocales
  const id = `${uiLocales.join()}:${code}`
  return (
    optionCache.get(id) ??
    optionCache.set(id, {
      code,
      name: fullName(code),
      localName: fullLocalName(code, ui),
      names: searchNames(code, uiLocales),
      isUnknown: displayName(languageOf(code), ENGLISH) === undefined,
    })
  )
}

/**
 * The languages a picker offers for a search, best first: the suggested
 * ones (and, once something is typed, the regional variants a search
 * finds), plus the code the search spells when it is a valid BCP 47 code
 * missing from them (de-CH-1996, es-419).
 */
function findLanguages(search: string, uiLocales: string[]): LanguageOption[] {
  const offered = search.trim()
    ? [...SUGGESTED_LANGUAGE_CODES, ...SEARCHABLE_LANGUAGE_CODES]
    : SUGGESTED_LANGUAGE_CODES
  const typed = typedLocaleCode(search)
  const all = typed && !offered.includes(typed) ? [...offered, typed] : offered
  return searchLanguages(
    all.map((code) => languageOption(code, uiLocales)),
    search,
  )
}

/** Names and code tiles of languages, without flags: a language is not a country. */
export const useLocaleNames = () => {
  const { locale, locales } = useI18n()
  /** The interface language first, then every other one ("en-GB", "fr-FR"). */
  const uiLocales = () => [
    locale.value,
    ...locales.value.map((entry: string | InterfaceLocale) =>
      typeof entry === 'string' ? entry : entry.code,
    ),
  ]
  return {
    nativeName,
    fullName,
    tileOf,
    /** The native name, with the region only when another language of `codes` shares it. */
    nameAmong: (code: string, codes: string[]) =>
      sharesLanguage(code, codes) ? fullName(code) : nativeName(code),
    languageOption: (code: string) => languageOption(code, uiLocales()),
    findLanguages: (search: string) => findLanguages(search, uiLocales()),
  }
}
