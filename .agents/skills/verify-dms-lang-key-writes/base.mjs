#!/usr/bin/env node
import { prepareCheckout } from "./scratch.mjs";
import { spawnSync } from "node:child_process";

const check = prepareCheckout(process.cwd(), false);
const ran = spawnSync(process.execPath, [check], { stdio: "inherit" });
process.exitCode = ran.status ?? 1;
