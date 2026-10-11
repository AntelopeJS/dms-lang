import { check } from "./errors";

const SUBTAG_SEPARATOR = /_/g;
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

function isKnownLanguage(canonical: string): boolean {
  const { language, region } = new Intl.Locale(canonical);
  if (LANGUAGE_NAMES.of(language) === undefined) return false;
  return region === undefined || REGION_NAMES.of(region) !== undefined;
}

/** A code given by a client, canonical, of a language and region the platform knows; 400 otherwise. */
export function normalizeLocaleCode(code: unknown): string {
  const canonical =
    typeof code === "string" ? canonicalLocale(code) : undefined;
  check(
    canonical !== undefined && isKnownLanguage(canonical),
    400,
    "invalid_locale",
    `Invalid or unknown language code: ${String(code)}`,
  );
  return canonical;
}

/** The comparison key of a code: canonical and lower-cased, so `fr_fr`, `fr-FR` and `FR-fr` are one language. */
export function localeKey(code: string): string {
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
