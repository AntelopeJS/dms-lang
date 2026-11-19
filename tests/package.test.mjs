import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const REPOSITORY = fileURLToPath(new URL("..", import.meta.url));

const MANIFEST = z.object({
  name: z.string(),
  main: z.string(),
  types: z.string(),
  exports: z.object({
    ".": z.object({ types: z.string(), default: z.string() }),
  }),
  dmsFrontend: z.string(),
  publishConfig: z.object({ access: z.string() }),
  dependencies: z.record(z.string(), z.string()),
  antelopeJs: z.object({
    skills: z.array(z.string()),
    implements: z.array(z.string()),
  }),
});
const FRONTEND_MANIFEST = z.object({
  engines: z.record(z.string(), z.string()),
});

/**
 * @param {string} tarball The packed file
 * @param {string} file A path inside the package
 * @returns {string} The file's text
 */
function readPacked(tarball, file) {
  return spawnSync("tar", ["-xzOf", tarball, `package/${file}`], {
    encoding: "utf8",
  }).stdout;
}

/**
 * @param {string} folder Where the tarball goes
 * @returns {{ manifest: z.infer<typeof MANIFEST>, frontend: z.infer<typeof FRONTEND_MANIFEST>, files: string[] }} What `npm publish` would upload
 */
function pack(folder) {
  const packed = spawnSync(
    "npm",
    ["pack", "--ignore-scripts", "--silent", "--pack-destination", folder],
    {
      cwd: REPOSITORY,
      encoding: "utf8",
      shell: process.platform === "win32",
    },
  );
  assert.equal(packed.status, 0, packed.stderr);
  const tarball = join(folder, packed.stdout.trim().split("\n").at(-1) ?? "");
  const listed = spawnSync("tar", ["-tzf", tarball], { encoding: "utf8" });
  return {
    manifest: MANIFEST.parse(JSON.parse(readPacked(tarball, "package.json"))),
    frontend: FRONTEND_MANIFEST.parse(
      JSON.parse(readPacked(tarball, "frontend-vue/package.json")),
    ),
    files: listed.stdout
      .split("\n")
      .map((line) => line.replace(/^package\//, ""))
      .filter(Boolean),
  };
}

void describe("the package an app developer installs", () => {
  /** @type {string} */
  let folder;
  /** @type {ReturnType<typeof pack>} */
  let packed;

  before(() => {
    folder = mkdtempSync(join(tmpdir(), "dms-lang-pack-"));
    packed = pack(folder);
  });
  after(() => {
    rmSync(folder, { recursive: true, force: true });
  });

  void test("tarball-holds-what-the-manifest-points-at: every path the manifest names is in the tarball", () => {
    const { manifest, files } = packed;
    const targets = {
      main: manifest.main,
      types: manifest.types,
      "exports types": manifest.exports["."].types,
      "exports default": manifest.exports["."].default,
      dmsFrontend: manifest.dmsFrontend,
    };
    for (const [name, target] of Object.entries(targets))
      assert.ok(
        files.includes(target.replace(/^\.\//, "")),
        `${name} -> ${target} is not in the tarball`,
      );
  });

  void test("tarball-holds-what-the-manifest-points-at: the agent skill folder and the dashboard layer ship", () => {
    const { manifest, files, frontend } = packed;
    assert.deepEqual(manifest.antelopeJs.skills, ["./skills"]);
    for (const shipped of [
      "skills/dms-lang/SKILL.md",
      "frontend-vue/dms.frontend.ts",
      "frontend-vue/i18n/locales/lang-en-GB.json",
      "frontend-vue/i18n/locales/lang-fr-FR.json",
    ])
      assert.ok(files.includes(shipped), `${shipped} is not in the tarball`);
    assert.match(frontend.engines["@antelopejs/dms-frontend"] ?? "", />=/);
  });

  void test("tarball-holds-what-the-manifest-points-at: tests, build info and sources stay out of the tarball", () => {
    const { files } = packed;
    assert.deepEqual(
      files.filter((file) => file.startsWith("dist/test")),
      [],
    );
    assert.deepEqual(
      files.filter((file) => file.endsWith(".tsbuildinfo")),
      [],
    );
    assert.deepEqual(
      files.filter((file) => file.startsWith("src/")),
      [],
    );
  });

  void test("published-name-and-interface-ranges: declares its name, public access and the interfaces the installation page names", () => {
    const { manifest } = packed;
    assert.equal(manifest.name, "@antelopejs/dms-lang");
    assert.equal(manifest.publishConfig.access, "public");
    for (const name of [
      "@antelopejs/interface-dms",
      "@antelopejs/interface-api",
      "@antelopejs/interface-core",
    ])
      assert.ok(
        manifest.dependencies[name] !== undefined,
        `${name} is not a dependency`,
      );
    assert.deepEqual(manifest.antelopeJs.implements, []);
  });
});
