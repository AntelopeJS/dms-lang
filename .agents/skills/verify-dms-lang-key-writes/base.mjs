#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import record from "./record.json" with { type: "json" };
import { prepareCheckout } from "./scratch.mjs";

/**
 * Runs the base's check on the base for `dms-control formal`, then adds a
 * `VIOLATED` line, under a name HEAD never reports so the gate fails it as
 * absent, for each way HEAD's `record.json` hides a regression from the gate:
 * a rule the base checks that it no longer lists (`<rule>`), a rule the base
 * holds or fails less that it records as failing more (`RecordedRegression.<rule>`),
 * and a base that cannot be checked (`BaseChecked`).
 */
let check = "";
try {
  check = prepareCheckout(process.cwd(), false);
} catch (error) {
  process.stdout.write(`VIOLATED BaseChecked\n  the base cannot be checked: ${String(error).split("\n")[0]}\n`);
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
}
const ran = spawnSync(process.execPath, [check], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const output = ran.stdout ?? "";
/** @type {Map<string, number>} */
const recorded = new Map(Object.entries(record.violated));
const listed = new Set([...record.holds, ...recorded.keys()]);
/** @type {Map<string, { verdict: string, count: number | undefined }>} */
const atBase = new Map();
let current = "";
for (const line of output.split("\n")) {
  const rule = /^(HOLDS|KNOWN|VIOLATED) (\S+)$/.exec(line);
  if (rule) {
    current = rule[2] ?? "";
    atBase.set(current, { verdict: rule[1] ?? "", count: rule[1] === "HOLDS" ? 0 : undefined });
    continue;
  }
  const cases = /^ {2}(\d+) failing cases$/.exec(line);
  const entry = atBase.get(current);
  if (cases && entry) entry.count = Number(cases[1]);
}
/** @type {string[]} */
const added = [];
for (const [rule, base] of atBase) {
  const atHead = recorded.get(rule);
  if (!listed.has(rule)) added.push(`VIOLATED ${rule}\n  the base checks it; HEAD's record.json no longer lists it`);
  else if (atHead !== undefined && base.count !== undefined && atHead > base.count)
    added.push(`VIOLATED RecordedRegression.${rule}\n  HEAD's record.json gives ${rule} ${atHead} failing cases, the base ${base.count}`);
}
process.stdout.write(output);
for (const line of added) process.stdout.write(`${line}\n`);
process.stderr.write(ran.stderr ?? "");
process.exitCode = ran.status ?? 1;
