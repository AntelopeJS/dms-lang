/**
 * @packageDocumentation
 * The matrix's columns are the workspace's languages, base first: a server
 * render shows them as the browser's first render will, so the page hydrates
 * without a mismatch. A user's own order, kept in this browser, applies once
 * the page is mounted.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { serverRender, vue } from "./helpers/frontend-runtime.mjs";

Object.assign(
  globalThis,
  await import("../frontend-vue/app/composables/translation/useI18nWorkspaces.ts"),
  await import("../frontend-vue/app/composables/translation/useLangLinks.ts"),
  await import("../frontend-vue/app/build/composables/useMatrixFilters.ts"),
);
Object.assign(
  globalThis,
  await import("../frontend-vue/app/composables/translation/useWorkspaceRoute.ts"),
);
Object.assign(globalThis, {
  useUserRealtime: () => ({ sessionId: vue.ref("own-tab") }),
  useRealtimeTopic: () => {},
});
Object.assign(
  globalThis,
  await import("../frontend-vue/app/composables/translation/useWorkspaceFlat.ts"),
);
const { useMatrixView } =
  await import("../frontend-vue/app/build/composables/useMatrixView.ts");

const API = "/api/lang/translations";

/** @param {import("./helpers/frontend-runtime.mjs").Read} read */
function respond({ url }) {
  if (url === `${API}/workspaces`)
    return {
      editable: true,
      publicBaseUrl: "",
      permissions: {},
      workspaces: [{ id: "default", kind: "default", totalKeys: 1 }],
    };
  if (url === `${API}/flat`)
    return {
      defaultLocale: "en",
      locales: ["fr", "en"],
      rows: [{ key: "a", values: { en: "A", fr: "A" } }],
      localeProgress: {},
      localeMissing: {},
      totalKeys: 1,
      baseMissing: 0,
      incompleteKeys: 0,
    };
  return {};
}

void test("a server render shows the workspace's languages as the matrix columns", async () => {
  const render = await serverRender(
    () => {
      useWorkspaceFlatSync();
      const { order } = useMatrixView();
      return () => vue.h("p", `columns:${order.value.join(",")}`);
    },
    { url: "/modules/lang/translations?workspace=default", respond },
  );
  assert.match(render.html, /columns:en,fr/);
});
