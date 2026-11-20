import { check } from "./errors";
import {
  deleteAtPath,
  insertAtPath,
  setAtPath,
  validateKeyPath,
  validateNewKeyPath,
} from "./json";
import {
  assertFreePath,
  assertWritable,
  countTexts,
  currentText,
  hasBranch,
  hasLeaf,
  type KeyChange,
  type KeyStore,
  storeLocale,
  textOf,
} from "./keys";
import { messageIssues } from "./message-syntax";
import { leafPaths } from "./tree";

/** How an import treats the texts a language already has. */
export type ImportMode = "merge" | "fillMissing" | "replace";

/** What an import of one language's texts wrote, or would write. */
export interface ImportedTexts {
  locale: string;
  written: string[];
  unchanged: number;
  cleared: string[];
  created: string[];
  skipped: string[];
}

type PlannedText = [key: string, text: string | null];

function importedTexts(entries: [string, string][]): Map<string, string> {
  const texts = new Map<string, string>();
  for (const [path, value] of entries) {
    const text = textOf(value);
    if (text !== null) texts.set(validateKeyPath(path).join("."), text);
  }
  return texts;
}

function assertImportSyntax(locale: string, texts: Map<string, string>): void {
  const invalid = [...texts]
    .filter(([, text]) => messageIssues(text).length > 0)
    .map(([key]) => key);
  check(invalid.length === 0, "invalid_message", { locale, keys: invalid });
}

function clearedKeys(
  store: KeyStore,
  locale: string,
  texts: Map<string, string>,
): string[] {
  const cleared = leafPaths(store.messages[locale] ?? {}).filter(
    (key) =>
      !texts.has(key) && currentText(store.messages[locale], key) !== null,
  );
  const last = cleared.filter(
    (key) =>
      countTexts(store.messages, key) === 1 &&
      !hasLeaf(store.reference, key.split(".")),
  );
  check(last.length === 0, "last_value", { locale, keys: last });
  return cleared;
}

function applyPlanned(
  store: KeyStore,
  locale: string,
  planned: PlannedText[],
): void {
  const groups = new Map<string, PlannedText[]>();
  for (const entry of planned) {
    const file = store.fileOf?.(locale, entry[0].split(".")) ?? locale;
    groups.set(file, [...(groups.get(file) ?? []), entry]);
  }
  for (const entries of groups.values()) {
    const first = entries[0]?.[0].split(".") ?? [];
    const data = store.load(locale, first);
    for (const [key, text] of entries) {
      if (text === null) deleteAtPath(data, key.split("."));
      else insertAtPath(data, key.split("."), text);
    }
    store.save(locale, data, first);
  }
}

function trackPlanned(
  store: KeyStore,
  locale: string,
  planned: PlannedText[],
): void {
  const next = structuredClone(store.messages);
  next[locale] ??= {};
  for (const [key, text] of planned) {
    if (text === null) deleteAtPath(next[locale], key.split("."));
    else setAtPath(next[locale], key.split("."), text);
  }
  const changes = planned.map(([path, text]): KeyChange => ({
    path,
    texts: { [locale]: text },
    messages: next,
  }));
  if (store.trackAll) store.trackAll(changes);
  else for (const change of changes) store.track?.(change);
}

/**
 * Writes many texts of one language, each file loaded and saved once and the
 * review tracking recorded once. Every text is checked before anything is
 * written: one that does not compile, a key that clashes or, with `replace`,
 * a text that is the last of its key fails the whole import. Keys the store
 * lacks are skipped, or created with `createKeys`.
 */
export function importTexts(
  store: KeyStore,
  code: string,
  entries: [string, string][],
  mode: ImportMode,
  createKeys: boolean,
): ImportedTexts {
  const locale = storeLocale(store, code);
  const texts = importedTexts(entries);
  assertImportSyntax(locale, texts);
  const result: ImportedTexts = {
    locale,
    written: [],
    unchanged: 0,
    cleared: [],
    created: [],
    skipped: [],
  };
  const growing = structuredClone(store.messages);
  const planned: PlannedText[] = [];
  for (const [key, text] of texts) {
    const segments = key.split(".");
    if (
      hasLeaf(store.messages, segments) ||
      hasLeaf(store.reference, segments)
    ) {
      const own = currentText(store.messages[locale], key);
      const shown = own ?? currentText(store.reference[locale], key);
      if (own === text || (mode === "fillMissing" && shown !== null)) {
        result.unchanged += 1;
        continue;
      }
      assertWritable(store, segments, { [locale]: text });
      result.written.push(key);
    } else {
      check(
        !hasBranch(store.messages, segments) &&
          !hasBranch(store.reference, segments),
        "not_a_key",
        { path: key },
      );
      if (!createKeys) {
        result.skipped.push(key);
        continue;
      }
      validateNewKeyPath(key);
      assertFreePath(growing, store.reference, segments);
      growing[locale] ??= {};
      setAtPath(growing[locale], segments, text);
      result.created.push(key);
      result.written.push(key);
    }
    planned.push([key, text]);
  }
  if (mode === "replace") {
    result.cleared = clearedKeys(store, locale, texts);
    for (const key of result.cleared) planned.push([key, null]);
  }
  if (planned.length === 0) return result;
  applyPlanned(store, locale, planned);
  trackPlanned(store, locale, planned);
  return result;
}
