import assert from "node:assert/strict";
import { test } from "node:test";
import { frontend, serverRender, vue } from "./helpers/frontend-runtime.mjs";

/**
 * @packageDocumentation
 * The workspace list every page's scope bar shows, and the figures of the
 * workspace list page, are read by a server render and handed to the
 * browser, which then does not ask again.
 */

const { useI18nWorkspaces, useWorkspaceSummary } = await frontend(
  "composables/translation/useI18nWorkspaces.ts",
);

const API = "/api/lang/translations";
const workspace = (id, kind, totalKeys) => ({
  id,
  kind,
  editable: kind !== "modules",
  defaultLocale: "en",
  locales: [{ code: "en" }, { code: "fr" }],
  totalKeys,
  baseMissing: 0,
});

function respond({ url }) {
  switch (url) {
    case `${API}/workspaces`:
      return {
        editable: true,
        publicBaseUrl: "https://texts.example.test/i18n",
        permissions: { createWorkspace: "lang.create" },
        workspaces: [
          workspace("default", "default", 10),
          workspace("modules", "modules", 900),
        ],
      };
    case `${API}/summary`:
      return {
        editable: true,
        workspaces: [{ id: "default", coverage: 100 }],
      };
    default:
      return {};
  }
}

const listed = (workspaces) =>
  workspaces.workspaces.value
    .map((entry) => `${entry.id}:${entry.totalKeys}`)
    .join(",");

test("the blocks of a page read the workspace list once, on the server, and hand it over", async () => {
  const render = await serverRender(
    () => {
      /** The scope bar and the page's block, each with the list. */
      const scope = useI18nWorkspaces();
      const block = useI18nWorkspaces();
      return () =>
        vue.h(
          "p",
          `${listed(scope)}|${block.editable.value}|${block.isLoaded.value}|${block.publicBaseUrl.value}`,
        );
    },
    { url: "/modules/lang/overview", respond },
  );
  assert.deepEqual(render.reads, [`GET ${API}/workspaces`]);
  assert.deepEqual(render.untransferred, []);
  assert.match(
    render.html,
    /default:10,modules:900\|true\|true\|https:\/\/texts\.example\.test\/i18n/,
  );
});

test("a write reads the list again, and a key write's figures go into it", async () => {
  const render = await serverRender(
    async () => {
      const workspaces = useI18nWorkspaces();
      await workspaces.fetchWorkspaces();
      workspaces.patchCounts("default", { totalKeys: 11, baseMissing: 1 });
      return () => vue.h("p", listed(workspaces));
    },
    { respond },
  );
  assert.deepEqual(render.reads, [
    `GET ${API}/workspaces`,
    `GET ${API}/workspaces`,
  ]);
  assert.match(render.html, /default:11,modules:900/);
  /** What the browser is handed is the list as patched. */
  assert.match(JSON.stringify(render.payload.data), /"totalKeys":11/);
});

test("the workspace list page reads its figures on the server and hands them over", async () => {
  const render = await serverRender(
    () => {
      const summary = useWorkspaceSummary();
      return () =>
        vue.h(
          "p",
          (summary.data.value?.workspaces ?? [])
            .map((entry) => `${entry.id} ${entry.coverage}%`)
            .join(","),
        );
    },
    { url: "/modules/lang/workspaces", respond },
  );
  assert.deepEqual(render.reads, [`GET ${API}/summary`]);
  assert.deepEqual(render.untransferred, []);
  assert.match(render.html, /default 100%/);
});
