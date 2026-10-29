import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import {
  browserRun,
  frontend,
  serverRender,
  vue,
} from "./helpers/frontend-runtime.mjs";

// The translations of a workspace (the matrix, the queue) and the dialogs a
// route serves are read with useApiData: the translations by a server
// render, which hands them to the browser, then row by row as the module's
// realtime changes name them; a served dialog once its action asks.

const workspacesModule = await frontend(
  "composables/translation/useI18nWorkspaces.ts",
);
Object.assign(globalThis, workspacesModule);

const realtime = { handler: undefined, session: vue.ref("own-tab") };
Object.assign(globalThis, {
  useUserRealtime: () => ({ sessionId: realtime.session }),
  useRealtimeTopic: (_topic, handler) => {
    realtime.handler = handler;
  },
  document: Object.assign(new EventTarget(), { visibilityState: "visible" }),
});

const { useWorkspaceFlat, useWorkspaceFlatSync, useLangChanges } =
  await frontend("composables/translation/useWorkspaceFlat.ts");

const API = "/api/lang/translations";
const REALTIME_DEBOUNCE_MS = 300;
const counts = (totalKeys) => ({
  localeProgress: {},
  localeMissing: {},
  totalKeys,
  baseMissing: 0,
  incompleteKeys: 0,
});
const row = (key, text) => ({ key, values: { en: text } });
const flat = {
  defaultLocale: "en",
  locales: ["en"],
  rows: [row("a", "A"), row("b", "B")],
  ...counts(2),
};

function respond({ url, query }) {
  if (url === `${API}/workspaces`)
    return {
      editable: true,
      publicBaseUrl: "",
      permissions: {},
      workspaces: [{ id: "default", kind: "default", ...counts(2) }],
    };
  if (url === `${API}/flat`) return flat;
  if (url === `${API}/row`)
    return { row: row(query.key, `${query.key} again`), counts: counts(2) };
  return {};
}

const keysOf = (translations) =>
  translations.flat.value.rows.map((entry) => entry.values.en).join(",");

test("the matrix reads the translations on the server and hands them over", async () => {
  const render = await serverRender(
    () => {
      const translations = useWorkspaceFlat();
      useWorkspaceFlatSync();
      return () => vue.h("p", keysOf(translations));
    },
    { url: "/modules/lang/translations?workspace=default", respond },
  );
  assert.deepEqual(render.reads.sort(), [
    `GET ${API}/flat`,
    `GET ${API}/workspaces`,
  ]);
  assert.deepEqual(render.untransferred, []);
  assert.match(render.html, /A,B/);
});

test("a block that only shows the translations reads none of them", async () => {
  const render = await serverRender(
    () => {
      const translations = useWorkspaceFlat();
      return () => vue.h("p", String(translations.isLoaded.value));
    },
    { respond },
  );
  assert.ok(!render.reads.includes(`GET ${API}/flat`));
  assert.match(render.html, /false/);
});

test("a key write's answer goes into the translations and the list's figures", async () => {
  const render = await serverRender(
    async () => {
      const translations = useWorkspaceFlat();
      const workspaces = useI18nWorkspaces();
      useWorkspaceFlatSync();
      await workspaces.fetchWorkspaces();
      await translations.refresh();
      translations.applyRow("default", "c", {
        row: row("c", "C"),
        counts: counts(3),
      });
      return () =>
        vue.h(
          "p",
          `${keysOf(translations)}|${workspaces.workspaces.value[0].totalKeys}`,
        );
    },
    { respond },
  );
  assert.match(render.html, /A,B,C\|3/);
  assert.match(JSON.stringify(render.payload.data), /"totalKeys":3/);
});

test("a realtime change reads just the rows it names, and skips the tab's own echo", async () => {
  const run = browserRun(
    () => {
      const translations = useWorkspaceFlat();
      useWorkspaceFlatSync();
      useLangChanges();
      return translations;
    },
    { respond },
  );
  await sleep(10);
  const flatReads = () =>
    run.reads.filter((read) => read.url !== `${API}/workspaces`);
  assert.deepEqual(
    flatReads().map((read) => read.url),
    [`${API}/flat`],
  );

  realtime.handler({
    type: "changed",
    payload: { session: "own-tab", keys: ["a"] },
  });
  realtime.handler({
    type: "changed",
    payload: { session: "other", keys: ["b"] },
  });
  await sleep(REALTIME_DEBOUNCE_MS + 50);

  assert.deepEqual(
    flatReads().map((read) => `${read.url}?${new URLSearchParams(read.query)}`),
    [`${API}/flat?workspace=default`, `${API}/row?workspace=default&key=b`],
  );
  assert.equal(keysOf(run.result), "A,b again");
  run.stop();
});
