#!/usr/bin/env node
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { REPO, SKILL, prepareCheckout, run } from "./scratch.mjs";

const all = readdirSync(join(SKILL, "seeded-breaks"))
  .filter((file) => file.endsWith(".patch"))
  .map((file) => basename(file, ".patch"));
const wanted = process.argv.slice(2);
const unknown = wanted.filter((rule) => !all.includes(rule));
if (unknown.length > 0) {
  console.error(`no seeded break for ${unknown.join(", ")}; the breaks are ${all.join(", ")}`);
  process.exit(1);
}
const rules = wanted.length === 0 ? all : wanted;

/**
 * The rules the check reports violated on HEAD with a seeded break applied
 * (none for the control), each with its counterexample.
 *
 * @param {string | null} rule The rule whose break to apply, or null for the control
 * @returns {Map<string, string>} The counterexample of each violated rule
 */
function violationsWith(rule) {
  const dir = mkdtempSync(join(tmpdir(), `key-writes-${rule ?? "control"}-`));
  try {
    const added = run("git", ["worktree", "add", "--detach", dir, "HEAD"], REPO);
    if (added.status !== 0) throw new Error(added.stderr);
    if (rule !== null) {
      const applied = run("git", ["apply", join(SKILL, "seeded-breaks", `${rule}.patch`)], dir);
      if (applied.status !== 0) throw new Error(`${rule}.patch does not apply: ${applied.stderr}`);
    }
    const check = prepareCheckout(dir);
    const checked = run(process.execPath, [check], dirname(check));
    return new Map(
      [...checked.stdout.matchAll(/^VIOLATED (\S+)\n((?: {2}.*\n|[^HVc].*\n)*)/gm)].map((match) => [
        match[1] ?? "",
        match[2] ?? "",
      ]),
    );
  } finally {
    run("git", ["worktree", "remove", "--force", dir], REPO);
    rmSync(dir, { recursive: true, force: true });
  }
}

const control = violationsWith(null);
let missed = 0;
for (const rule of rules) {
  const broken = violationsWith(rule);
  const hit = broken.get(rule);
  const caught = hit !== undefined && hit !== control.get(rule);
  if (!caught) missed++;
  console.log(`${caught ? "CAUGHT" : "MISSED"} ${rule}${caught ? "" : ` (violated: ${[...broken.keys()].join(", ") || "nothing"})`}`);
}
process.exitCode = missed === 0 ? 0 : 1;
