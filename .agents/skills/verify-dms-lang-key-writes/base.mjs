#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { prepareCheckout } from "./scratch.mjs";

/**
 * Runs the base's check on the base for `dms-control formal`, with its known
 * findings printed as `VIOLATED`: the gate then fails a HEAD that no longer
 * reports one of them, and lists one HEAD reports holding as fixed.
 */
const check = prepareCheckout(process.cwd(), false);
const ran = spawnSync(process.execPath, [check], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
process.stdout.write((ran.stdout ?? "").replaceAll(/^KNOWN /gm, "VIOLATED "));
process.stderr.write(ran.stderr ?? "");
process.exitCode = ran.status ?? 1;
