import { fail } from "./errors";
import { readJsonForWrite, writeJson } from "./json";
import type { KeyStore } from "./keys";
import { getLocaleCodes, getOwnWriteTarget, loadMessages } from "./registry";
import { projectBaseLocale } from "./catalog";

function writeTarget(locale: string, segments: string[]): string {
  const target = getOwnWriteTarget(locale, segments);
  if (target === null) fail("undeclared_locale", { locale }, "no_project_file");
  return target;
}

/** The key store of the project files (default): the modules are a read-only layer under them. */
export function ownKeyStore(): KeyStore {
  return {
    locales: getLocaleCodes("own"),
    baseLocale: projectBaseLocale(),
    messages: loadMessages("own"),
    reference: loadMessages("external"),
    load: (locale, segments) => readJsonForWrite(writeTarget(locale, segments)),
    save: (locale, data, segments) =>
      writeJson(writeTarget(locale, segments), data),
  };
}
