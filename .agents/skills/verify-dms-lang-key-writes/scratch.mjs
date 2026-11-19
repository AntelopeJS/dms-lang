import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync, symlinkSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** This skill's folder in the checkout that runs it. */
export const SKILL = dirname(fileURLToPath(import.meta.url));

/** The root of the checkout that runs this skill. */
export const REPO = join(SKILL, "../../..");

/** The folder of the check in the checkout that runs this skill. */
const CHECKER = join(REPO, "tests/key-writes");

/**
 * @param {string} program The program
 * @param {string[]} args Its arguments
 * @param {string} cwd Where it runs
 * @returns {import("node:child_process").SpawnSyncReturns<string>} The run
 */
export function run(program, args, cwd) {
  return spawnSync(program, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/**
 * Makes another checkout of the repository ready for this check: links this
 * checkout's `node_modules` when it has none, builds its `src/` to `dist/`,
 * and, when `replace` is set or it has no copy of the check, puts this
 * checkout's check in it.
 *
 * @param {string} dir The other checkout's root
 * @param {boolean} replace Whether to run this checkout's check rather than the other checkout's own
 * @returns {string} The path of the check in it
 */
export function prepareCheckout(dir, replace) {
  if (!existsSync(join(dir, "node_modules"))) symlinkSync(join(REPO, "node_modules"), join(dir, "node_modules"));
  const built = run(join(REPO, "node_modules/.bin/tsc"), ["-p", "tsconfig.json"], dir);
  if (built.status !== 0) throw new Error(`${dir} does not build:\n${built.stdout}`);
  const checker = join(dir, relative(REPO, CHECKER));
  if (!replace && existsSync(join(checker, "check.mjs"))) return join(checker, "check.mjs");
  rmSync(checker, { recursive: true, force: true });
  cpSync(CHECKER, checker, { recursive: true });
  return join(checker, "check.mjs");
}
