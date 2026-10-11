import type { WorkspaceLocale } from '../../types/lang'
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

const ENGLISH = 'en'
const TILE_REGION_SEPARATOR = '-'

const optionCache = new Map<string, LanguageOption>()

const LANGUAGE_DISPLAY: Intl.DisplayNamesOptions = {
  type: 'language',
  fallback: 'none',
}

const FULL_DISPLAY: Intl.DisplayNamesOptions = {
  ...LANGUAGE_DISPLAY,
  languageDisplay: 'standard',
}

function displayName(
  code: string,
  inLocale: string,
  options = LANGUAGE_DISPLAY,
): string | undefined {
  try {
    return new Intl.DisplayNames([inLocale], options).of(code)
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

/** Names and code tiles of languages, without flags: a language is not a country. */
export const useLocaleNames = () => {
  const { locale, locales } = useI18n()

  /** The codes of the interface languages ("en-GB", "fr-FR"). */
  function interfaceLocales(): string[] {
    return locales.value.map((entry: string | { code: string }) =>
      typeof entry === 'string' ? entry : entry.code,
    )
  }

  /**
   * The language as its speakers write it ("Italiano" for it-IT): the code
   * shown next to it carries the region.
   */
  function nativeName(code: string): string {
    const name = displayName(languageOf(code), code) ?? displayName(code, code)
    return named(name, code, code)
  }

  /**
   * The language and its region or script as its speakers write them
   * ("English (United Kingdom)", "中文（繁體，台灣）"): what a picker shows,
   * where two variants must not look alike.
   */
  function fullName(code: string): string {
    const name = displayName(code, code, FULL_DISPLAY)
    return name ? named(name, code, code) : nativeName(code)
  }

  /** The language in the interface language ("Italian"). */
  function localName(code: string): string {
    return named(displayName(code, locale.value), locale.value, code)
  }

  /** The language and its region in the interface language ("Portuguese (Brazil)"). */
  function fullLocalName(code: string): string {
    const name =
      displayName(code, locale.value, FULL_DISPLAY) ??
      displayName(languageOf(code), locale.value)
    return named(name, locale.value, code)
  }

  /**
   * Every name a picker finds a language by: native, English and in each
   * language of the interface ("Royaume-Uni" finds en-GB in English too).
   */
  function searchNames(code: string): string[] {
    const interfaceNames = [locale.value, ...interfaceLocales()].map(
      (inLocale) =>
        named(displayName(code, inLocale, FULL_DISPLAY), inLocale, code),
    )
    const names = [
      fullName(code),
      nativeName(code),
      fullLocalName(code),
      named(displayName(code, ENGLISH, FULL_DISPLAY), ENGLISH, code),
      ...interfaceNames,
    ]
    return [...new Set(names)]
  }

  /**
   * The native name, with the region only when another language of `codes`
   * shares it ("Português (Brasil)" next to pt-PT).
   */
  function nameAmong(code: string, codes: string[]): string {
    return sharesLanguage(code, codes) ? fullName(code) : nativeName(code)
  }

  function workspaceLocaleName(entry: WorkspaceLocale): string {
    return entry.name || nativeName(entry.code)
  }

  /**
   * The letters of a code tile: the language ("PT"), with the last subtag of
   * the code when another language of `codes` shares it ("PT-BR").
   */
  function tileOf(code: string, codes: string[] = []): string {
    const language = languageOf(code)
    const variant = lastSubtag(code)
    if (!sharesLanguage(code, codes) || variant === language)
      return language.toUpperCase()
    return `${language}${TILE_REGION_SEPARATOR}${variant}`.toUpperCase()
  }

  function isKnownLanguage(code: string): boolean {
    return displayName(languageOf(code), ENGLISH) !== undefined
  }

  function languageOption(code: string): LanguageOption {
    const cacheKey = `${locale.value}:${code}`
    const cached = optionCache.get(cacheKey)
    if (cached) return cached
    const option = {
      code,
      name: fullName(code),
      localName: fullLocalName(code),
      names: searchNames(code),
      isUnknown: !isKnownLanguage(code),
    }
    optionCache.set(cacheKey, option)
    return option
  }

  /**
   * The languages a picker offers for a search, best first: the suggested
   * ones (and, once something is typed, the regional variants a search
   * finds), plus the code the search spells when it is a valid BCP 47 code
   * missing from them (de-CH-1996, es-419).
   */
  function findLanguages(search: string, codes?: string[]): LanguageOption[] {
    const offered =
      codes ??
      (search.trim()
        ? [...SUGGESTED_LANGUAGE_CODES, ...SEARCHABLE_LANGUAGE_CODES]
        : SUGGESTED_LANGUAGE_CODES)
    const typed = typedLocaleCode(search)
    const all =
      typed && !offered.includes(typed) ? [...offered, typed] : offered
    return searchLanguages(all.map(languageOption), search)
  }

  return {
    nativeName,
    fullName,
    localName,
    fullLocalName,
    searchNames,
    nameAmong,
    workspaceLocaleName,
    tileOf,
    isKnownLanguage,
    languageOption,
    findLanguages,
  }
}
