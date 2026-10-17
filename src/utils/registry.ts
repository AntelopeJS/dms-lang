import {
  GetFrontendModules,
  type FrontendModuleMetadata,
} from "@antelopejs/interface-dms/page";
import { filesStamp, memoize } from "./cache";
import { discoverLocaleRegistry, localeDirectories } from "./locale-discovery";
import { readJson } from "./json";
import { deepMerge, type LocaleMessages } from "./tree";
import { writeTargetOf } from "./write-target";

export type OriginFilter = "own" | "external";

interface RegistryEntry {
  path: string;
  origin: OriginFilter;
}

export type I18nRegistry = Record<string, RegistryEntry[]>;

/**
 * How often the list of frontend modules is read again: a module that
 * registers its frontend after this one started (modules start in parallel)
 * or that is taken down shows up or leaves within this delay.
 */
const MODULES_REFRESH_MS = 2000;

let modules: FrontendModuleMetadata[] = [];
let modulesStamp = "";
let refreshTimer: NodeJS.Timeout | undefined;
let directories: string[] = [];
let directoriesStamp = "";
let registry: I18nRegistry = {};

/**
 * Lists the language files of the frontend modules and keeps following them:
 * the list of modules is read again every {@link MODULES_REFRESH_MS}, and
 * their files are listed again whenever one of their locales folders changes,
 * so a module registered late or a language file added by hand shows up
 * without a restart.
 */
export async function initializeLocaleRegistry(): Promise<void> {
  await refreshModules();
  refreshTimer ??= setInterval(() => {
    void refreshModules();
  }, MODULES_REFRESH_MS);
  refreshTimer.unref();
}

/** Stops following the list of frontend modules (the module stops). */
export function stopLocaleRegistry(): void {
  clearInterval(refreshTimer);
  refreshTimer = undefined;
}

/** What of a frontend module its language files depend on. */
function moduleStamp(module: FrontendModuleMetadata): string {
  const isOwn = module.options?.dmsI18nAppLayer === true;
  return JSON.stringify([module.name, module.sourcePath, isOwn]);
}

async function refreshModules(): Promise<void> {
  let next: FrontendModuleMetadata[];
  try {
    next = await GetFrontendModules();
  } catch {
    // The DMS is going down or restarting: keep the modules known so far.
    return;
  }
  const stamp = next.map(moduleStamp).join("\n");
  if (stamp === modulesStamp) return;
  modules = next;
  modulesStamp = stamp;
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

/** Tracks file contents and module metadata, including origin changes at unchanged paths. */
export function registryStamp(): string {
  const files = Object.values(currentRegistry()).flatMap((entries) =>
    entries.map((entry) => entry.path),
  );
  return JSON.stringify([modulesStamp, filesStamp(files)]);
}

/** The messages of one origin, merged per language; refreshed when files or modules change. */
export function loadMessages(origin: OriginFilter): LocaleMessages {
  return memoize(`messages:${origin}`, registryStamp(), () =>
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

/**
 * The project file a key of a locale is written to (see
 * {@link writeTargetOf}): the one defining it, else the one holding its
 * longest namespace, else the `app-<xx-XX>.json` file; null when the project has no
 * file for the locale.
 */
export function getOwnWriteTarget(
  localeCode: string,
  segments: string[],
): string | null {
  const files = (currentRegistry()[localeCode] ?? [])
    .filter((e) => e.origin === "own")
    .map(({ path }) => ({ path, data: readJson(path) }));
  return writeTargetOf(files, segments) ?? null;
}
