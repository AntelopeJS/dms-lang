import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// The playground runs the DMS release the module is developed against: the
// range of its `dms` source follows the module's own dev dependency.

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const DMS_SOURCE =
  /package:\s*"@antelopejs\/dms",\s*version:\s*"(?<range>[^"]+)"/;

test("the playground loads the DMS release the module requires", () => {
  const { devDependencies } = JSON.parse(read("../package.json"));
  const config = read("../playground/antelope.config.ts");
  assert.equal(
    DMS_SOURCE.exec(config)?.groups?.range,
    devDependencies["@antelopejs/dms"],
  );
});
