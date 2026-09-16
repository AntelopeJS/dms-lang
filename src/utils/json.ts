import { readFileSync, writeFileSync } from "node:fs";
import { assert } from "@antelopejs/interface-api-util";

const KEY_SEGMENT_RE = /^[^.\s][^.]*$/;

export function validateKeyPath(path: unknown): string[] {
  assert(typeof path === "string" && path.length > 0, 400, "Missing key path");
  const segments = path.split(".");
  assert(
    segments.every((seg) => KEY_SEGMENT_RE.test(seg)),
    400,
    `Invalid key path: ${path}`,
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

export function writeJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, "\t")}\n`, "utf-8");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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
    if (!Object.hasOwn(current, seg) || !isPlainObject(current[seg])) {
      Object.defineProperty(current, seg, {
        value: {},
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    current = current[seg] as Record<string, unknown>;
  }
  Object.defineProperty(current, last, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
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
    if (
      seg === undefined ||
      !Object.hasOwn(current, seg) ||
      !isPlainObject(current[seg])
    )
      return;
    stack.push({ parent: current, key: seg });
    current = current[seg] as Record<string, unknown>;
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
