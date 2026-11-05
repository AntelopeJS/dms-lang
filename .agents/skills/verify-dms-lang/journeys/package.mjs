import { mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { guarded, parseJson, pick, readJsonFile, toRow } from "../lang.mjs";

/** @typedef {import("../lang.mjs").Ctx} Ctx */

/**
 * Packs the checkout the way `npm publish` would and reads the tarball back.
 *
 * @param {Ctx} ctx The journey
 * @returns {{ manifest: Record<string, unknown>, files: string[], frontend: Record<string, unknown> }} The packed manifest, the packed paths and the packed frontend manifest
 */
function packed(ctx) {
  const folder = mkdtempSync(join(tmpdir(), "dms-lang-pack-"));
  try {
    const pack = spawnSync("npm", ["pack", "--ignore-scripts", "--silent", "--pack-destination", folder], { cwd: ctx.state.repo ?? ".", encoding: "utf8" });
    const tarball = join(folder, pack.stdout.trim().split("\n").at(-1) ?? "");
    const listed = spawnSync("tar", ["-tzf", tarball], { encoding: "utf8" });
    const read = (/** @type {string} */ file) => spawnSync("tar", ["-xzOf", tarball, `package/${file}`], { encoding: "utf8" }).stdout;
    return {
      manifest: toRow(parseJson(read("package.json"))),
      frontend: toRow(parseJson(read("frontend-vue/package.json"))),
      files: listed.stdout.split("\n").map((line) => line.replace(/^package\//, "")).filter(Boolean),
    };
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/** What an app developer installs from the registry. */
export const journeys = guarded([
  {
    id: "tarball-holds-what-the-manifest-points-at",
    title: "the packed tarball holds the build, the dashboard layer and the agent skill, and every path the manifest names resolves inside it",
    entryPoint: "pnpm pack: main, types, exports, dmsFrontend and antelopeJs.skills of package.json",
    database: "shared",
    onboard: false,
    async run(/** @type {Ctx} */ ctx) {
      const { manifest, files, frontend } = packed(ctx);
      const exportsRoot = pick(manifest, "exports", ".");
      const targets = [
        ["main", manifest.main],
        ["types", manifest.types],
        ["exports types", pick(exportsRoot, "types")],
        ["exports default", pick(exportsRoot, "default")],
        ["dmsFrontend", manifest.dmsFrontend],
      ].map(([name, target]) => [String(name), String(target).replace(/^\.\//, "")]);
      await ctx.verify("every path the manifest points at is in the tarball", targets.map(([name, target]) => ctx.holds(`${name} -> ${target}`, files.includes(target), target)));
      const skillRoots = pick(manifest, "antelopeJs", "skills");
      await ctx.verify("the agent skill folder and the dashboard layer ship", [
        ctx.equal("antelopeJs.skills", skillRoots, ["./skills"]),
        ctx.holds("the skill file", files.includes("skills/dms-lang/SKILL.md"), files.filter((file) => file.startsWith("skills/")).join(", ")),
        ctx.holds("the dashboard entry", files.includes("frontend-vue/dms.frontend.ts"), files.filter((file) => file.startsWith("frontend-vue/")).slice(0, 5).join(", ")),
        ctx.holds("the module's own locale files", files.includes("frontend-vue/i18n/locales/lang-en-GB.json") && files.includes("frontend-vue/i18n/locales/lang-fr-FR.json"), files.filter((file) => file.includes("locales")).join(", ")),
        ctx.holds("the renderer range the dashboard layer declares", String(pick(frontend, "engines", "@antelopejs/dms-frontend")).includes(">="), JSON.stringify(pick(frontend, "engines"))),
      ]);
      await ctx.verify("tests, build info and sources stay out of the tarball", [
        ctx.equal("dist/test", files.filter((file) => file.startsWith("dist/test")), []),
        ctx.equal("tsbuildinfo", files.filter((file) => file.endsWith(".tsbuildinfo")), []),
        ctx.equal("src", files.filter((file) => file.startsWith("src/")), []),
      ]);
    },
  },
  {
    id: "published-name-and-interface-ranges",
    title: "the package declares its name, public access and the interface ranges the installation page names",
    entryPoint: "package.json",
    database: "shared",
    onboard: false,
    async run(/** @type {Ctx} */ ctx) {
      const manifest = readJsonFile(join(ctx.state.repo ?? ".", "package.json"));
      await ctx.verify("name, access and the interfaces the module depends on", [
        ctx.equal("name", pick(manifest, "name"), "@antelopejs/dms-lang"),
        ctx.equal("access", pick(manifest, "publishConfig", "access"), "public"),
        ctx.holds("interface-dms, interface-api and interface-core are dependencies", ["@antelopejs/interface-dms", "@antelopejs/interface-api", "@antelopejs/interface-core"].every((name) => pick(manifest, "dependencies", name) !== undefined), JSON.stringify(Object.keys(toRow(pick(manifest, "dependencies"))))),
        ctx.equal("implements nothing", pick(manifest, "antelopeJs", "implements"), []),
      ]);
    },
  },
]);
