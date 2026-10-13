import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { AddFrontendModuleOptions } from "@antelopejs/interface-dms/page";
import type { I18nRegistry, OriginFilter } from "./registry";

function assetRoots(root: string): string[] {
  const layers = join(root, "layers");
  if (!existsSync(layers)) return [root];
  return readdirSync(layers, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(layers, entry.name))
    .sort();
}

function localesDirectory(root: string): string {
  return join(root, "i18n/locales");
}

function collectLocales(
  root: string,
  origin: OriginFilter,
  registry: I18nRegistry,
): void {
  const directory = localesDirectory(root);
  if (!existsSync(directory)) return;
  for (const file of readdirSync(directory, {
    recursive: true,
    encoding: "utf8",
  }).sort()) {
    const locale = file.match(/-([a-z]{2})-[A-Z]{2}\.json$/)?.[1];
    if (!locale) continue;
    registry[locale] ??= [];
    registry[locale].push({ path: join(directory, file), origin });
  }
}

export function discoverLocaleRegistry(
  modules: AddFrontendModuleOptions[],
): I18nRegistry {
  const registry: I18nRegistry = {};
  for (const module of modules) {
    const origin =
      module.options?.dmsI18nAppLayer === true ? "own" : "external";
    for (const root of assetRoots(module.sourcePath))
      collectLocales(root, origin, registry);
  }
  return registry;
}

/**
 * The folders a new language file lands in: each module's locales folder,
 * listed even while it does not exist, and the folders nested in it.
 */
export function localeDirectories(
  modules: AddFrontendModuleOptions[],
): string[] {
  return modules.flatMap((module) =>
    assetRoots(module.sourcePath).flatMap((root) => {
      const directory = localesDirectory(root);
      if (!existsSync(directory)) return [directory];
      const nested = readdirSync(directory, {
        recursive: true,
        withFileTypes: true,
      })
        .filter((entry) => entry.isDirectory())
        .map((entry) => join(entry.parentPath, entry.name));
      return [directory, ...nested.sort()];
    }),
  );
}
