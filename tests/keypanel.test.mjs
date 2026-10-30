/**
 * @packageDocumentation
 * The key panel of the matrix: `useKeyPanel` opens it as a DMS drawer, and
 * `KeyEditorDrawer` is its body. The DMS's own composables are stand-ins
 * that record what the panel asks of them.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import {
  browserRun,
  history,
  serverRender,
  vue,
} from "./helpers/frontend-runtime.mjs";

const ORIGIN = "http://frontend.local";
/**
 * @typedef {object} Header What the panel's body reports of the key it shows.
 * @property {string} key
 * @property {string} crumbs
 * @property {number} missingCount
 * @property {number} issueCount
 * @property {string} placeholders
 * @property {number} index
 * @property {number} total
 * @property {boolean} hasPrevious
 * @property {boolean} hasNext
 * @property {() => void} previous
 * @property {() => void} next
 */
/**
 * @typedef {object} DrawerOptions
 * @property {string} title
 * @property {string} containerId
 * @property {string} sizeKey
 * @property {object} component
 * @property {object} rowHeader
 * @property {{ onHeader: (shown: Header) => void }} componentOptions
 */
/**
 * @typedef {object} DrawerPatch
 * @property {{ navigation: { next: () => void, prev: () => void } }} rowHeader
 */
/**
 * @typedef {object} Drawer
 * @property {DrawerOptions} options
 * @property {DrawerPatch[]} patches
 * @property {Promise<void>} result
 * @property {() => void} close
 * @property {(patch: DrawerPatch) => number} patch
 */

/** @type {Drawer[]} */
const drawers = [];
/**
 * The events the page listens to on the document or the window.
 *
 * @type {string[]}
 */
const listened = [];
/** @param {string} type */
const listen = (type) => listened.push(type);
/**
 * @param {string} key
 * @param {object} [params]
 */
const translate = (key, params) =>
  params === undefined ? key : `${key}${JSON.stringify(params)}`;

/** The DMS drawer: each opening, with the patches it receives, closed on demand. */
function useDrawer() {
  return {
    /** @param {DrawerOptions} options */
    open(options) {
      /** @type {PromiseWithResolvers<void>} */
      const { promise, resolve } = Promise.withResolvers();
      /** @type {Drawer} */
      const drawer = {
        options,
        patches: [],
        result: promise,
        close: resolve,
        patch: (patch) => drawer.patches.push(patch),
      };
      drawers.push(drawer);
      return drawer;
    },
  };
}

Object.assign(globalThis, {
  useDrawer,
  useUserRealtime: () => ({ sessionId: vue.ref("own-tab") }),
  useRealtimeTopic: () => {},
  useI18n: () => ({ t: translate, locale: vue.ref("en") }),
  useToast: () => ({ add() {} }),
  useOverlay: () => ({ create: () => ({ open: () => ({ result: null }) }) }),
  useConfirm: () => ({ confirm: async () => true }),
  usePermissions: () => ({ hasPermission: () => true }),
  useUnsavedChanges: () => {},
  useKeyboardPlatform: () => ({
    /** @param {string} key */
    keyLabel: (key) => key,
  }),
  document: { visibilityState: "visible", addEventListener: listen },
  window: {
    history: { back: () => history.visits.push({ kind: "back" }) },
    location: {
      origin: ORIGIN,
      get href() {
        return new URL(history.page.url ?? "/", ORIGIN).href;
      },
    },
    addEventListener: listen,
  },
});
Object.assign(
  globalThis,
  await import("../frontend-vue/app/utils/translations.ts"),
  await import("../frontend-vue/app/utils/keySaves.ts"),
  await import("../frontend-vue/app/utils/keySaveErrors.ts"),
  await import("../frontend-vue/app/composables/translation/useI18nWorkspaces.ts"),
  await import("../frontend-vue/app/composables/translation/useLangLinks.ts"),
  await import("../frontend-vue/app/composables/translation/useWorkspaceRoute.ts"),
  await import("../frontend-vue/app/composables/translation/useWorkspaceFlat.ts"),
  await import("../frontend-vue/app/composables/translation/useLocaleNames.ts"),
  await import("../frontend-vue/app/composables/translation/useMutationToast.ts"),
  await import("../frontend-vue/app/composables/translation/useWorkspaceContext.ts"),
  await import("../frontend-vue/app/composables/translation/useWorkspaceLabel.ts"),
  await import("../frontend-vue/app/composables/translation/useKeyActions.ts"),
);

const { useKeyPanel } =
  await import("../frontend-vue/app/build/composables/useKeyPanel.ts");
const { default: KeyEditorDrawer } =
  await import("../frontend-vue/app/build/components/KeyEditorDrawer.vue");
const { default: KeyStatus } =
  await import("../frontend-vue/app/build/components/KeyStatus.vue");
const { NAMESPACE_SEPARATOR } =
  await import("../frontend-vue/app/utils/translations.ts");

const API = "/api/lang/translations";
const PAGE = "/modules/lang/translations?workspace=default";
const KEYS = ["home.title", "home.cta", "footer.legal"];

/** @param {import("./helpers/frontend-runtime.mjs").Read} read */
function respond({ url }) {
  if (url === `${API}/workspaces`)
    return {
      editable: true,
      publicBaseUrl: "",
      permissions: {},
      workspaces: [
        {
          id: "default",
          kind: "default",
          editable: true,
          totalKeys: KEYS.length,
          defaultLocale: "en",
          locales: [{ code: "en" }, { code: "fr" }],
        },
      ],
    };
  if (url === `${API}/flat`)
    return {
      defaultLocale: "en",
      locales: ["en", "fr"],
      rows: KEYS.map((key) => ({ key, values: { en: key, fr: key } })),
      localeProgress: {},
      localeMissing: {},
      totalKeys: KEYS.length,
      baseMissing: 0,
      incompleteKeys: 0,
    };
  return {};
}

/** The key panel of a matrix whose keys are `KEYS`, on the matrix's page. */
function openPanel() {
  drawers.length = 0;
  return browserRun(
    () =>
      useKeyPanel({
        keys: () => KEYS,
        editable: () => true,
        manageKeys: () => true,
        canOverride: () => false,
        onOverride() {},
        onKeep() {},
      }),
    { respond, url: PAGE },
  );
}

/** What the panel's body reports of the key it shows, as `KeyEditorDrawer` does. */
/** @param {number} index */
const header = (index) => ({
  key: "home.cta",
  crumbs: "home",
  missingCount: 1,
  issueCount: 2,
  placeholders: "{name}",
  index,
  total: KEYS.length,
  hasPrevious: index > 0,
  hasNext: index < KEYS.length - 1,
  previous: () => {},
  next: () => {},
});

void test("the key panel opens every key in one drawer, under one id, so the DMS keeps its width", async () => {
  const run = openPanel();
  await run.result.open({ key: "home.title" });
  drawers[0].close();
  await sleep(0);
  await run.result.open({ key: "footer.legal" });
  run.stop();
  assert.equal(drawers.length, 2);
  const [first, second] = drawers.map(({ options }) => options);
  assert.ok(first.containerId, "the drawer has an id");
  assert.equal(second.containerId, first.containerId);
  assert.equal(second.sizeKey, first.sizeKey);
  assert.equal(first.sizeKey, first.containerId);
  assert.equal(first.component, KeyEditorDrawer);
  assert.deepEqual(
    drawers.map(({ options }) => options.title),
    ["home.title", "footer.legal"],
  );
});

void test("closing the key panel replaces the URL instead of going Back, which renders the page anew", async () => {
  const run = openPanel();
  await run.result.open({ key: "home.cta" });
  assert.deepEqual(history.visits, [
    { kind: "push", url: `${PAGE}&key=home.cta` },
  ]);
  drawers[0].close();
  await sleep(0);
  run.stop();
  assert.deepEqual(history.visits.at(-1), { kind: "replace", url: PAGE });
  assert.equal(history.visits.length, 2);
});

void test("the key panel's header is the DMS row header: the key in its look, then its place among the keys", async () => {
  const run = openPanel();
  await run.result.open({ key: "home.cta" });
  const [drawer] = drawers;
  const look = {
    titleClass: "font-mono",
    titleBreakAfter: NAMESPACE_SEPARATOR,
    subtitleClass: "font-mono",
  };
  assert.deepEqual(drawer.options.rowHeader, { title: "home.cta", ...look });
  assert.equal("headerComponent" in drawer.options, false);
  const shown = header(1);
  drawer.options.componentOptions.onHeader(shown);
  drawer.options.componentOptions.onHeader(header(-1));
  run.stop();
  const [placed, unplaced] = drawer.patches.map((patch) => patch.rowHeader);
  assert.deepEqual(placed, {
    title: "home.cta",
    ...look,
    subtitle: "home",
    component: KeyStatus,
    componentOptions: {
      missingCount: 1,
      issueCount: 2,
      placeholders: "{name}",
    },
    positionLabel: "$dms_lang.drawer.position",
    navigation: {
      index: 1,
      total: KEYS.length,
      hasPrev: true,
      hasNext: true,
      prev: shown.previous,
      next: shown.next,
    },
  });
  assert.equal(
    "navigation" in unplaced,
    false,
    "a key off the list has no steps",
  );
  assert.equal("positionLabel" in unplaced, false);
});

void test("J and K are the DMS row header's, not the panel's own", async () => {
  listened.length = 0;
  const run = openPanel();
  await run.result.open({ key: "home.cta" });
  const shown = header(1);
  drawers[0].options.componentOptions.onHeader(shown);
  run.stop();
  const { navigation } = drawers[0].patches[0].rowHeader;
  assert.equal(navigation.next, shown.next);
  assert.equal(navigation.prev, shown.previous);
  assert.deepEqual(listened, []);
});

/** The server render of the panel's body showing `KEYS[1]`, and the headers it reported. */
async function renderBody() {
  /** @type {Header[]} */
  const headers = [];
  const render = await serverRender(
    () => {
      vue.getCurrentInstance().appContext.config.globalProperties.$t =
        translate;
      useWorkspaceFlatSync();
      return () =>
        vue.h(KeyEditorDrawer, {
          keys: KEYS,
          workspace: "default",
          startIndex: 1,
          editable: true,
          manageKeys: true,
          onHeader: (/** @type {Header} */ shown) => headers.push(shown),
        });
    },
    { url: `${PAGE}&key=home.cta`, respond },
  );
  return { html: render.html, headers };
}

void test("every language field of the key panel is labelled by its name", async () => {
  const { html } = await renderBody();
  const labels = [...html.matchAll(/<label for="([^"]+)"/g)].map((m) => m[1]);
  const fields = [...html.matchAll(/<UTextarea id="([^"]+)"/g)].map(
    (m) => m[1],
  );
  assert.equal(new Set(labels).size, 2, "one label per language");
  assert.deepEqual(labels, fields);
});

void test("the key panel's body hands the DMS row header the key's place among the keys", async () => {
  const { headers } = await renderBody();
  assert.ok(headers.length > 0);
  assert.deepEqual(
    headers.map(({ key, index, total }) => ({ key, index, total })).at(-1),
    { key: "home.cta", index: 1, total: KEYS.length },
  );
});

void test("the key panel's footer is the DMS container footer, with the save button", async () => {
  const { html } = await renderBody();
  const footer = html.match(
    /<DmsContainerFooter data-key-panel-footer>(.*)<\/DmsContainerFooter>/s,
  )?.[1];
  assert.ok(footer, "the body ends in the DMS footer");
  assert.match(footer, /label="dms_lang\.drawer\.save"/);
  assert.doesNotMatch(html, /dms-form-foot/);
});

void test("the key panel lays out by the drawer's width, not the window's", async () => {
  const { html } = await renderBody();
  const classes = [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) =>
    m[1].split(/\s+/),
  );
  assert.ok(
    classes.some((name) => name.startsWith("@")),
    "container queries",
  );
  assert.deepEqual(
    classes.filter((name) => /^(sm|md|lg|xl|2xl):/.test(name)),
    [],
  );
});
