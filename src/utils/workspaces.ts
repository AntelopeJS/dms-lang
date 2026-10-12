import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { resolve, sep } from "node:path";
import { getTranslationConfig } from "./config";
import { check, fail } from "./errors";
import { readJson, readJsonForWrite, writeJson } from "./json";
import type { KeyStore } from "./keys";
import {
  findLocale,
  LOCALE_CODE_RE,
  languageOf,
  normalizeLocaleCode,
} from "./locale-codes";
import type { LocaleMessages } from "./tree";

export interface WorkspaceLocale {
  code: string;
  name?: string;
  flag?: string;
}

export const WORKSPACE_TYPES = ["dms", "website", "mobile", "other"] as const;
type WorkspaceType = (typeof WORKSPACE_TYPES)[number];

export interface WorkspaceDetails {
  description?: string;
  type?: WorkspaceType;
}

/** Hash of the base text each translation was written against, per locale then key (outdated detection). */
export type TranslationSources = Record<string, Record<string, string>>;

export interface WorkspaceManifest extends WorkspaceDetails {
  defaultLocale: string;
  locales: WorkspaceLocale[];
  sources?: TranslationSources;
}

export const DEFAULT_WORKSPACE = "default";
export const MODULES_WORKSPACE = "modules";

export type WorkspaceKind = "default" | "modules" | "added";

const RESERVED_KINDS = new Map<string, WorkspaceKind>([
  [DEFAULT_WORKSPACE, "default"],
  [MODULES_WORKSPACE, "modules"],
]);

export function workspaceKind(workspace: string): WorkspaceKind {
  return RESERVED_KINDS.get(workspace) ?? "added";
}

export interface WorkspaceSummary extends WorkspaceDetails {
  id: string;
  kind: WorkspaceKind;
  editable: boolean;
  defaultLocale: string;
  locales: WorkspaceLocale[];
}

const MANIFEST_FILE = ".workspace.json";
const JSON_EXTENSION = ".json";
const WORKSPACE_ID_RE = /^[a-z0-9][\w-]{0,63}$/;
const RESERVED_IDS = new Set([DEFAULT_WORKSPACE, MODULES_WORKSPACE]);

export function assertEditable(): void {
  check(getTranslationConfig().editable, "read_only");
}

/** A workspace id, lower-cased: ids are case-insensitive. */
export function normalizeWorkspaceId(id = ""): string {
  return id.trim().toLowerCase();
}

function validateWorkspaceId(id: string): string {
  const normalized = normalizeWorkspaceId(id);
  check(WORKSPACE_ID_RE.test(normalized), "invalid_workspace_id", { id });
  return normalized;
}

function getWorkspacesDir(): string {
  const dir = getTranslationConfig().workspacesDir;
  if (!dir) fail("server_error", {}, "not_configured");
  return resolve(dir);
}

function folderNames(): string[] {
  const root = getWorkspacesDir();
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

/** The folder of each workspace by lower-cased id; a folder whose name differs only by case from another is ignored. */
function workspaceFolders(): Map<string, string> {
  const folders = new Map<string, string>();
  for (const name of folderNames()) {
    const id = name.toLowerCase();
    if (!WORKSPACE_ID_RE.test(id) || RESERVED_IDS.has(id) || folders.has(id))
      continue;
    folders.set(id, name);
  }
  return folders;
}

function insideRoot(name: string): string {
  const root = getWorkspacesDir();
  const dir = resolve(root, name);
  check(dir.startsWith(root + sep), "invalid_workspace_id", { id: name });
  return dir;
}

interface NewWorkspaceFolder {
  id: string;
  dir: string;
}

function newWorkspaceDir(id: string): NewWorkspaceFolder {
  const normalized = validateWorkspaceId(id);
  check(!RESERVED_IDS.has(normalized), "reserved_workspace", {
    id: normalized,
  });
  check(!workspaceFolders().has(normalized), "workspace_exists", {
    id: normalized,
  });
  return { id: normalized, dir: insideRoot(normalized) };
}

/** Whether an added workspace exists (case-insensitive). */
export function hasWorkspace(id: string): boolean {
  return workspaceFolders().has(normalizeWorkspaceId(id));
}

/** The folder of an existing added workspace, or 404 without any disk path. */
function workspaceDir(id: string): string {
  const folder = workspaceFolders().get(normalizeWorkspaceId(id));
  if (folder === undefined) fail("unknown_workspace", { id });
  return insideRoot(folder);
}

function manifestPath(dir: string): string {
  return resolve(dir, MANIFEST_FILE);
}

function localeCodesOf(dir: string): string[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(JSON_EXTENSION) && !file.startsWith("."))
    .map((file) => file.slice(0, -JSON_EXTENSION.length))
    .filter((code) => LOCALE_CODE_RE.test(code));
}

function storedDetails(stored: Partial<WorkspaceManifest>): WorkspaceDetails {
  const details: WorkspaceDetails = {};
  if (typeof stored.description === "string" && stored.description !== "")
    details.description = stored.description;
  if (WORKSPACE_TYPES.includes(stored.type as WorkspaceType))
    details.type = stored.type;
  return details;
}

type JsonReader = (path: string) => Record<string, unknown>;

function readManifestAt(
  dir: string,
  read: JsonReader = readJson,
): WorkspaceManifest {
  const stored = read(manifestPath(dir)) as Partial<WorkspaceManifest>;
  const storedLocales = Array.isArray(stored.locales) ? stored.locales : [];
  const byCode = new Map(storedLocales.map((locale) => [locale.code, locale]));
  const locales = localeCodesOf(dir).map(
    (code) => byCode.get(code) ?? { code },
  );
  const defaultLocale =
    stored.defaultLocale && locales.some((l) => l.code === stored.defaultLocale)
      ? stored.defaultLocale
      : (locales[0]?.code ?? "");
  const manifest: WorkspaceManifest = {
    defaultLocale,
    locales,
    ...storedDetails(stored),
  };
  if (stored.sources && typeof stored.sources === "object")
    manifest.sources = stored.sources;
  return manifest;
}

/**
 * The manifest of a workspace about to be rewritten: a manifest that is not
 * valid JSON stops the write instead of losing its details, base and sources.
 */
function manifestForWrite(dir: string): WorkspaceManifest {
  return readManifestAt(dir, (path) =>
    readJsonForWrite(path, "corrupt_manifest"),
  );
}

function writeManifestAt(dir: string, manifest: WorkspaceManifest): void {
  writeJson(manifestPath(dir), manifest);
}

/** Reads, changes and writes back the manifest of a workspace. */
export function updateManifest(
  id: string,
  change: (manifest: WorkspaceManifest) => void,
): WorkspaceManifest {
  const dir = workspaceDir(id);
  const manifest = manifestForWrite(dir);
  change(manifest);
  writeManifestAt(dir, manifest);
  return manifest;
}

function summaryOf(id: string, manifest: WorkspaceManifest): WorkspaceSummary {
  const { defaultLocale, locales, description, type } = manifest;
  return {
    id,
    kind: "added",
    editable: true,
    defaultLocale,
    locales,
    ...storedDetails({ description, type }),
  };
}

export function listWorkspaces(): WorkspaceSummary[] {
  return [...workspaceFolders().entries()].map(([id, folder]) =>
    summaryOf(id, readManifestAt(insideRoot(folder))),
  );
}

export function getWorkspaceSummary(id: string): WorkspaceSummary {
  return summaryOf(normalizeWorkspaceId(id), getWorkspaceManifest(id));
}

export function getWorkspaceManifest(id: string): WorkspaceManifest {
  return readManifestAt(workspaceDir(id));
}

function localeFile(dir: string, code: string): string {
  return resolve(dir, `${code}${JSON_EXTENSION}`);
}

function readMessagesAt(dir: string, codes: string[]): LocaleMessages {
  return Object.fromEntries(
    codes.map((code) => [code, readJson(localeFile(dir, code))]),
  );
}

function codesOf(manifest: WorkspaceManifest): string[] {
  return manifest.locales.map((locale) => locale.code);
}

export function loadWorkspaceMessages(id: string): LocaleMessages {
  const dir = workspaceDir(id);
  return readMessagesAt(dir, codesOf(readManifestAt(dir)));
}

/** The files an added workspace is read from: its manifest and its language files. */
export function workspaceFiles(id: string): string[] {
  const dir = workspaceDir(id);
  return [
    manifestPath(dir),
    ...localeCodesOf(dir).map((code) => localeFile(dir, code)),
  ];
}

export interface ServedLocale {
  code: string;
  messages: Record<string, unknown>;
}

/**
 * The messages of a locale of an added workspace for the public endpoint: the exact code
 * (case-insensitive, canonical), else the language alone (`fr-FR` → `fr`). `null` when neither exists.
 */
export function readWorkspaceLocale(
  id: string,
  code: string,
): ServedLocale | null {
  if (!hasWorkspace(id)) return null;
  const dir = workspaceDir(id);
  const codes = localeCodesOf(dir);
  const served = findLocale(codes, code) ?? findLocale(codes, languageOf(code));
  if (served === undefined) return null;
  return { code: served, messages: readJson(localeFile(dir, served)) };
}

/** The description and type a request sends: `null` or an empty value clears them. */
export interface DetailsInput {
  description?: string | null;
  type?: WorkspaceType | "" | null;
}

function cleanDescription(description?: string | null): string | undefined {
  return description?.trim() || undefined;
}

function cleanType(
  type?: WorkspaceType | "" | null,
): WorkspaceType | undefined {
  return type || undefined;
}

/** The description and type of a validated request; empty fields are left out. */
function cleanDetails(input: DetailsInput): WorkspaceDetails {
  return storedDetails({
    description: cleanDescription(input.description),
    type: cleanType(input.type),
  });
}

/** A language entry as stored: its canonical code, its name and flag when not empty. */
export function validateLocaleEntry(locale: WorkspaceLocale): WorkspaceLocale {
  const { code, name, flag } = locale;
  const entry: WorkspaceLocale = { code: normalizeLocaleCode(code) };
  if (typeof name === "string" && name.trim() !== "") entry.name = name.trim();
  if (typeof flag === "string" && flag.trim() !== "") entry.flag = flag.trim();
  return entry;
}

export interface WorkspaceSeed extends DetailsInput {
  defaultLocale: string;
  locales: WorkspaceLocale[];
  messages: LocaleMessages;
}

/** Writes a new workspace folder from validated content. */
export function writeNewWorkspace(rawId: string, seed: WorkspaceSeed): string {
  const { id, dir } = newWorkspaceDir(rawId);
  mkdirSync(dir, { recursive: true });
  writeManifestAt(dir, {
    defaultLocale: seed.defaultLocale,
    locales: seed.locales,
    ...cleanDetails(seed),
  });
  for (const locale of seed.locales) {
    writeJson(localeFile(dir, locale.code), seed.messages[locale.code] ?? {});
  }
  return id;
}

export function createWorkspace(
  id: string,
  locale: WorkspaceLocale,
  details: DetailsInput = {},
): string {
  const entry = validateLocaleEntry(locale);
  return writeNewWorkspace(id, {
    ...details,
    defaultLocale: entry.code,
    locales: [entry],
    messages: {},
  });
}

export function updateWorkspaceDetails(
  id: string,
  details: DetailsInput,
): WorkspaceSummary {
  const manifest = updateManifest(id, (current) => {
    if ("description" in details)
      current.description = cleanDescription(details.description);
    if ("type" in details) current.type = cleanType(details.type);
  });
  return summaryOf(normalizeWorkspaceId(id), manifest);
}

export function renameWorkspace(id: string, newId: string): string {
  const from = workspaceDir(id);
  const target = newWorkspaceDir(newId);
  renameSync(from, target.dir);
  return target.id;
}

export function deleteWorkspace(id: string): void {
  rmSync(workspaceDir(id), { recursive: true, force: true });
}

export interface AddedLocale {
  code: string;
  sameLanguage: string[];
}

export function addLocale(id: string, locale: WorkspaceLocale): AddedLocale {
  const entry = validateLocaleEntry(locale);
  const dir = workspaceDir(id);
  const manifest = manifestForWrite(dir);
  const codes = manifest.locales.map((l) => l.code);
  const existing = findLocale(codes, entry.code);
  check(existing === undefined, "locale_exists", {
    locale: existing ?? entry.code,
  });
  writeJson(localeFile(dir, entry.code), {});
  manifest.locales.push(entry);
  if (!manifest.defaultLocale) manifest.defaultLocale = entry.code;
  writeManifestAt(dir, manifest);
  const language = languageOf(entry.code);
  return {
    code: entry.code,
    sameLanguage: codes.filter((code) => languageOf(code) === language),
  };
}

/** The stored code of a locale of a workspace, matched on its canonical form; 404 when absent. */
function workspaceLocaleCode(
  manifest: WorkspaceManifest,
  code: string,
): string {
  const codes = manifest.locales.map((locale) => locale.code);
  const found = findLocale(codes, code);
  if (found === undefined) fail("unknown_locale", { locale: code });
  return found;
}

export function removeLocale(id: string, code: string): void {
  const dir = workspaceDir(id);
  const manifest = manifestForWrite(dir);
  const stored = workspaceLocaleCode(manifest, code);
  check(stored !== manifest.defaultLocale, "base_locale", { locale: stored });
  const filePath = localeFile(dir, stored);
  if (existsSync(filePath)) unlinkSync(filePath);
  manifest.locales = manifest.locales.filter((l) => l.code !== stored);
  if (manifest.sources) delete manifest.sources[stored];
  writeManifestAt(dir, manifest);
}

export function setWorkspaceDefaultLocale(id: string, code: string): string {
  const dir = workspaceDir(id);
  const manifest = manifestForWrite(dir);
  const stored = workspaceLocaleCode(manifest, code);
  if (stored !== manifest.defaultLocale) {
    manifest.defaultLocale = stored;
    delete manifest.sources;
  }
  writeManifestAt(dir, manifest);
  return stored;
}

/** The key store of an added workspace: one file per locale, no read-only layer. */
export function workspaceKeyStore(id: string): KeyStore {
  const dir = workspaceDir(id);
  const manifest = readManifestAt(dir);
  const locales = codesOf(manifest);
  return {
    locales,
    baseLocale: manifest.defaultLocale,
    messages: readMessagesAt(dir, locales),
    reference: {},
    load: (code) => readJsonForWrite(localeFile(dir, code)),
    save: (code, data) => writeJson(localeFile(dir, code), data),
  };
}
