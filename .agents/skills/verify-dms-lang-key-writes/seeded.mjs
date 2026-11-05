#!/usr/bin/env node
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { REPO, SKILL, prepareCheckout, run } from "./scratch.mjs";

const all = readdirSync(join(SKILL, "seeded-breaks"))
  .filter((file) => file.endsWith(".patch"))
  .map((file) => basename(file, ".patch"));
/**
 * @param {string} name A break, `<rule>` or `<rule>--<what it does>`
 * @returns {string} The rule it breaks
 */
const ruleOf = (name) => name.split("--")[0] ?? name;
const wanted = process.argv.slice(2);
const unknown = wanted.filter((name) => !all.some((brk) => brk === name || ruleOf(brk) === name));
if (unknown.length > 0) {
  console.error(`no seeded break for ${unknown.join(", ")}; the breaks are ${all.join(", ")}`);
  process.exit(1);
}
const breaks = wanted.length === 0 ? all : all.filter((brk) => wanted.includes(brk) || wanted.includes(ruleOf(brk)));

/**
 * The rules the check reports `VIOLATED` on HEAD with a seeded break applied
 * (none for the control), each with its counterexample.
 *
 * @param {string | null} brk The break to apply, or null for the control
 * @returns {Map<string, string>} The counterexample of each violated rule
 */
function violationsWith(brk) {
  const dir = mkdtempSync(join(tmpdir(), `key-writes-${brk ?? "control"}-`));
  try {
    const added = run("git", ["worktree", "add", "--detach", dir, "HEAD"], REPO);
    if (added.status !== 0) throw new Error(added.stderr);
    if (brk !== null) {
      const applied = run("git", ["apply", join(SKILL, "seeded-breaks", `${brk}.patch`)], dir);
      if (applied.status !== 0) throw new Error(`${brk}.patch does not apply: ${applied.stderr}`);
    }
    const check = prepareCheckout(dir, true);
    const checked = run(process.execPath, [check], dirname(check));
    return new Map(
      [...checked.stdout.matchAll(/^VIOLATED (\S+)\n((?: {2}.*\n)*)/gm)].map((match) => [
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
if (control.size > 0) {
  console.error(`HEAD does not match record.json (${[...control.keys()].join(", ")}): run check.mjs and fix that first`);
  process.exit(1);
}
let missed = 0;
for (const brk of breaks) {
  const rule = ruleOf(brk);
  const broken = violationsWith(brk);
  const hit = broken.get(rule);
  const caught = hit !== undefined;
  if (!caught) missed++;
  console.log(`${caught ? "CAUGHT" : "MISSED"} ${brk}${caught ? "" : ` (violated: ${[...broken.keys()].join(", ") || "nothing"})`}`);
}
process.exitCode = missed === 0 ? 0 : 1;
