import { resolveWorkspaceId } from "../utils/catalog";
import { keyStoreOf, reviewStoreOf } from "../utils/key-stores";
import {
  createKey,
  deleteKey,
  type KeyStore,
  type LocaleTexts,
  markReviewed,
  previewStore,
  type RemovedOverride,
  removeOverride,
  renameKey,
  updateKey,
} from "../utils/keys";
import {
  type ImportedTexts,
  type ImportMode,
  importTexts,
} from "../utils/import-texts";
import { validateKeyPath } from "../utils/json";
import { findLocale } from "../utils/locale-codes";
import { assertEditable } from "../utils/workspaces";
import {
  announceWrite,
  countsBeforeWrite,
  recordBaseChange,
  recordChange,
  type WriteOptions,
  type Writer,
} from "./writer";

/** A key write: the workspace and key it went to, and the store as it was before it. */
export interface KeyWrite {
  workspace: string;
  key: string;
  store: KeyStore;
}

interface EditableStore {
  id: string;
  store: KeyStore;
  target: KeyStore;
}

function editableStore(
  workspace: string,
  options: WriteOptions,
  review = false,
): EditableStore {
  assertEditable();
  const id = resolveWorkspaceId(workspace);
  const store = review ? reviewStoreOf(id) : keyStoreOf(id);
  return { id, store, target: options.dryRun ? previewStore(store) : store };
}

function storeLocales(store: KeyStore, codes: string[]): string[] {
  return codes.flatMap((code) => findLocale(store.locales, code) ?? []);
}

function keyOf(path: string): string {
  return validateKeyPath(path).join(".");
}

export interface CreateKeyRequest {
  workspace: string;
  path: string;
  values: LocaleTexts;
  before?: string | null;
}

export function createKeyService(
  request: CreateKeyRequest,
  writer: Writer,
  options: WriteOptions = {},
): KeyWrite {
  const { id, store, target } = editableStore(request.workspace, options);
  const before = countsBeforeWrite(id, options);
  createKey(target, request.path, request.values, request.before);
  const key = keyOf(request.path);
  if (!options.dryRun) {
    announceWrite(writer, id, [key]);
    const locales = Object.entries(request.values)
      .filter(([, text]) => text !== null && text.trim() !== "")
      .map(([code]) => code);
    recordChange(
      writer,
      id,
      "key-created",
      { keys: [key], locales: storeLocales(store, locales) },
      before,
    );
  }
  return { workspace: id, key, store };
}

export interface UpdateKeyRequest {
  workspace: string;
  path: string;
  values: LocaleTexts;
  expected?: LocaleTexts;
}

export function updateKeyService(
  request: UpdateKeyRequest,
  writer: Writer,
  options: WriteOptions = {},
): KeyWrite {
  const { id, store, target } = editableStore(request.workspace, options);
  const before = countsBeforeWrite(id, options);
  const baseChange = updateKey(
    target,
    request.path,
    request.values,
    request.expected,
  );
  const key = keyOf(request.path);
  if (!options.dryRun) {
    announceWrite(writer, id, [key]);
    const change = recordChange(
      writer,
      id,
      "key-updated",
      {
        keys: [key],
        locales: storeLocales(store, Object.keys(request.values)),
      },
      before,
    );
    recordBaseChange(change, key, baseChange);
  }
  return { workspace: id, key, store };
}

export interface RenameKeyRequest {
  workspace: string;
  path: string;
  newPath: string;
}

export function renameKeyService(
  request: RenameKeyRequest,
  writer: Writer,
  options: WriteOptions = {},
): KeyWrite {
  const { id, store, target } = editableStore(request.workspace, options);
  const key = renameKey(target, request.path, request.newPath);
  const previousKey = keyOf(request.path);
  if (!options.dryRun) {
    announceWrite(writer, id, [previousKey, key]);
    recordChange(writer, id, "key-renamed", {
      keys: [key],
      previousKey,
      locales: store.locales,
    });
  }
  return { workspace: id, key, store };
}

export interface KeyRequest {
  workspace: string;
  path: string;
}

export function deleteKeyService(
  request: KeyRequest,
  writer: Writer,
  options: WriteOptions = {},
): KeyWrite {
  const { id, store, target } = editableStore(request.workspace, options);
  const before = countsBeforeWrite(id, options);
  deleteKey(target, request.path);
  const key = keyOf(request.path);
  if (!options.dryRun) {
    announceWrite(writer, id, [key]);
    recordChange(
      writer,
      id,
      "key-deleted",
      { keys: [key], locales: store.locales },
      before,
    );
  }
  return { workspace: id, key, store };
}

export interface KeyLocalesRequest extends KeyRequest {
  locales?: string[];
}

export interface OverrideRemoval extends KeyWrite {
  removed: RemovedOverride;
}

export function removeOverrideService(
  request: KeyLocalesRequest,
  writer: Writer,
  options: WriteOptions = {},
): OverrideRemoval {
  const { id, store, target } = editableStore(request.workspace, options);
  const before = countsBeforeWrite(id, options);
  const removed = removeOverride(target, request.path, request.locales);
  const key = keyOf(request.path);
  if (!options.dryRun) {
    announceWrite(writer, id, [key]);
    const change = recordChange(
      writer,
      id,
      "override-removed",
      { keys: [key], locales: removed.locales },
      before,
    );
    recordBaseChange(change, key, removed.baseChange);
  }
  return { workspace: id, key, store, removed };
}

export interface Reviewed extends KeyWrite {
  reviewed: string[];
}

export function markReviewedService(
  request: KeyLocalesRequest,
  writer: Writer,
  options: WriteOptions = {},
): Reviewed {
  const { id, store, target } = editableStore(request.workspace, options, true);
  const reviewed = markReviewed(target, request.path, request.locales);
  const key = keyOf(request.path);
  if (!options.dryRun) {
    announceWrite(writer, id, [key]);
    recordChange(writer, id, "reviewed", { keys: [key], locales: reviewed });
  }
  return { workspace: id, key, store, reviewed };
}

export interface ImportLanguageRequest {
  workspace: string;
  locale: string;
  texts: [string, string][];
  mode: ImportMode;
  createKeys: boolean;
}

export interface LanguageImport {
  workspace: string;
  store: KeyStore;
  imported: ImportedTexts;
}

/** Writes many texts of one language into an existing workspace (see {@link importTexts}). */
export function importLanguageService(
  request: ImportLanguageRequest,
  writer: Writer,
  options: WriteOptions = {},
): LanguageImport {
  const { id, store, target } = editableStore(request.workspace, options);
  const before = countsBeforeWrite(id, options);
  const imported = importTexts(
    target,
    request.locale,
    request.texts,
    request.mode,
    request.createKeys,
  );
  const keys = [...imported.written, ...imported.cleared];
  if (!options.dryRun && keys.length > 0) {
    announceWrite(writer, id, keys);
    recordChange(
      writer,
      id,
      "language-imported",
      { keys, locales: [imported.locale] },
      before,
    );
  }
  return { workspace: id, store, imported };
}
