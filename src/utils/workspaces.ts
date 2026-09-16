import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { resolve, sep } from "node:path";
import { assert } from "@antelopejs/interface-api-util";
import { getTranslationConfig } from "./config";
import {
  deleteAtPath,
  readJson,
  setAtPath,
  validateKeyPath,
  writeJson,
} from "./json";
import { getValueAtPath, type LocaleMessages } from "./tree";

export interface WorkspaceLocale {
  code: string;
  name?: string;
  flag?: string;
}

export interface WorkspaceManifest {
  defaultLocale: string;
  locales: WorkspaceLocale[];
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

export interface WorkspaceSummary {
  id: string;
  kind: WorkspaceKind;
  editable: boolean;
  defaultLocale: string;
  locales: WorkspaceLocale[];
}

const MANIFEST_FILE = ".workspace.json";
const WORKSPACE_ID_RE = /^[A-Z0-9][\w-]{0,63}$/i;
const RESERVED_IDS = new Set([
  DEFAULT_WORKSPACE,
  MODULES_WORKSPACE,
  ALL_WORKSPACE,
]);
const LOCALE_CODE_RE = /^[A-Z]{2,3}(?:[-_][A-Z0-9]{2,8})*$/i;

export function assertEditable(): void {
  assert(
    getTranslationConfig().editable,
    403,
    "i18n workspace editing is disabled",
  );
}

export function validateWorkspaceId(id: unknown): string {
  assert(
    typeof id === "string" && WORKSPACE_ID_RE.test(id),
    400,
    `Invalid workspace id: ${String(id)}`,
  );
  return id.toLowerCase();
}

export function validateLocaleCode(code: unknown): string {
  assert(
    typeof code === "string" && LOCALE_CODE_RE.test(code),
    400,
    `Invalid locale code: ${String(code)}`,
  );
  return code;
}

function getWorkspacesDir(): string {
  const dir = getTranslationConfig().workspacesDir;
  assert(dir, 500, "i18n workspaces directory is not configured");
  return dir;
}

function workspaceDir(id: string): string {
  const normalized = validateWorkspaceId(id);
  assert(
    !RESERVED_IDS.has(normalized),
    400,
    `"${normalized}" is a reserved workspace name`,
  );
  const root = resolve(getWorkspacesDir());
  const dir = resolve(root, normalized);
  assert(
    dir === root || dir.startsWith(root + sep),
    400,
    "Invalid workspace path",
  );
  return dir;
}

function manifestPath(id: string): string {
  return resolve(workspaceDir(id), MANIFEST_FILE);
}

function localeFilePath(id: string, code: string): string {
  validateLocaleCode(code);
  return resolve(workspaceDir(id), `${code}.json`);
}

function readManifest(id: string): WorkspaceManifest {
  const dir = workspaceDir(id);
  const localeCodes = readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("."))
    .map((f) => f.slice(0, -".json".length))
    .filter((code) => LOCALE_CODE_RE.test(code));

  const stored = existsSync(manifestPath(id))
    ? (readJson(manifestPath(id)) as Partial<WorkspaceManifest>)
    : {};

  const storedLocales = Array.isArray(stored.locales) ? stored.locales : [];
  const byCode = new Map(storedLocales.map((l) => [l.code, l]));

  const locales: WorkspaceLocale[] = localeCodes.map(
    (code) => byCode.get(code) ?? { code },
  );

  const defaultLocale =
    stored.defaultLocale && locales.some((l) => l.code === stored.defaultLocale)
      ? stored.defaultLocale
      : (locales[0]?.code ?? "");

  return { defaultLocale, locales };
}

export function listWorkspaces(): WorkspaceSummary[] {
  const root = getWorkspacesDir();
  if (!existsSync(root)) return [];

  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && WORKSPACE_ID_RE.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const manifest = readManifest(entry.name);
      return {
        id: entry.name,
        kind: "added" as const,
        editable: true,
        defaultLocale: manifest.defaultLocale,
        locales: manifest.locales,
      };
    });
}

export function loadWorkspaceMessages(id: string): LocaleMessages {
  const manifest = readManifest(id);
  const messages: LocaleMessages = {};
  for (const locale of manifest.locales) {
    messages[locale.code] = readJson(localeFilePath(id, locale.code));
  }
  return messages;
}

export function getWorkspaceManifest(id: string): WorkspaceManifest {
  return readManifest(id);
}

export function readWorkspaceLocale(
  id: string,
  code: string,
): Record<string, unknown> | null {
  const filePath = localeFilePath(id, code);
  if (!existsSync(filePath)) return null;
  return readJson(filePath);
}

export function createWorkspace(id: string, locale: WorkspaceLocale): void {
  const dir = workspaceDir(id);
  assert(!existsSync(dir), 409, `Workspace already exists: ${id}`);
  validateLocaleCode(locale.code);
  mkdirSync(dir, { recursive: true });
  writeJson(manifestPath(id), {
    defaultLocale: locale.code,
    locales: [locale],
  } satisfies WorkspaceManifest);
  writeJson(localeFilePath(id, locale.code), {});
}

export function renameWorkspace(id: string, newId: string): void {
  const from = workspaceDir(id);
  const to = workspaceDir(newId);
  assert(existsSync(from), 404, `Unknown workspace: ${id}`);
  assert(!existsSync(to), 409, `Workspace already exists: ${newId}`);
  renameSync(from, to);
}

export function deleteWorkspace(id: string): void {
  const dir = workspaceDir(id);
  assert(existsSync(dir), 404, `Unknown workspace: ${id}`);
  rmSync(dir, { recursive: true, force: true });
}

export function addLocale(id: string, locale: WorkspaceLocale): void {
  validateLocaleCode(locale.code);
  const filePath = localeFilePath(id, locale.code);
  assert(!existsSync(filePath), 409, `Locale already exists: ${locale.code}`);
  const manifest = readManifest(id);
  writeJson(filePath, {});
  manifest.locales.push(locale);
  if (!manifest.defaultLocale) manifest.defaultLocale = locale.code;
  writeJson(manifestPath(id), manifest);
}

export function removeLocale(id: string, code: string): void {
  validateLocaleCode(code);
  const filePath = localeFilePath(id, code);
  if (existsSync(filePath)) unlinkSync(filePath);

  const manifest = readManifest(id);
  manifest.locales = manifest.locales.filter((l) => l.code !== code);
  if (manifest.defaultLocale === code) {
    manifest.defaultLocale = manifest.locales[0]?.code ?? "";
  }
  writeJson(manifestPath(id), manifest);
}

export function setWorkspaceDefaultLocale(id: string, code: string): void {
  validateLocaleCode(code);
  assert(existsSync(workspaceDir(id)), 404, `Unknown workspace: ${id}`);
  const manifest = readManifest(id);
  assert(
    manifest.locales.some((l) => l.code === code),
    404,
    `Unknown locale: ${code}`,
  );
  manifest.defaultLocale = code;
  writeJson(manifestPath(id), manifest);
}

export function upsertKey(
  id: string,
  path: string,
  values: Record<string, unknown>,
): void {
  const segments = validateKeyPath(path);
  const manifest = readManifest(id);
  const known = new Set(manifest.locales.map((l) => l.code));

  const provided = Object.keys(values).filter((code) => known.has(code));
  const targets = new Set(provided);
  if (manifest.defaultLocale) targets.add(manifest.defaultLocale);

  for (const code of targets) {
    const isDefault = code === manifest.defaultLocale;
    const filePath = localeFilePath(id, code);
    const data = readJson(filePath);
    const hasValue = Object.hasOwn(values, code);
    const value = values[code];

    if (hasValue && (value === null || value === "")) {
      if (isDefault) setAtPath(data, segments, "");
      else deleteAtPath(data, segments);
    } else if (hasValue) {
      setAtPath(data, segments, value);
    } else if (isDefault && getValueAtPath(data, path) === undefined) {
      setAtPath(data, segments, "");
    }
    writeJson(filePath, data);
  }
}

export function renameKey(id: string, path: string, newPath: string): void {
  const from = validateKeyPath(path);
  const to = validateKeyPath(newPath);
  const manifest = readManifest(id);

  for (const locale of manifest.locales) {
    const filePath = localeFilePath(id, locale.code);
    const data = readJson(filePath);
    const value = getValueAtPath(data, path);
    if (value === undefined) continue;
    deleteAtPath(data, from);
    setAtPath(data, to, value);
    writeJson(filePath, data);
  }
}

export function deleteKey(id: string, path: string): void {
  const segments = validateKeyPath(path);
  const manifest = readManifest(id);

  for (const locale of manifest.locales) {
    const filePath = localeFilePath(id, locale.code);
    const data = readJson(filePath);
    deleteAtPath(data, segments);
    writeJson(filePath, data);
  }
}
