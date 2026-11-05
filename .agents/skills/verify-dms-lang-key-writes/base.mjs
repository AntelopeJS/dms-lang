#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import record from "./record.json" with { type: "json" };
import { prepareCheckout } from "./scratch.mjs";

/**
 * Runs the base's check on the base for `dms-control formal`, and reports as
 * `VIOLATED` every rule the base checks that this HEAD's `record.json` no
 * longer lists: HEAD reports no such rule, so the gate fails it as absent.
 */
const check = prepareCheckout(process.cwd(), false);
const ran = spawnSync(process.execPath, [check], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const output = ran.stdout ?? "";
const listed = new Set([...record.holds, ...record.violated]);
const dropped = [...output.matchAll(/^(?:HOLDS|KNOWN|VIOLATED) (\S+)$/gm)]
  .map((match) => match[1] ?? "")
  .filter((rule) => !listed.has(rule));
process.stdout.write(output);
for (const rule of dropped) process.stdout.write(`VIOLATED ${rule}\n  the base checks it; HEAD's record.json no longer lists it\n`);
process.stderr.write(ran.stderr ?? "");
process.exitCode = ran.status ?? 1;
