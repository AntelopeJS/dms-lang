#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "../../..");
const wanted = process.argv.slice(2);
const patches = readdirSync(join(here, "seeded-breaks"))
  .filter((file) => file.endsWith(".patch"))
  .filter((file) => wanted.length === 0 || wanted.includes(basename(file, ".patch")));

/**
 * @param {string} program The program
 * @param {string[]} args Its arguments
 * @param {string} cwd Where it runs
 * @returns {import("node:child_process").SpawnSyncReturns<string>} The run
 */
function run(program, args, cwd) {
  return spawnSync(program, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/**
 * The rules the check reports violated on HEAD with a patch applied (none
 * for the control), each with its counterexample.
 *
 * @param {string | null} patch The patch file, or null for the control
 * @returns {Map<string, string>} The counterexample of each violated rule
 */
function violationsWith(patch) {
  const dir = mkdtempSync(join(tmpdir(), `key-writes-${patch ?? "control"}-`));
  try {
    const added = run("git", ["worktree", "add", "--detach", dir, "HEAD"], repo);
    if (added.status !== 0) throw new Error(added.stderr);
    if (patch !== null) {
      const applied = run("git", ["apply", join(here, "seeded-breaks", patch)], dir);
      if (applied.status !== 0) throw new Error(`${patch} does not apply: ${applied.stderr}`);
    }
    symlinkSync(join(repo, "node_modules"), join(dir, "node_modules"));
    const built = run(join(repo, "node_modules/.bin/tsc"), ["-p", "tsconfig.json"], dir);
    if (built.status !== 0) throw new Error(`${patch ?? "HEAD"} does not build: ${built.stdout}`);
    const skill = join(dir, relative(repo, here));
    rmSync(skill, { recursive: true, force: true });
    cpSync(here, skill, { recursive: true });
    const checked = run(process.execPath, [join(skill, "check.mjs")], skill);
    return new Map(
      [...checked.stdout.matchAll(/^VIOLATED (\S+)\n((?: {2}.*\n|[^HVc].*\n)*)/gm)].map((match) => [match[1] ?? "", match[2] ?? ""]),
    );
  } finally {
    run("git", ["worktree", "remove", "--force", dir], repo);
    rmSync(dir, { recursive: true, force: true });
  }
}

const control = violationsWith(null);
let missed = 0;
for (const patch of patches) {
  const rule = basename(patch, ".patch");
  const broken = violationsWith(patch);
  const hit = broken.get(rule);
  const caught = hit !== undefined && hit !== control.get(rule);
  if (!caught) missed++;
  console.log(`${caught ? "CAUGHT" : "MISSED"} ${rule}${caught ? "" : ` (violated: ${[...broken.keys()].join(", ") || "nothing"})`}`);
}
process.exitCode = missed === 0 ? 0 : 1;
