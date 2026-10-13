import {
  GetFrontendModules,
  type FrontendModuleMetadata,
} from "@antelopejs/interface-dms/page";
import { filesStamp, memoize } from "./cache";
import { discoverLocaleRegistry, localeDirectories } from "./locale-discovery";
import { readJson } from "./json";
import { deepMerge, type LocaleMessages } from "./tree";

export type OriginFilter = "own" | "external";

interface RegistryEntry {
  path: string;
  origin: OriginFilter;
}

export type I18nRegistry = Record<string, RegistryEntry[]>;

let modules: FrontendModuleMetadata[] = [];
let directories: string[] = [];
let directoriesStamp = "";
let registry: I18nRegistry = {};

/**
 * Lists the language files of the frontend modules. The modules are known for
 * good once the DMS started; their files are listed again whenever one of
 * their locales folders changes, so a language file added by hand shows up
 * without a restart.
 */
export async function initializeLocaleRegistry(): Promise<void> {
  modules = await GetFrontendModules();
  scanRegistry();
}

function scanRegistry(): void {
  directories = localeDirectories(modules);
  directoriesStamp = filesStamp(directories);
  registry = discoverLocaleRegistry(modules);
}

function currentRegistry(): I18nRegistry {
  if (filesStamp(directories) !== directoriesStamp) scanRegistry();
  return registry;
}

/** Every language file of the frontend modules, for a cache that follows them. */
export function registryFiles(): string[] {
  return Object.values(currentRegistry()).flatMap((entries) =>
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
  for (const [localeCode, entries] of Object.entries(currentRegistry())) {
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
  return Object.entries(currentRegistry())
    .filter(([, entries]) => entries.some((e) => e.origin === origin))
    .map(([code]) => code);
}

export function getOwnWriteTarget(localeCode: string): string | null {
  const entries = currentRegistry()[localeCode] ?? [];
  return entries.findLast((e) => e.origin === "own")?.path ?? null;
}
