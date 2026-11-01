import assert from "node:assert/strict";
import { test } from "node:test";
import { browserRun } from "./helpers/frontend-runtime.mjs";

const { useReadOnlyRefusal } =
  await import("../node_modules/@antelopejs/dms/frontend-vue/layers/dms-core/app/composables/useReadOnlyRefusal.ts");
const { useMutationToast } =
  await import("../frontend-vue/app/composables/translation/useMutationToast.ts");
const { useI18nWorkspaces } =
  await import("../frontend-vue/app/composables/translation/useI18nWorkspaces.ts");
const READ_ONLY = "Read-only demo, changes are not saved";

/** @param {boolean} marked */
function setup(marked) {
  /** @type {Array<{title: string}>} */
  const notices = [];
  const presented = { value: new WeakSet() };
  /** @param {{title: string}} notice */
  const add = (notice) => {
    notices.push(notice);
  };
  /** @param {string} key */
  const translate = (key) => key;
  /** @param {unknown} translateMessage
   * @param {string} message */
  const resolveMessage = (translateMessage, message) => message;
  Object.assign(globalThis, {
    useToast: () => ({ add }),
    useI18n: () => ({ t: translate }),
    getAppTranslation: () => ({ processApiMessage: () => READ_ONLY }),
    useDmsState: () => presented,
    useReadOnlyRefusal,
    resolveApiMessage: resolveMessage,
    resolveApiErrorMessage: () => "This public demo is read-only.",
    resolveApiErrorTitle: () => "Request refused",
  });
  const error = {
    response: new Response(null, {
      status: 403,
      headers: marked ? { "x-dms-readonly": "1" } : {},
    }),
  };
  return { notices, error };
}

for (const marked of [true, false]) {
  test(`workspace creation keeps failure but presents marked=${marked} only once`, async () => {
    const { notices, error } = setup(marked);
    const failures = useMutationToast();
    const consume = useReadOnlyRefusal();
    /** @type {Array<{url: string, method?: string}>} */
    const requests = [];
    /** @param {string} url
     * @param {{method?: string}} options */
    const fetch = async (url, options = {}) => {
      if (!options.method) return { workspaces: [] };
      requests.push({ url, ...options });
      consume(error);
      throw error;
    };
    globalThis.useAuthFetch = () => ({
      $authFetch: fetch,
    });
    let pending = Promise.resolve(false);
    const writes = browserRun(() => {
      const workspaces = useI18nWorkspaces();
      pending = failures.tryMutate(async () => {
        await workspaces.createWorkspace("readonly-proof", { code: "en" });
      });
    });
    const ok = await pending;
    assert.equal(ok, false);
    assert.deepEqual(
      requests.map(({ url, method }) => [method, url]),
      [["POST", "/api/lang/translations/workspace"]],
    );
    assert.deepEqual(
      notices.map(({ title }) => title),
      [marked ? READ_ONLY : "Request refused"],
    );
    writes.stop();
  });

  test(`inline errors leave marked=${marked} refusal presentation to core`, () => {
    const { notices, error } = setup(marked);
    const failures = useMutationToast();
    useReadOnlyRefusal()(error);
    assert.equal(
      failures.errorMessage(error),
      marked ? "" : "This public demo is read-only.",
    );
    failures.reportFailure(error);
    assert.deepEqual(
      notices.map(({ title }) => title),
      [marked ? READ_ONLY : "Request refused"],
    );
  });
}
