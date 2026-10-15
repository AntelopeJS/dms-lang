import assert from "node:assert/strict";
import { test } from "node:test";
import { frontend, serverRender, vue } from "./frontend-runtime.mjs";

// A page opened without `?workspace=` (a menu link) is given one by a server
// redirect, so it renders the workspace's data rather than an empty page the
// browser fills in afterwards.

Object.assign(
  globalThis,
  await frontend("composables/translation/useI18nWorkspaces.ts"),
  await frontend("composables/translation/useLangLinks.ts"),
  { usePermissions: () => ({ hasPermission: () => true }) },
);
Object.assign(
  globalThis,
  await frontend("composables/translation/useWorkspaceRoute.ts"),
  await frontend("composables/translation/useWorkspaceContext.ts"),
);
const { useWorkspaceFill } = await frontend(
  "composables/translation/useWorkspaceFill.ts",
);

const API = "/api/lang/translations";

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

async function renderPage(url) {
  return serverRender(
    async () => {
      // What a component's `<script setup>` compiles an `await` to: the
      // setup goes on in the component once the list is in.
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

test("a server render redirects a page without a workspace to one", async () => {
  const render = await renderPage("/modules/lang/overview");
  assert.equal(render.redirect, "/modules/lang/overview?workspace=default");
});

test("a page naming its workspace renders where it is", async () => {
  const render = await renderPage("/modules/lang/overview?workspace=default");
  assert.equal(render.redirect, undefined);
});
