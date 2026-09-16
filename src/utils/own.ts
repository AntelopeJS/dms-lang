import {
  deleteAtPath,
  readJson,
  setAtPath,
  validateKeyPath,
  writeJson,
} from "./json";
import { getLocaleCodes, getOwnWriteTarget } from "./registry";
import { getValueAtPath } from "./tree";

export function upsertOwnKey(
  path: string,
  values: Record<string, unknown>,
  defaultLocale?: string,
): void {
  const segments = validateKeyPath(path);

  const targets = new Set(Object.keys(values));
  if (defaultLocale) targets.add(defaultLocale);

  for (const locale of targets) {
    const target = getOwnWriteTarget(locale);
    if (!target) continue;

    const isDefault = locale === defaultLocale;
    const hasValue = Object.hasOwn(values, locale);
    const value = values[locale];

    const data = readJson(target);
    if (hasValue && (value === null || value === "")) {
      if (isDefault) setAtPath(data, segments, "");
      else deleteAtPath(data, segments);
    } else if (hasValue) {
      setAtPath(data, segments, value);
    } else if (isDefault && getValueAtPath(data, path) === undefined) {
      setAtPath(data, segments, "");
    }
    writeJson(target, data);
  }
}

export function renameOwnKey(path: string, newPath: string): void {
  const from = validateKeyPath(path);
  const to = validateKeyPath(newPath);

  for (const locale of getLocaleCodes("own")) {
    const target = getOwnWriteTarget(locale);
    if (!target) continue;

    const data = readJson(target);
    const value = getValueAtPath(data, path);
    if (value === undefined) continue;

    deleteAtPath(data, from);
    setAtPath(data, to, value);
    writeJson(target, data);
  }
}

export function deleteOwnKey(path: string): void {
  const segments = validateKeyPath(path);

  for (const locale of getLocaleCodes("own")) {
    const target = getOwnWriteTarget(locale);
    if (!target) continue;

    const data = readJson(target);
    deleteAtPath(data, segments);
    writeJson(target, data);
  }
}
