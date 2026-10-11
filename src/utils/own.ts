import { fail } from "./errors";
import { readJsonForWrite, writeJson } from "./json";
import type { KeyStore } from "./keys";
import { getLocaleCodes, getOwnWriteTarget, loadMessages } from "./registry";
import { projectBaseLocale } from "./catalog";

function writeTarget(locale: string): string {
  const target = getOwnWriteTarget(locale);
  if (target === null)
    fail(400, "unknown_locale", `No project file for locale ${locale}`);
  return target;
}

/** The key store of the project files (default): the modules are a read-only layer under them. */
export function ownKeyStore(): KeyStore {
  return {
    locales: getLocaleCodes("own"),
    baseLocale: projectBaseLocale(),
    messages: loadMessages("own"),
    reference: loadMessages("external"),
    load: (locale) => readJsonForWrite(writeTarget(locale)),
    save: (locale, data) => writeJson(writeTarget(locale), data),
  };
}
