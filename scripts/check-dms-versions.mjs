/**
 * @packageDocumentation
 * The playground runs the DMS release the module is developed against: the
 * range of its `dms` source follows the module's own dev dependency. Prints
 * the mismatch only; exits 1 when there is one.
 */
import { readFileSync } from "node:fs";
import { z } from "zod";

/** @param {string} path */
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const DMS_SOURCE =
  /package:\s*"@antelopejs\/dms",\s*version:\s*"(?<range>[^"]+)"/;

const MANIFEST = z.object({
  devDependencies: z.object({ "@antelopejs/dms": z.string().optional() }),
});

const { devDependencies } = MANIFEST.parse(JSON.parse(read("../package.json")));
const required = devDependencies["@antelopejs/dms"];
const loaded = DMS_SOURCE.exec(read("../playground/antelope.config.ts"))?.groups
  ?.range;
if (loaded !== required) {
  console.error(
    `playground/antelope.config.ts: loads @antelopejs/dms ${loaded}, the module requires ${required}`,
  );
  process.exitCode = 1;
}
