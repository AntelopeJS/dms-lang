/**
 * @packageDocumentation
 * The frontend's composables on the renderer's real data layer and the
 * DMS's real `useApiData`, as installed at the root (`@antelopejs/dms-frontend`,
 * `@antelopejs/dms`), for the tests that render them on a server: what a
 * render reads from the backend, and what it hands the browser.
 *
 * TypeScript is transpiled as it loads (the renderer's and the DMS's sources
 * live in node_modules, where Node strips no types), `#dms/frontend-module`
 * is the renderer's, Vue is the renderer's own copy, and what the renderer
 * reads of Inertia and vue-i18n, in the browser only, is replaced: Inertia's
 * router by a history that records each visit and moves the page to it,
 * vue-i18n by a `useI18n` that throws. A `.vue` file is compiled by the
 * renderer's Vue compiler, its template inlined in its setup, as Vite
 * compiles it.
 */
import { createRequire, registerHooks } from "node:module";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

/** Their own location, where pnpm puts what they import. */
const installed = (path) =>
  pathToFileURL(
    realpathSync(
      fileURLToPath(
        new URL(`../../node_modules/@antelopejs/${path}`, import.meta.url),
      ),
    ),
  ).href;
const RENDERER = installed("dms-frontend/templates/vue/frontend-module.ts");
const USE_API_DATA = installed(
  "dms/frontend-vue/layers/dms-core/app/composables/auth/useApiData.ts",
);
const sfc = createRequire(fileURLToPath(RENDERER))("vue/compiler-sfc");
sfc.registerTS(() => ts);
const BROWSER_ONLY = {
  "@inertiajs/vue3":
    "const history = () => globalThis.__INERTIA_HISTORY__; export const Link = {}; export const router = { visit: (url, options) => history().go('visit', url, options), push: (options) => history().go('push', options.url, options), replace: (options) => history().go('replace', options.url, options), on: () => () => {} }; export const usePage = () => history().page;",
  "vue-i18n":
    "export function useI18n() { throw new Error('vue-i18n is not available in these tests') }",
};

/** The script of a single-file component, its template inlined, in TypeScript. */
function compileComponent(path) {
  const { descriptor } = sfc.parse(readFileSync(path, "utf8"), {
    filename: path,
  });
  return sfc.compileScript(descriptor, {
    id: path,
    inlineTemplate: true,
  }).content;
}

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "#dms/frontend-module")
      return { url: RENDERER, shortCircuit: true };
    if (specifier in BROWSER_ONLY)
      return {
        url: `data:text/javascript,${encodeURIComponent(BROWSER_ONLY[specifier])}`,
        shortCircuit: true,
      };
    if (specifier === "vue" || specifier.startsWith("vue/"))
      return next(specifier, { ...context, parentURL: RENDERER });
    const relative = specifier.startsWith(".");
    if (
      relative &&
      /\.(ts|vue)$/.test(context.parentURL ?? "") &&
      !/\.\w+$/.test(specifier)
    )
      return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (!url.startsWith("file:") || !/\.(ts|vue)$/.test(url))
      return next(url, context);
    const path = fileURLToPath(url);
    const { outputText } = ts.transpileModule(
      path.endsWith(".vue")
        ? compileComponent(path)
        : readFileSync(path, "utf8"),
      {
        fileName: path.endsWith(".vue") ? `${path}.ts` : path,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          verbatimModuleSyntax: false,
        },
      },
    );
    /** Vite's build flags, which the test sets per side. */
    const source = outputText.replaceAll(
      "import.meta.env",
      "globalThis.__VITE_ENV__",
    );
    return { format: "module", source, shortCircuit: true };
  },
});

const vue = await import("vue");

/**
 * The browser's history as Inertia keeps it: the page's URL, and each visit
 * made, by kind (`push`, `replace`, or a server `visit`), in order.
 */
export const history = {
  page: vue.reactive({ url: undefined }),
  visits: [],
  go(kind, url, options) {
    history.visits.push({ kind, url });
    history.page.url = url;
    options.onFinish?.();
  },
};
globalThis.__INERTIA_HISTORY__ = history;
const { renderToString } = await import("vue/server-renderer");
const engine = await import(RENDERER);
const { useApiData } = await import(USE_API_DATA);

const reads = [];
let backend = () => ({});

/**
 * The application's auto-imports: Vue's API, the renderer's, and the DMS
 * layers' the composables call.
 */
for (const [name, value] of Object.entries(vue))
  if (/^[a-z]/.test(name)) globalThis[name] = value;
Object.assign(globalThis, {
  useDmsFetch: engine.useDmsFetch,
  useDmsAsyncData: engine.useDmsAsyncData,
  useApiData,
  useAuthFetch: () => ({
    async $authFetch(url, options = {}) {
      const read = {
        url,
        method: (options.method ?? "GET").toUpperCase(),
        query: options.query ?? {},
      };
      const response = await Promise.resolve(backend(read));
      reads.push({ ...read, response });
      return response;
    },
  }),
});

/** Imports a module of the frontend's sources. */
export const frontend = (path) =>
  import(
    pathToFileURL(
      fileURLToPath(new URL(`../../frontend-vue/app/${path}`, import.meta.url)),
    ).href
  );

/**
 * The requests the payload carries the responses of. The renderer keys a
 * request by a digest the page does not reveal, so a request is matched by
 * its response.
 */
function transferredRequests(payload, answered) {
  const carried = new Set(
    Object.values({ ...payload.data, ...payload.errors }).map((value) =>
      JSON.stringify(value),
    ),
  );
  return answered
    .filter(({ response }) => carried.has(JSON.stringify(response)))
    .map(({ request }) => request);
}

/**
 * Renders on a server, for the page `url`, a component whose setup is
 * `setup` and whose HTML is what `setup` returns, answering each backend
 * request with `respond`.
 */
export async function serverRender(setup, { url = "/", respond } = {}) {
  backend = respond ?? (() => ({}));
  reads.length = 0;
  globalThis.__VITE_ENV__ = { SSR: true };
  const runtime = engine.createDmsFrontendRuntime(undefined, {}, true);
  runtime.route.fullPath = url;
  const app = vue.createSSRApp({ setup: () => setup() });
  engine.provideDmsFrontendRuntime(app, runtime);
  app.config.warnHandler = () => {};
  const html = await renderToString(app);
  const payload = engine.serializeDmsPayload(runtime);
  const answered = reads.map((read) => ({
    request: `${read.method} ${read.url}`,
    response: read.response,
  }));
  const made = answered.map(({ request }) => request);
  const transferred = transferredRequests(payload, answered);
  return {
    html,
    payload,
    redirect: runtime.serverRedirect,
    reads: made,
    untransferred: made.filter((read) => !transferred.includes(read)),
  };
}

/**
 * Runs `setup` in a browser's runtime, as a component's setup does, with no
 * server render before it, on the page `url`, answering each backend request
 * with `respond`.
 * `reads` lists the requests made so far, with their query.
 */
export function browserRun(setup, { respond, url } = {}) {
  backend = respond ?? (() => ({}));
  reads.length = 0;
  history.page.url = url;
  history.visits.length = 0;
  globalThis.__VITE_ENV__ = { SSR: false };
  const runtime = engine.createDmsFrontendRuntime(undefined, undefined, false);
  const app = vue.createApp({});
  engine.provideDmsFrontendRuntime(app, runtime);
  const scope = vue.effectScope();
  const result = app.runWithContext(() => scope.run(setup));
  return { result, reads, stop: () => scope.stop() };
}

export { vue };
