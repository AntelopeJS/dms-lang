import { basename } from "node:path";
import { isPlainObject, nodeKindAt } from "./json";

/** A project file of one locale, with what it holds. */
export interface LocaleFile {
  path: string;
  data: Record<string, unknown>;
}

/** The name prefix of the project file a key no other file claims is written to. */
export const DEFAULT_FILE_PREFIX = "app-";

/** How many leading segments of a key are a namespace the file already holds. */
function namespaceDepth(
  data: Record<string, unknown>,
  segments: string[],
): number {
  let node: unknown = data;
  let depth = 0;
  for (const segment of segments.slice(0, -1)) {
    node =
      isPlainObject(node) && Object.hasOwn(node, segment)
        ? node[segment]
        : undefined;
    if (!isPlainObject(node)) break;
    depth++;
  }
  return depth;
}

/** The last file of the list for which `score` is the highest, undefined when every score is 0. */
function bestFile(
  files: LocaleFile[],
  score: (file: LocaleFile) => number,
): LocaleFile | undefined {
  let best: LocaleFile | undefined;
  let bestScore = 0;
  for (const file of files) {
    const fileScore = score(file);
    if (fileScore > 0 && fileScore >= bestScore) {
      best = file;
      bestScore = fileScore;
    }
  }
  return best;
}

/**
 * The project file a key of one locale is written to, `files` in merge order
 * (a later file wins over an earlier one), undefined when there is none:
 * 1. the file that defines the key (the last one when several do, the one
 *    whose value shows);
 * 2. else the file holding the longest namespace of the key (`helio.crm` for
 *    `helio.crm.title`), the last one on a tie;
 * 3. else the last `app-*` file;
 * 4. else the last file.
 */
export function writeTargetOf(
  files: LocaleFile[],
  segments: string[],
): string | undefined {
  const defining = files.findLast(
    (file) => nodeKindAt(file.data, segments) === "leaf",
  );
  const nearest = bestFile(files, (file) =>
    namespaceDepth(file.data, segments),
  );
  const fallback =
    files.findLast((file) =>
      basename(file.path).startsWith(DEFAULT_FILE_PREFIX),
    ) ?? files.at(-1);
  return (defining ?? nearest ?? fallback)?.path;
}
