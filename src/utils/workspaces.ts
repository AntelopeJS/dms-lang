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
import { findLocale, languageOf, normalizeLocaleCode } from "./locale-codes";
import type { LocaleMessages } from "./tree";

export interface WorkspaceLocale {
  code: string;
  name?: string;
  flag?: string;
}

export const WORKSPACE_TYPES = ["dms", "website", "mobile", "other"] as const;
export type WorkspaceType = (typeof WORKSPACE_TYPES)[number];

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
export const ALL_WORKSPACE = "all";

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
const RESERVED_IDS = new Set([
  DEFAULT_WORKSPACE,
  MODULES_WORKSPACE,
  ALL_WORKSPACE,
]);
const LOCALE_FILE_RE = /^[A-Z]{2,3}(?:[-_][A-Z0-9]{2,8})*$/i;
const DESCRIPTION_MAX_LENGTH = 500;

export function assertEditable(): void {
  check(
    getTranslationConfig().editable,
    403,
    "read_only",
    "i18n workspace editing is disabled",
  );
}

/** A workspace id, lower-cased: ids are case-insensitive. */
export function normalizeWorkspaceId(id: unknown): string {
  return typeof id === "string" ? id.trim().toLowerCase() : "";
}

export function validateWorkspaceId(id: unknown): string {
  const normalized = normalizeWorkspaceId(id);
  check(
    WORKSPACE_ID_RE.test(normalized),
    400,
    "invalid_workspace_id",
    `Invalid workspace id: ${String(id)}. Use lowercase letters, digits, "_" and "-".`,
  );
  return normalized;
}

function getWorkspacesDir(): string {
  const dir = getTranslationConfig().workspacesDir;
  if (!dir)
    fail(500, "server_error", "i18n workspaces directory is not configured");
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
  check(
    dir.startsWith(root + sep),
    400,
    "invalid_workspace_id",
    "Invalid workspace id",
  );
  return dir;
}

interface NewWorkspaceFolder {
  id: string;
  dir: string;
}

function newWorkspaceDir(id: unknown): NewWorkspaceFolder {
  const normalized = validateWorkspaceId(id);
  check(
    !RESERVED_IDS.has(normalized),
    400,
    "reserved_workspace",
    `"${normalized}" is a reserved workspace name`,
  );
  check(
    !workspaceFolders().has(normalized),
    409,
    "workspace_exists",
    `Workspace already exists: ${normalized}`,
  );
  return { id: normalized, dir: insideRoot(normalized) };
}

/** Whether an added workspace exists (case-insensitive). */
export function hasWorkspace(id: unknown): boolean {
  return workspaceFolders().has(normalizeWorkspaceId(id));
}

/** The folder of an existing added workspace, or 404 without any disk path. */
function workspaceDir(id: unknown): string {
  const folder = workspaceFolders().get(normalizeWorkspaceId(id));
  if (folder === undefined)
    fail(404, "unknown_workspace", `Unknown workspace: ${String(id)}`);
  return insideRoot(folder);
}

function manifestPath(dir: string): string {
  return resolve(dir, MANIFEST_FILE);
}

function localeCodesOf(dir: string): string[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(JSON_EXTENSION) && !file.startsWith("."))
    .map((file) => file.slice(0, -JSON_EXTENSION.length))
    .filter((code) => LOCALE_FILE_RE.test(code));
}

function storedDetails(stored: Partial<WorkspaceManifest>): WorkspaceDetails {
  const details: WorkspaceDetails = {};
  if (typeof stored.description === "string" && stored.description !== "")
    details.description = stored.description;
  if (WORKSPACE_TYPES.includes(stored.type as WorkspaceType))
    details.type = stored.type;
  return details;
}

function readManifestAt(dir: string): WorkspaceManifest {
  const stored = readJson(manifestPath(dir)) as Partial<WorkspaceManifest>;
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

function writeManifestAt(dir: string, manifest: WorkspaceManifest): void {
  writeJson(manifestPath(dir), manifest);
}

/** Reads, changes and writes back the manifest of a workspace. */
export function updateManifest(
  id: string,
  change: (manifest: WorkspaceManifest) => void,
): WorkspaceManifest {
  const dir = workspaceDir(id);
  const manifest = readManifestAt(dir);
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

export function loadWorkspaceMessages(id: string): LocaleMessages {
  const dir = workspaceDir(id);
  const messages: LocaleMessages = {};
  for (const locale of readManifestAt(dir).locales) {
    messages[locale.code] = readJson(localeFile(dir, locale.code));
  }
  return messages;
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

function validateDescription(description: unknown): string | undefined {
  if (description === undefined || description === null) return undefined;
  check(
    typeof description === "string" &&
      description.length <= DESCRIPTION_MAX_LENGTH,
    400,
    "invalid_body",
    `The description must be a text of at most ${DESCRIPTION_MAX_LENGTH} characters`,
  );
  return description.trim() || undefined;
}

function validateType(type: unknown): WorkspaceType | undefined {
  if (type === undefined || type === null || type === "") return undefined;
  check(
    WORKSPACE_TYPES.includes(type as WorkspaceType),
    400,
    "invalid_body",
    `Unknown workspace type: ${JSON.stringify(type)} (expected ${WORKSPACE_TYPES.join(", ")})`,
  );
  return type as WorkspaceType;
}

/** The description and type of a body, validated; `undefined` fields are left out. */
export function validateDetails(input: WorkspaceDetails): WorkspaceDetails {
  return storedDetails({
    description: validateDescription(input.description),
    type: validateType(input.type),
  });
}

function validateLocaleEntry(locale: unknown): WorkspaceLocale {
  check(
    locale !== null && typeof locale === "object",
    400,
    "invalid_body",
    "Missing field: locale",
  );
  const { code, name, flag } = locale as WorkspaceLocale;
  const entry: WorkspaceLocale = { code: normalizeLocaleCode(code) };
  if (typeof name === "string" && name.trim() !== "") entry.name = name.trim();
  if (typeof flag === "string" && flag.trim() !== "") entry.flag = flag.trim();
  return entry;
}

export interface WorkspaceSeed extends WorkspaceDetails {
  defaultLocale: string;
  locales: WorkspaceLocale[];
  messages: LocaleMessages;
}

/** Writes a new workspace folder from validated content. */
export function writeNewWorkspace(rawId: unknown, seed: WorkspaceSeed): string {
  const { id, dir } = newWorkspaceDir(rawId);
  mkdirSync(dir, { recursive: true });
  writeManifestAt(dir, {
    defaultLocale: seed.defaultLocale,
    locales: seed.locales,
    ...validateDetails(seed),
  });
  for (const locale of seed.locales) {
    writeJson(localeFile(dir, locale.code), seed.messages[locale.code] ?? {});
  }
  return id;
}

export function createWorkspace(
  id: unknown,
  locale: unknown,
  details: WorkspaceDetails = {},
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
  details: WorkspaceDetails,
): WorkspaceSummary {
  const changes = {
    description: validateDescription(details.description),
    type: validateType(details.type),
  };
  const manifest = updateManifest(id, (current) => {
    if ("description" in details) current.description = changes.description;
    if ("type" in details) current.type = changes.type;
  });
  return summaryOf(normalizeWorkspaceId(id), manifest);
}

export function renameWorkspace(id: string, newId: unknown): string {
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

export function addLocale(id: string, locale: unknown): AddedLocale {
  const entry = validateLocaleEntry(locale);
  const dir = workspaceDir(id);
  const manifest = readManifestAt(dir);
  const codes = manifest.locales.map((l) => l.code);
  const existing = findLocale(codes, entry.code);
  check(
    existing === undefined,
    409,
    "locale_exists",
    `Locale already exists: ${existing ?? entry.code}`,
  );
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
export function workspaceLocaleCode(
  manifest: WorkspaceManifest,
  code: unknown,
): string {
  const codes = manifest.locales.map((locale) => locale.code);
  const found = typeof code === "string" ? findLocale(codes, code) : undefined;
  if (found === undefined)
    fail(404, "unknown_locale", `Unknown locale: ${String(code)}`);
  return found;
}

export function removeLocale(id: string, code: unknown): void {
  const dir = workspaceDir(id);
  const manifest = readManifestAt(dir);
  const stored = workspaceLocaleCode(manifest, code);
  check(
    stored !== manifest.defaultLocale,
    409,
    "base_locale",
    "This is the base language: choose another base language before removing it",
  );
  const filePath = localeFile(dir, stored);
  if (existsSync(filePath)) unlinkSync(filePath);
  manifest.locales = manifest.locales.filter((l) => l.code !== stored);
  if (manifest.sources) delete manifest.sources[stored];
  writeManifestAt(dir, manifest);
}

export function setWorkspaceDefaultLocale(id: string, code: unknown): string {
  const dir = workspaceDir(id);
  const manifest = readManifestAt(dir);
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
  const locales = manifest.locales.map((locale) => locale.code);
  const messages: LocaleMessages = {};
  for (const code of locales) messages[code] = readJson(localeFile(dir, code));
  return {
    locales,
    baseLocale: manifest.defaultLocale,
    messages,
    reference: {},
    load: (code) => readJsonForWrite(localeFile(dir, code)),
    save: (code, data) => writeJson(localeFile(dir, code), data),
  };
}
