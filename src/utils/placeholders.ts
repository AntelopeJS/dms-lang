const PLACEHOLDER_PATTERN = /\{\s*([\w.-]+)\s*\}/g;

function placeholdersOf(text: unknown): Set<string> {
  const found = new Set<string>();
  if (typeof text !== "string") return found;
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) found.add(match[1]);
  return found;
}

/** Whether a translation drops a placeholder its base text uses. */
export function dropsPlaceholder(base: unknown, value: unknown): boolean {
  if (typeof value !== "string" || value === "") return false;
  const present = placeholdersOf(value);
  return [...placeholdersOf(base)].some((name) => !present.has(name));
}
