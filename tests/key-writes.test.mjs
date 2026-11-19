import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const CHECK = fileURLToPath(new URL("./key-writes/check.mjs", import.meta.url));
const FIVE_MINUTES_MS = 300_000;
const OUTPUT_LIMIT_BYTES = 64 * 1024 * 1024;

void test(
  "key-writes: every key write the API accepts on the project files lands in the file the docs name, for every set of up to two locale files",
  { timeout: FIVE_MINUTES_MS },
  () => {
    const run = spawnSync(process.execPath, [CHECK], {
      encoding: "utf8",
      maxBuffer: OUTPUT_LIMIT_BYTES,
    });
    const violated = run.stdout
      .split("\n")
      .filter((line) => line.startsWith("VIOLATED"));
    assert.deepEqual(violated, [], run.stdout);
    assert.equal(
      run.status,
      0,
      `the check disagrees with its record.json:\n${run.stdout}${run.stderr}`,
    );
  },
);
