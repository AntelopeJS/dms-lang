import {
  GetFrontendModules,
  type FrontendModuleMetadata,
} from "@antelopejs/interface-dms/page";
import { filesStamp, memoize } from "./cache";
import { discoverLocaleRegistry } from "./locale-discovery";
import { readJson } from "./json";
import { deepMerge, type LocaleMessages } from "./tree";

export type OriginFilter = "own" | "external";

export interface RegistryEntry {
  path: string;
  origin: OriginFilter;
}

export type I18nRegistry = Record<string, RegistryEntry[]>;

let registry: I18nRegistry = {};

/**
 * Reads the language files of the frontend modules once: the modules are
 * known for good once the DMS started, so their files are listed only here.
 */
export async function initializeLocaleRegistry(): Promise<void> {
  const modules: FrontendModuleMetadata[] = await GetFrontendModules();
  registry = discoverLocaleRegistry(modules);
}

/** Every language file of the frontend modules, for a cache that follows them. */
export function registryFiles(): string[] {
  return Object.values(registry).flatMap((entries) =>
    entries.map((entry) => entry.path),
  );
}

/** The messages of the files of one origin, merged per language; read again once a file changed. */
export function loadMessages(origin: OriginFilter): LocaleMessages {
  return memoize(`messages:${origin}`, filesStamp(registryFiles()), () =>
    readMessages(origin),
  );
}

function readMessages(origin: OriginFilter): LocaleMessages {
  const localeMessages: LocaleMessages = {};
  for (const [localeCode, entries] of Object.entries(registry)) {
    const files = entries.filter((e) => e.origin === origin);
    if (files.length === 0) continue;
    localeMessages[localeCode] = {};
    for (const { path } of files) {
      localeMessages[localeCode] = deepMerge(
        localeMessages[localeCode],
        readJson(path),
      );
    }
  }

  return localeMessages;
}

export function getLocaleCodes(origin: OriginFilter): string[] {
  return Object.entries(registry)
    .filter(([, entries]) => entries.some((e) => e.origin === origin))
    .map(([code]) => code);
}

export function getOwnWriteTarget(localeCode: string): string | null {
  const entries = registry[localeCode] ?? [];
  return entries.findLast((e) => e.origin === "own")?.path ?? null;
}
