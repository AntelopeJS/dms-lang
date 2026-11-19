/**
 * @packageDocumentation
 * The e2e suite as the kit loads it: the config of `e2e/journeys.config.ts`,
 * its features and the journeys each exports, parsed at the import.
 */
import { existsSync, readdirSync } from "node:fs";
import { z } from "zod";
import config from "../../e2e/journeys.config.ts";

const REPOSITORY = new URL("../../", import.meta.url);
const JOURNEYS_DIR = new URL("e2e/journeys/", REPOSITORY);

const JOURNEYS_MODULE = z.object({
  journeys: z
    .array(
      z.object({
        id: z.string(),
        tag: z.union([z.string(), z.array(z.string())]).optional(),
      }),
    )
    .min(1),
});

/** The suite's config, as `e2e/journeys.config.ts` exports it. */
export { config };

/** @returns {boolean} Whether the playground the config names holds an `antelope.config.ts` */
export function playgroundExists() {
  return existsSync(
    new URL(`${config.playground}/antelope.config.ts`, REPOSITORY),
  );
}

/** @returns {string[]} The features of `e2e/journeys/`: the names of its `*.mjs` files */
export function features() {
  return readdirSync(JOURNEYS_DIR)
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => name.replace(/\.mjs$/, ""));
}

/**
 * @param {string} feature A feature of `e2e/journeys/`
 * @returns {Promise<z.infer<typeof JOURNEYS_MODULE>["journeys"] | undefined>} The journeys its module exports, or undefined when it exports none with ids
 */
export async function journeysOf(feature) {
  /** @type {unknown} */
  const module = await import(new URL(`${feature}.mjs`, JOURNEYS_DIR).href);
  return JOURNEYS_MODULE.safeParse(module).data?.journeys;
}
