import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { markWritten } from "./cache";
import { check, type ErrorReason, fail } from "./errors";

const NEW_SEGMENT_RE = /^[\w-]{1,128}$/;
const FORBIDDEN_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

export type NodeKind = "missing" | "leaf" | "branch";

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

export function readJson(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseOrUndefined(text: string): unknown {
  try {
    return JSON.parse(text);
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
): Record<string, unknown> {
  if (!existsSync(path)) return {};
  const parsed = parseOrUndefined(readFileSync(path, "utf-8"));
  if (isPlainObject(parsed)) return parsed;
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
export function writeJson(path: string, data: unknown): void {
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

function childOf(node: unknown, segment: string): unknown {
  return isPlainObject(node) && Object.hasOwn(node, segment)
    ? node[segment]
    : undefined;
}

/** What sits at a path: nothing (or an empty object), a value, or a namespace of keys. */
export function nodeKindAt(
  data: Record<string, unknown> | undefined,
  segments: string[],
): NodeKind {
  const node = segments.reduce<unknown>(childOf, data);
  if (node === undefined) return "missing";
  if (!isPlainObject(node)) return "leaf";
  return Object.keys(node).length > 0 ? "branch" : "missing";
}

/** The first proper prefix of a path holding a value, which a key under it would overwrite. */
export function leafPrefixOf(
  data: Record<string, unknown> | undefined,
  segments: string[],
): string | undefined {
  let node: unknown = data;
  for (let depth = 0; depth < segments.length - 1; depth++) {
    node = childOf(node, segments[depth] ?? "");
    if (node === undefined) return undefined;
    if (!isPlainObject(node)) return segments.slice(0, depth + 1).join(".");
  }
  return undefined;
}

function defineEntry(
  node: Record<string, unknown>,
  name: string,
  value: unknown,
): void {
  Object.defineProperty(node, name, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

export function setAtPath(
  obj: Record<string, unknown>,
  segments: string[],
  value: unknown,
): void {
  const last = segments.at(-1);
  if (last === undefined) return;

  let current = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (seg === undefined) return;
    const existing = Object.hasOwn(current, seg) ? current[seg] : undefined;
    const child = isPlainObject(existing) ? existing : {};
    if (child !== existing) defineEntry(current, seg, child);
    current = child;
  }
  defineEntry(current, last, value);
}

/** Moves the property `name` of an object right before its property `before`. */
function moveBefore(
  node: Record<string, unknown>,
  name: string,
  before: string,
): void {
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
  objects: (Record<string, unknown> | undefined)[],
  parent: string[],
  name: string,
): string[] {
  const holder = objects
    .map((data) => parent.reduce<unknown>(childOf, data))
    .find((node) => isPlainObject(node) && Object.hasOwn(node, name));
  if (!isPlainObject(holder)) return [name];
  const names = Object.keys(holder);
  return names.slice(names.indexOf(name));
}

/**
 * Sets a value at a path, placed right before the first sibling of `before`
 * (a name, or names in order) the parent object holds, so an undone deletion
 * goes back to its place; at the end of the parent otherwise.
 */
export function insertAtPath(
  obj: Record<string, unknown>,
  segments: string[],
  value: unknown,
  before?: string | string[],
): void {
  setAtPath(obj, segments, value);
  const name = segments.at(-1);
  const parent = segments.slice(0, -1).reduce<unknown>(childOf, obj);
  if (before === undefined || name === undefined || !isPlainObject(parent))
    return;
  const anchor = [before]
    .flat()
    .find((entry) => entry !== name && Object.hasOwn(parent, entry));
  if (anchor !== undefined) moveBefore(parent, name, anchor);
}

export function deleteAtPath(
  obj: Record<string, unknown>,
  segments: string[],
): void {
  const last = segments.at(-1);
  if (last === undefined) return;

  const stack: Array<{ parent: Record<string, unknown>; key: string }> = [];
  let current = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (seg === undefined) return;
    const child = Object.hasOwn(current, seg) ? current[seg] : undefined;
    if (!isPlainObject(child)) return;
    stack.push({ parent: current, key: seg });
    current = child;
  }
  Reflect.deleteProperty(current, last);

  for (let i = stack.length - 1; i >= 0; i--) {
    const frame = stack[i];
    if (frame === undefined) break;
    const child = frame.parent[frame.key];
    if (isPlainObject(child) && Object.keys(child).length === 0) {
      Reflect.deleteProperty(frame.parent, frame.key);
    } else {
      break;
    }
  }
}
