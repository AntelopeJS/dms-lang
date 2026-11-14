/**
 * @packageDocumentation
 * Every `Dms*` or `dms-*` tag in the Vue layer names a component that the
 * installed DMS registers, or one this module registers under `DmsLang`.
 * Vue renders an unknown tag as nothing and no build step fails on it, so a
 * DMS release that renames a component would blank a screen silently. Prints
 * the unknown tags only; exits 1 when there are any.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DMS_LAYERS = join(
  ROOT,
  "node_modules/@antelopejs/dms/frontend-vue/layers",
);
const MODULE_APP = join(ROOT, "frontend-vue/app");
const PLAYGROUND_APP = join(ROOT, "playground/frontend-vue");

/** Names the DMS registers a second time, from `COMPONENT_ALIASES` in its `dms.frontend.ts`. */
const DMS_ALIASES = ["ActivityFeedBlock", "SectionBlock", "FieldRowBlock"];

/** @param {string} directory */
function vueFiles(directory) {
  return readdirSync(directory, { recursive: true, encoding: "utf8" })
    .map((path) => path.replaceAll(sep, "/"))
    .filter(
      (path) =>
        path.endsWith(".vue") && !path.split("/").includes("node_modules"),
    )
    .map((path) => `${directory.replaceAll(sep, "/")}/${path}`);
}

/** @param {string} path */
function pascalName(path) {
  return (path.split("/").at(-1) ?? path)
    .replace(/\.vue$/, "")
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase()}${part.slice(1)}`)
    .join("");
}

/** @param {string} path */
function isRegistered(path) {
  return /\/(?:build\/)?components\//.test(path);
}

const known = new Set([
  ...vueFiles(DMS_LAYERS)
    .filter(isRegistered)
    .map((path) => `Dms${pascalName(path)}`),
  ...DMS_ALIASES.map((name) => `Dms${name}`),
  ...vueFiles(MODULE_APP)
    .filter(isRegistered)
    .map((path) => `DmsLang${pascalName(path)}`),
]);

const TAG = /<(Dms[A-Z][\w]*|dms-[a-z][a-z0-9-]*)(?=[\s/>])/g;

const unknown = [MODULE_APP, PLAYGROUND_APP].flatMap((directory) =>
  vueFiles(directory).flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(TAG)]
      .map((match) => match[1] ?? "")
      .filter(
        (tag) => !known.has(tag.startsWith("dms-") ? pascalName(tag) : tag),
      )
      .map(
        (tag) =>
          `${relative(ROOT, file)}: <${tag}> is no component the DMS or this module registers`,
      ),
  ),
);

if (unknown.length > 0) {
  console.error([...new Set(unknown)].join("\n"));
  process.exitCode = 1;
}
