export type TranslationValue = string | number | boolean | null | undefined;

export interface TreeItem {
  label: string;
  value: string;
  children?: TreeItem[];
  defaultExpanded?: boolean;
  trailingIcon?: string;
}

export interface LocaleMessages {
  [locale: string]: Record<string, unknown>;
}

export interface TranslationData {
  tree: TreeItem[];
  localeProgress: Record<string, number>;
  totalKeys: number;
}

interface NodeStats {
  keyCount: number;
  hasMissing: boolean;
}

const MISSING_ICON = "i-lucide-circle-alert";
export const PROGRESS_PRECISION_FACTOR = 10000;
export const FULL_PROGRESS = 100;

export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = Object.assign(
    Object.create(null),
    target,
  );

  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      result[key] = deepMerge(
        (result[key] || {}) as Record<string, unknown>,
        source[key] as Record<string, unknown>,
      );
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

export function getValueAtPath(
  obj: Record<string, unknown> | undefined,
  path: string,
): unknown {
  if (!obj || !path) return undefined;

  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current && typeof current === "object" && Object.hasOwn(current, key)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return current;
}

function isObject(value: unknown): boolean {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function analyzeNode(
  obj: Record<string, unknown>,
  prefix: string,
  localeMessages: LocaleMessages,
): NodeStats {
  let keyCount = 0;
  let hasMissing = false;

  for (const [key, value] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${key}` : key;

    if (isObject(value)) {
      const result = analyzeNode(
        value as Record<string, unknown>,
        fullPath,
        localeMessages,
      );
      keyCount += result.keyCount;
      hasMissing = hasMissing || result.hasMissing;
    } else {
      keyCount += 1;
      if (!hasMissing) {
        hasMissing = Object.values(localeMessages).some((messages) => {
          return isMissing(getValueAtPath(messages, fullPath));
        });
      }
    }
  }

  return { keyCount, hasMissing };
}

function buildTree(
  obj: Record<string, unknown>,
  localeMessages: LocaleMessages,
  prefix: string = "",
): TreeItem[] {
  return Object.entries(obj).map(([key, value]) => {
    const fullPath = prefix ? `${prefix}.${key}` : key;

    if (isObject(value)) {
      const { hasMissing } = analyzeNode(
        value as Record<string, unknown>,
        fullPath,
        localeMessages,
      );

      return {
        label: key,
        value: fullPath,
        children: buildTree(
          value as Record<string, unknown>,
          localeMessages,
          fullPath,
        ),
        defaultExpanded: false,
        trailingIcon: hasMissing ? MISSING_ICON : undefined,
      };
    }

    const hasMissing = Object.values(localeMessages).some((messages) => {
      return isMissing(getValueAtPath(messages, fullPath));
    });

    return {
      label: key,
      value: fullPath,
      trailingIcon: hasMissing ? MISSING_ICON : undefined,
    };
  });
}

function countExisting(
  localeObj: Record<string, unknown> | undefined,
  refObj: Record<string, unknown>,
): number {
  let count = 0;

  for (const [key, refValue] of Object.entries(refObj)) {
    const localeValue = localeObj?.[key];

    if (isObject(refValue)) {
      count += countExisting(
        localeValue as Record<string, unknown>,
        refValue as Record<string, unknown>,
      );
    } else if (!isMissing(localeValue)) {
      count += 1;
    }
  }

  return count;
}

function computeLocaleProgress(
  structureMessages: LocaleMessages,
  presenceMessages: LocaleMessages,
  defaultMessages: Record<string, unknown>,
  defaultLocaleCode: string,
  totalKeys: number,
): Record<string, number> {
  const localeCodes = new Set([
    ...Object.keys(structureMessages),
    ...Object.keys(presenceMessages),
  ]);

  const localeProgress: Record<string, number> = {};
  localeCodes.forEach((localeCode) => {
    if (localeCode === defaultLocaleCode) {
      localeProgress[localeCode] = FULL_PROGRESS;
      return;
    }
    const existing = countExisting(
      presenceMessages[localeCode],
      defaultMessages,
    );
    localeProgress[localeCode] =
      totalKeys > 0
        ? Math.round((existing / totalKeys) * PROGRESS_PRECISION_FACTOR) /
          FULL_PROGRESS
        : 0;
  });

  return localeProgress;
}

export function buildTranslationData(
  structureMessages: LocaleMessages,
  defaultLocaleCode: string,
  presenceMessages: LocaleMessages = structureMessages,
): TranslationData {
  const defaultMessages = structureMessages[defaultLocaleCode];

  if (!defaultMessages || Object.keys(defaultMessages).length === 0) {
    return {
      tree: [],
      localeProgress: {},
      totalKeys: 0,
    };
  }

  const tree = buildTree(defaultMessages, presenceMessages);
  const { keyCount: totalKeys } = analyzeNode(
    defaultMessages,
    "",
    presenceMessages,
  );
  const localeProgress = computeLocaleProgress(
    structureMessages,
    presenceMessages,
    defaultMessages,
    defaultLocaleCode,
    totalKeys,
  );

  return { tree, localeProgress, totalKeys };
}

export function extractTranslationsByPath(
  messages: LocaleMessages,
  path: string,
): Record<string, TranslationValue> {
  const translations: Record<string, TranslationValue> = {};

  Object.entries(messages).forEach(([localeCode, localeMessages]) => {
    const value = getValueAtPath(localeMessages, path);
    translations[localeCode] = isMissing(value)
      ? undefined
      : (value as TranslationValue);
  });

  return translations;
}

export function collectLeafPaths(tree: TreeItem[]): string[] {
  const paths: string[] = [];

  for (const node of tree) {
    if (node.children && node.children.length > 0) {
      paths.push(...collectLeafPaths(node.children));
    } else {
      paths.push(node.value);
    }
  }

  return paths;
}
