/**
 * @packageDocumentation
 * A page opened without `?workspace=` (a menu link) is given one by a server
 * redirect, so it renders the workspace's data rather than an empty page the
 * browser fills in afterwards.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { serverRender, vue } from "./helpers/frontend-runtime.mjs";

Object.assign(
  globalThis,
  await import("../frontend-vue/app/composables/translation/useI18nWorkspaces.ts"),
  await import("../frontend-vue/app/composables/translation/useLangLinks.ts"),
  { usePermissions: () => ({ hasPermission: () => true }) },
);
Object.assign(
  globalThis,
  await import("../frontend-vue/app/composables/translation/useWorkspaceRoute.ts"),
  await import("../frontend-vue/app/composables/translation/useWorkspaceContext.ts"),
);
const { useWorkspaceFill } =
  await import("../frontend-vue/app/composables/translation/useWorkspaceFill.ts");

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
  return {};
}

/**
 * Renders the page `url` on a server, its setup awaiting the workspace list
 * as a component's `<script setup>` compiles an `await`: the setup goes on in
 * the component once the list is in.
 *
 * @param {string} url
 */
async function renderPage(url) {
  return serverRender(
    async () => {
      const workspaces = useI18nWorkspaces();
      const [loaded, restore] = vue.withAsyncContext(() =>
        workspaces.whenLoaded(),
      );
      await loaded;
      restore();
      useWorkspaceFill();
      return () => vue.h("p");
    },
    { url, respond },
  );
}

void test("a server render redirects a page without a workspace to one", async () => {
  const render = await renderPage("/modules/lang/overview");
  assert.equal(render.redirect, "/modules/lang/overview?workspace=default");
});

void test("a page naming its workspace renders where it is", async () => {
  const render = await renderPage("/modules/lang/overview?workspace=default");
  assert.equal(render.redirect, undefined);
});
