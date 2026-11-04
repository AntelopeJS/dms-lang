import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { backendBoundary } from "../frontend-vue/build/backend-boundary.ts";

/** The Vite of the DMS renderer, the one that builds the frontend module. */
const renderer = realpathSync(
  fileURLToPath(
    new URL(
      "../node_modules/@antelopejs/dms-frontend/package.json",
      import.meta.url,
    ),
  ),
);
registerHooks({
  resolve: (specifier, context, next) =>
    next(
      specifier,
      specifier === "vite"
        ? { ...context, parentURL: pathToFileURL(renderer).href }
        : context,
    ),
});
const { build: viteBuild } = await import("vite");

/** A scratch repository: the backend package with its frontend module inside, and another package. */
/** @type {string} */
let repository;
/** @type {string} */
let frontend;

/**
 * @param {string} file
 * @param {string} text
 */
function write(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
}

before(() => {
  repository = realpathSync(mkdtempSync(join(tmpdir(), "dms-lang-boundary-")));
  const backend = join(repository, "dms-lang");
  frontend = join(backend, "frontend-vue");
  write(
    join(backend, "package.json"),
    JSON.stringify({ name: "@antelopejs/dms-lang" }),
  );
  write(join(backend, "src/backend.ts"), "export const secret = 1\n");
  write(join(backend, "src/nested/deep.ts"), "export const deep = 6\n");
  write(join(backend, "dist/built.js"), "export const built = 2\n");
  write(join(backend, "dist/src/nested.js"), "export const nested = 4\n");
  write(join(backend, "srcx/sibling.ts"), "export const sibling = 5\n");
  write(
    join(repository, "other/package.json"),
    JSON.stringify({ name: "other" }),
  );
  write(join(repository, "other/src/shared.ts"), "export const shared = 3\n");
  mkdirSync(frontend, { recursive: true });
  symlinkSync(join(backend, "src/backend.ts"), join(frontend, "linked.ts"));
});

after(() => {
  rmSync(repository, { recursive: true, force: true });
});

/** @typedef {{ extra?: import("vite").Plugin[], alias?: { [name: string]: string }, preserveSymlinks?: boolean, external?: string[] }} BuildOptions */

/**
 * Builds a frontend entry made of `source` with the boundary plugin, and returns the bundled code.
 *
 * @param {string} source
 * @param {BuildOptions} [options]
 */
async function build(source, options = {}) {
  write(join(frontend, "entry.ts"), source);
  const result = await viteBuild({
    root: frontend,
    configFile: false,
    logLevel: "silent",
    plugins: [backendBoundary(), ...(options.extra ?? [])],
    resolve: {
      alias: options.alias ?? {},
      preserveSymlinks: options.preserveSymlinks ?? false,
    },
    build: {
      write: false,
      rollupOptions: { external: options.external ?? [] },
      lib: { entry: join(frontend, "entry.ts"), formats: ["es"] },
    },
  });
  return JSON.stringify(result);
}

/**
 * A plugin that answers the import `request` with the module id `id`.
 *
 * @param {string} request
 * @param {string} id
 * @returns {import("vite").Plugin}
 */
function resolver(request, id) {
  return {
    name: "test-resolver",
    resolveId: (source) => (source === request ? { id } : null),
    load: (loaded) =>
      loaded === id || loaded.startsWith("\0") ? "export default 1\n" : null,
  };
}

const backendFile = () => join(repository, "dms-lang/src/backend.ts");
const BOUNDARY = /Backend boundary/;

void test("the build fails on an import of the backend source, naming both files", async () => {
  const failure = build(
    'import { secret } from "../src/backend.ts"\nexport { secret }\n',
  );
  await assert.rejects(failure, (error) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, BOUNDARY);
    assert.ok(error.message.includes(join(frontend, "entry.ts")));
    assert.ok(error.message.includes(backendFile()));
    return true;
  });
});

void test("the build fails on a file deeper under the backend source", async () => {
  await assert.rejects(
    build('import { deep } from "../src/nested/deep.ts"\nexport { deep }\n'),
    BOUNDARY,
  );
});

void test("the build fails on an alias that points into the backend source", async () => {
  await assert.rejects(
    build('import { secret } from "@backend/backend.ts"\nexport { secret }\n', {
      alias: { "@backend": join(repository, "dms-lang/src") },
    }),
    BOUNDARY,
  );
});

void test("the build fails on a symlink to the backend source that the resolver returns", async () => {
  await assert.rejects(
    build('import { secret } from "./linked.ts"\nexport { secret }\n', {
      extra: [resolver("./linked.ts", join(frontend, "linked.ts"))],
      preserveSymlinks: true,
    }),
    BOUNDARY,
  );
});

void test("the build fails on an id that names the backend source with a query or a hash", async () => {
  for (const suffix of ["?raw", "#fragment"])
    await assert.rejects(
      build('import secret from "virtual-backend"\nexport { secret }\n', {
        extra: [resolver("virtual-backend", `${backendFile()}${suffix}`)],
      }),
      BOUNDARY,
    );
});

void test("the build fails on a backend source import declared external", async () => {
  await assert.rejects(
    build('import { secret } from "../src/backend.ts"\nexport { secret }\n', {
      external: [backendFile()],
    }),
    BOUNDARY,
  );
});

void test("the build fails on a worker entry under the backend source", async () => {
  await assert.rejects(
    build(
      'export const worker = new Worker(new URL("../src/backend.ts", import.meta.url), { type: "module" })\n',
    ),
    BOUNDARY,
  );
});

void test("the build fails on a worker of the frontend that imports the backend source", async () => {
  write(
    join(frontend, "worker.ts"),
    'import { secret } from "../src/backend.ts"\npostMessage(secret)\n',
  );
  await assert.rejects(
    build(
      'export const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })\n',
    ),
    BOUNDARY,
  );
});

void test("the build passes the built output, a virtual module and the source of another package", async () => {
  assert.match(
    await build('import { built } from "../dist/built.js"\nexport { built }\n'),
    /built/,
  );
  assert.match(
    await build('import value from "virtual:thing"\nexport { value }\n', {
      extra: [resolver("virtual:thing", "\0virtual:thing")],
    }),
    /value/,
  );
  assert.match(
    await build(
      'import { shared } from "../../other/src/shared.ts"\nexport { shared }\n',
    ),
    /shared/,
  );
});

void test("the build passes a sibling folder named like src and a src folder inside dist", async () => {
  assert.match(
    await build(
      'import { sibling } from "../srcx/sibling.ts"\nexport { sibling }\n',
    ),
    /sibling/,
  );
  assert.match(
    await build(
      'import { nested } from "../dist/src/nested.js"\nexport { nested }\n',
    ),
    /nested/,
  );
});
