import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { markWritten } from "./cache";
import { check, type ErrorReason, fail } from "./errors";
import { isNumberOrBoolean, isString } from "./guards";
import type { WorkspaceManifest } from "./workspaces";

const NEW_SEGMENT_RE = /^[\w-]{1,128}$/;
const FORBIDDEN_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

export type NodeKind = "missing" | "leaf" | "branch";

/** A value `JSON.parse` returns. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | JsonObject;

/** A JSON object: a language file, or a namespace of keys in it. */
export interface JsonObject {
  [key: string]: JsonValue;
}

/** The segments of the path of a key that may already exist (module keys keep their own naming). */
export function validateKeyPath(path: string): string[] {
  const segments = path.split(".");
  check(
    path.length > 0 &&
      segments.every(
        (segment) =>
          segment.length > 0 &&
          segment.trim() === segment &&
          !FORBIDDEN_SEGMENTS.has(segment),
      ),
    "invalid_key_path",
    { path },
  );
  return segments;
}

/**
 * The segments of a path a key is created or renamed to: letters, digits, `_` and `-`,
 * at most 128 characters per segment, never `__proto__`, `prototype` or `constructor`.
 */
export function validateNewKeyPath(path: string): string[] {
  const segments = validateKeyPath(path);
  check(
    segments.every((segment) => NEW_SEGMENT_RE.test(segment)),
    "invalid_key_path",
    { path },
    "invalid_new_key_path",
  );
  return segments;
}

export function readJson(path: string): JsonObject {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as JsonObject;
  } catch {
    return {};
  }
}

function parseOrUndefined(text: string): JsonValue | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    return isJsonValue(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A file about to be rewritten: refuses to go on when it exists but is not a
 * JSON object, instead of wiping it. `reason` words the refusal.
 */
export function readJsonForWrite(
  path: string,
  reason: ErrorReason = "corrupt_file",
): JsonObject {
  if (!existsSync(path)) return {};
  const parsed = parseOrUndefined(readFileSync(path, "utf-8"));
  if (isJsonObject(parsed)) return parsed;
  return fail("server_error", { file: basename(path) }, reason);
}

interface JsonLayout {
  indent: string;
  lineEnd: string;
  hasFinalLineEnd: boolean;
}

const DEFAULT_LAYOUT: JsonLayout = {
  indent: "\t",
  lineEnd: "\n",
  hasFinalLineEnd: true,
};
const CRLF = "\r\n";
const INDENT_RE = /^[ \t]+(?=\S)/m;
const FINAL_LINE_END_RE = /\n$/;

/** How a file is laid out (indentation, CRLF or LF, final line end), to write it back the same way. */
function layoutOf(path: string): JsonLayout {
  if (!existsSync(path)) return DEFAULT_LAYOUT;
  const text = readFileSync(path, "utf-8");
  if (text.trim() === "") return DEFAULT_LAYOUT;
  return {
    indent: INDENT_RE.exec(text)?.[0] ?? DEFAULT_LAYOUT.indent,
    lineEnd: text.includes(CRLF) ? CRLF : DEFAULT_LAYOUT.lineEnd,
    hasFinalLineEnd: FINAL_LINE_END_RE.test(text),
  };
}

/** Writes a JSON file the way it was laid out (indentation, line ends), so a diff shows only what changed. */
export function writeJson(
  path: string,
  data: JsonValue | WorkspaceManifest,
): void {
  const layout = layoutOf(path);
  const body = JSON.stringify(data, null, layout.indent).replaceAll(
    "\n",
    layout.lineEnd,
  );
  const end = layout.hasFinalLineEnd ? layout.lineEnd : "";
  writeFileSync(path, `${body}${end}`, "utf-8");
  markWritten(path);
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** The prototypes of an object literal and of an object `JSON.parse` returns. */
const LITERAL_PROTOTYPES = new Set<unknown>([Object.prototype, null]);

/** Whether a value is made of JSON values only, as everything `JSON.parse` returns is. */
export function isJsonValue(value: unknown): value is JsonValue {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === null || isString(node) || isNumberOrBoolean(node)) continue;
    let children: unknown[];
    if (Array.isArray(node)) children = node;
    else if (
      isPlainObject(node) &&
      LITERAL_PROTOTYPES.has(Object.getPrototypeOf(node))
    )
      children = Object.values(node);
    else return false;
    for (const child of children) pending.push(child);
  }
  return true;
}

/** Whether a JSON value is an object: neither an array nor `null`. */
export function isJsonObject(
  value: JsonValue | undefined,
): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function childOf(
  node: JsonValue | undefined,
  segment: string,
): JsonValue | undefined {
  return isJsonObject(node) && Object.hasOwn(node, segment)
    ? node[segment]
    : undefined;
}

/** What sits at a path: nothing (or an empty object), a value, or a namespace of keys. */
export function nodeKindAt(
  data: JsonObject | undefined,
  segments: string[],
): NodeKind {
  const node = segments.reduce<JsonValue | undefined>(childOf, data);
  if (node === undefined) return "missing";
  if (!isJsonObject(node)) return "leaf";
  return Object.keys(node).length > 0 ? "branch" : "missing";
}

/** The first proper prefix of a path holding a value, which a key under it would overwrite. */
export function leafPrefixOf(
  data: JsonObject | undefined,
  segments: string[],
): string | undefined {
  let node: JsonValue | undefined = data;
  for (let depth = 0; depth < segments.length - 1; depth++) {
    node = childOf(node, segments[depth] ?? "");
    if (node === undefined) return undefined;
    if (!isJsonObject(node)) return segments.slice(0, depth + 1).join(".");
  }
  return undefined;
}

function defineEntry(node: JsonObject, name: string, value: JsonValue): void {
  Object.defineProperty(node, name, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

export function setAtPath(
  obj: JsonObject,
  segments: string[],
  value: JsonValue,
): void {
  const last = segments.at(-1);
  if (last === undefined) return;

  let current = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (seg === undefined) return;
    const existing = Object.hasOwn(current, seg) ? current[seg] : undefined;
    const child = isJsonObject(existing) ? existing : {};
    if (child !== existing) defineEntry(current, seg, child);
    current = child;
  }
  defineEntry(current, last, value);
}

/** Moves the property `name` of an object right before its property `before`. */
function moveBefore(node: JsonObject, name: string, before: string): void {
  const entries = Object.entries(node).filter(([entry]) => entry !== name);
  const index = entries.findIndex(([entry]) => entry === before);
  entries.splice(index, 0, [name, node[name]]);
  for (const entry of Object.keys(node)) Reflect.deleteProperty(node, entry);
  for (const [entry, value] of entries) defineEntry(node, entry, value);
}

/**
 * `name` and the names that follow it in the first of `objects` whose node at
 * `parent` holds it (just `name` when none does): the siblings a key put back
 * before `name` can stand before in a file that lacks `name`.
 */
export function namesFrom(
  objects: (JsonObject | undefined)[],
  parent: string[],
  name: string,
): string[] {
  const holder = objects
    .map((data) => parent.reduce<JsonValue | undefined>(childOf, data))
    .find((node) => isJsonObject(node) && Object.hasOwn(node, name));
  if (!isJsonObject(holder)) return [name];
  const names = Object.keys(holder);
  return names.slice(names.indexOf(name));
}

/**
 * Sets a value at a path, placed right before the first sibling of `before`
 * (a name, or names in order) the parent object holds, so an undone deletion
 * goes back to its place; at the end of the parent otherwise.
 */
export function insertAtPath(
  obj: JsonObject,
  segments: string[],
  value: JsonValue,
  before?: string | string[],
): void {
  setAtPath(obj, segments, value);
  const name = segments.at(-1);
  const parent = segments
    .slice(0, -1)
    .reduce<JsonValue | undefined>(childOf, obj);
  if (before === undefined || name === undefined || !isJsonObject(parent))
    return;
  const anchor = [before]
    .flat()
    .find((entry) => entry !== name && Object.hasOwn(parent, entry));
  if (anchor !== undefined) moveBefore(parent, name, anchor);
}

export function deleteAtPath(obj: JsonObject, segments: string[]): void {
  const last = segments.at(-1);
  if (last === undefined) return;

  const stack: Array<{ parent: JsonObject; key: string }> = [];
  let current = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (seg === undefined) return;
    const child = Object.hasOwn(current, seg) ? current[seg] : undefined;
    if (!isJsonObject(child)) return;
    stack.push({ parent: current, key: seg });
    current = child;
  }
  Reflect.deleteProperty(current, last);

  for (let i = stack.length - 1; i >= 0; i--) {
    const frame = stack[i];
    if (frame === undefined) break;
    const child = frame.parent[frame.key];
    if (isJsonObject(child) && Object.keys(child).length === 0) {
      Reflect.deleteProperty(frame.parent, frame.key);
    } else {
      break;
    }
  }
}
