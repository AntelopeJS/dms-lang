import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const REPOSITORY = fileURLToPath(new URL("..", import.meta.url));
const MINUTE_MS = 60_000;

void test(
  "feature-map: the feature map of the verification skill matches the code",
  { timeout: MINUTE_MS },
  () => {
    const map = spawnSync("pnpm", ["exec", "dms-control", "map"], {
      cwd: REPOSITORY,
      encoding: "utf8",
    });
    assert.equal(map.status, 0, `${map.stdout}${map.stderr}`);
  },
);
