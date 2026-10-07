import type { WorkspaceLocale } from '../../types/lang'

const LANGUAGE_DISPLAY: Intl.DisplayNamesOptions = {
  type: 'language',
  fallback: 'none',
}

function displayName(code: string, inLocale: string): string | undefined {
  try {
    return new Intl.DisplayNames([inLocale], LANGUAGE_DISPLAY).of(code)
  } catch {
    return undefined
  }
}

function languageOf(code: string): string {
  return code.split(/[-_]/)[0]
}

function capitalize(text: string, locale: string): string {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1)
}

/** Names and code tiles of languages, without flags: a language is not a country. */
export const useLocaleNames = () => {
  const { locale } = useI18n()

  /**
   * The language as its speakers write it ("Italiano" for it-IT): the code
   * shown next to it carries the region.
   */
  function nativeName(code: string): string {
    const language = languageOf(code)
    const name = displayName(language, code) ?? displayName(code, code)
    return name ? capitalize(name, code) : code
  }

  /** The language in the interface language ("Italian"). */
  function localName(code: string): string {
    const name = displayName(code, locale.value)
    return name ? capitalize(name, locale.value) : code
  }

  function workspaceLocaleName(entry: WorkspaceLocale): string {
    return entry.name || nativeName(entry.code)
  }

  function tileOf(code: string): string {
    return languageOf(code).toUpperCase()
  }

  function isKnownLanguage(code: string): boolean {
    return displayName(code, 'en') !== undefined
  }

  return { nativeName, localName, workspaceLocaleName, tileOf, isKnownLanguage }
}
