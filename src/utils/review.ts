import { createHash } from "node:crypto";
import type { KeyChange, KeyStore } from "./keys";
import { getValueAtPath, isMissing, type LocaleMessages } from "./tree";
import {
  type TranslationSources,
  updateManifest,
  type WorkspaceManifest,
} from "./workspaces";

const HASH_LENGTH = 12;

/** A short fingerprint of a base text. */
function fingerprint(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, HASH_LENGTH);
}

function baseText(
  messages: LocaleMessages,
  base: string,
  path: string,
): string | undefined {
  const value = getValueAtPath(messages[base], path);
  return typeof value === "string" && !isMissing(value) ? value : undefined;
}

function recordTexts(
  sources: TranslationSources,
  base: string,
  change: KeyChange,
): void {
  const source = baseText(change.messages, base, change.path);
  for (const [locale, text] of Object.entries(change.texts ?? {})) {
    if (locale === base) continue;
    sources[locale] ??= {};
    if (text === null || source === undefined)
      delete sources[locale][change.path];
    else sources[locale][change.path] = fingerprint(source);
  }
}

function moveKey(sources: TranslationSources, change: KeyChange): void {
  for (const records of Object.values(sources)) {
    const hash = records[change.path];
    delete records[change.path];
    if (change.newPath !== undefined && hash !== undefined)
      records[change.newPath] = hash;
  }
}

function applyChange(manifest: WorkspaceManifest, change: KeyChange): void {
  const sources = manifest.sources ?? {};
  if (change.texts) recordTexts(sources, manifest.defaultLocale, change);
  else moveKey(sources, change);
  manifest.sources = sources;
}

/** Records, in the manifest, the base text each translation of an added workspace was written for. */
export function trackSources(store: KeyStore, workspace: string): KeyStore {
  return {
    ...store,
    track: (change) =>
      updateManifest(workspace, (manifest) => applyChange(manifest, change)),
  };
}

/** The locales of a key whose translation was written for another base text than the current one. */
export function outdatedLocales(
  sources: TranslationSources | undefined,
  messages: LocaleMessages,
  base: string,
  path: string,
): string[] {
  const source = baseText(messages, base, path);
  if (!sources || source === undefined) return [];
  const current = fingerprint(source);
  return Object.entries(sources)
    .filter(([locale, records]) => {
      const recorded = records[path];
      return (
        recorded !== undefined &&
        recorded !== current &&
        !isMissing(getValueAtPath(messages[locale], path))
      );
    })
    .map(([locale]) => locale);
}
