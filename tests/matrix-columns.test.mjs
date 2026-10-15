import assert from "node:assert/strict";
import { test } from "node:test";
import {
  browserRun,
  frontend,
  serverRender,
  vue,
} from "./frontend-runtime.mjs";

// The matrix's columns: the workspace's languages, base first, until this
// browser remembers a choice. A server render reads the translations after
// the matrix's setup, so the columns must follow them there too: the HTML it
// hands over is the one the browser hydrates.

const workspacesModule = await frontend(
  "composables/translation/useI18nWorkspaces.ts",
);
const linksModule = await frontend("composables/translation/useLangLinks.ts");
const routeModule = await frontend(
  "composables/translation/useWorkspaceRoute.ts",
);
Object.assign(globalThis, workspacesModule, linksModule, routeModule, {
  useUserRealtime: () => ({ sessionId: vue.ref(undefined) }),
  useRealtimeTopic: () => {},
  document: Object.assign(new EventTarget(), { visibilityState: "visible" }),
});
const flatModule = await frontend(
  "composables/translation/useWorkspaceFlat.ts",
);
Object.assign(globalThis, flatModule);
const { useMatrixView } = await frontend("build/composables/useMatrixView.ts");

const API = "/api/lang/translations";
const counts = {
  localeProgress: {},
  localeMissing: {},
  totalKeys: 1,
  baseMissing: 0,
  incompleteKeys: 0,
};

function respond({ url }) {
  if (url === `${API}/workspaces`)
    return {
      editable: true,
      publicBaseUrl: "",
      permissions: {},
      workspaces: [{ id: "default", kind: "default", ...counts }],
    };
  if (url === `${API}/flat`)
    return {
      defaultLocale: "en",
      locales: ["fr", "en", "de"],
      rows: [{ key: "a", values: { en: "A" } }],
      ...counts,
    };
  return {};
}

test("a server render shows the workspace's languages as columns, base first", async () => {
  const render = await serverRender(
    () => {
      const { order } = useMatrixView();
      flatModule.useWorkspaceFlatSync();
      return () => vue.h("p", `columns:${order.value.join(",")}`);
    },
    { url: "/modules/lang/translations?workspace=default", respond },
  );
  assert.ok(render.reads.includes(`GET ${API}/flat`));
  assert.match(render.html, /columns:en,fr,de/);
});

test("a column choice shows at once", async () => {
  const run = browserRun(
    () => {
      const view = useMatrixView();
      flatModule.useWorkspaceFlatSync();
      return view;
    },
    { respond },
  );
  await vue.nextTick();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(run.result.order.value, ["en", "fr", "de"]);
  run.result.saveOrder(["de", "en"]);
  assert.deepEqual(run.result.order.value, ["de", "en"]);
  run.stop();
});
