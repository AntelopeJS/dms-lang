import { check } from "./errors";

const SUBTAG_SEPARATOR = /_/g;

/**
 * A code a language file can be named after: a language, then script, region
 * or variant subtags; no extension (`-u-…`) nor private use (`-x-…`).
 */
export const LOCALE_CODE_RE = /^[A-Z]{2,3}(?:[-_][A-Z0-9]{2,8})*$/i;
const NAME_LOCALE = "en";
const LANGUAGE_NAMES = new Intl.DisplayNames([NAME_LOCALE], {
  type: "language",
  fallback: "none",
});
const REGION_NAMES = new Intl.DisplayNames([NAME_LOCALE], {
  type: "region",
  fallback: "none",
});

/** The BCP 47 canonical form of a code (`fr_FR` → `fr-FR`), or `undefined` when it is not a language tag. */
export function canonicalLocale(code: string): string | undefined {
  try {
    return Intl.getCanonicalLocales(
      code.trim().replace(SUBTAG_SEPARATOR, "-"),
    )[0];
  } catch {
    return undefined;
  }
}

/** Whether the platform names the language and region of a code; `und` and the like are not languages. */
function isKnownLanguage(canonical: string): boolean {
  try {
    const { language, region } = new Intl.Locale(canonical);
    if (LANGUAGE_NAMES.of(language) === undefined) return false;
    return region === undefined || REGION_NAMES.of(region) !== undefined;
  } catch {
    return false;
  }
}

/**
 * A code given by a client, canonical, of a language and region the platform
 * knows and that a language file can be named after; 400 otherwise.
 */
export function normalizeLocaleCode(code: string): string {
  const canonical = canonicalLocale(code);
  check(
    canonical !== undefined &&
      LOCALE_CODE_RE.test(canonical) &&
      isKnownLanguage(canonical),
    "invalid_locale",
    { locale: code },
  );
  return canonical;
}

/** The comparison key of a code: canonical and lower-cased, so `fr_fr`, `fr-FR` and `FR-fr` are one language. */
function localeKey(code: string): string {
  return (canonicalLocale(code) ?? code).toLowerCase();
}

/** The language subtag of a code (`fr-BE` → `fr`). */
export function languageOf(code: string): string {
  return localeKey(code).split("-")[0] ?? code;
}

/** The code among `codes` naming the same language as `code`, matched on the canonical form. */
export function findLocale(codes: string[], code: string): string | undefined {
  const key = localeKey(code);
  return codes.find((candidate) => localeKey(candidate) === key);
}
