import {
  GetFrontendModules,
  type FrontendModuleMetadata,
} from "@antelopejs/interface-dms/page";
import { discoverLocaleRegistry } from "./locale-discovery";
import { readJson } from "./json";
import { deepMerge, type LocaleMessages } from "./tree";

export type OriginFilter = "own" | "external";

export interface RegistryEntry {
  path: string;
  origin: OriginFilter;
}

export type I18nRegistry = Record<string, RegistryEntry[]>;

let frontendModules: FrontendModuleMetadata[] = [];

export async function initializeLocaleRegistry(): Promise<void> {
  frontendModules = await GetFrontendModules();
}

function loadRegistry(): I18nRegistry {
  return discoverLocaleRegistry(frontendModules);
}

export function loadMessages(origin: OriginFilter): LocaleMessages {
  const registry = loadRegistry();

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
  const registry = loadRegistry();
  return Object.entries(registry)
    .filter(([, entries]) => entries.some((e) => e.origin === origin))
    .map(([code]) => code);
}

export function getOwnWriteTarget(localeCode: string): string | null {
  const registry = loadRegistry();
  const entries = registry[localeCode] ?? [];
  return entries.findLast((e) => e.origin === "own")?.path ?? null;
}
