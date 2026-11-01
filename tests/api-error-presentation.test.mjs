import assert from "node:assert/strict";
import { test } from "node:test";
import { browserRun } from "./helpers/frontend-runtime.mjs";

const { useApiErrorPresenter } =
  await import("../node_modules/@antelopejs/dms/frontend-vue/layers/dms-core/app/composables/useApiErrorPresenter.ts");
const { useMutationToast } =
  await import("../frontend-vue/app/composables/translation/useMutationToast.ts");
const { useI18nWorkspaces } =
  await import("../frontend-vue/app/composables/translation/useI18nWorkspaces.ts");

/** @type {Record<string, string>} */
const TEXTS = {
  "error.read_only_demo": "This public demo is read-only.",
  "error.500.description": "Something went wrong.",
  "dms_lang.workspace_details.save_failed": "Could not save workspace details.",
  "dms_lang.actions.retry": "Retry",
};

/** @param {unknown} data */
function setup(data, status = 403) {
  /** @type {Array<{title: string, color: string, actions?: Array<{label: string, onClick: () => void}>}>} */
  const notices = [];
  const presented = { value: new WeakMap() };
  /** @param {string} key */
  const translate = (key) => TEXTS[key] ?? key;
  Object.assign(globalThis, {
    useToast: () => ({
      /** @param {(typeof notices)[number]} notice */
      add: (notice) => {
        notices.push(notice);
        return { id: notices.length };
      },
    }),
    useI18n: () => ({ t: translate }),
    getPluginI18n: () => ({
      i18n: {
        /** @param {string} key */
        tm: (key) => TEXTS[key],
        /** @param {string} message */
        rt: (message) => message,
      },
    }),
    useDmsState: () => presented,
    useApiErrorPresenter,
    /** @param {unknown} t
     * @param {string} message */
    resolveApiMessage: (t, message) => translate(message),
    resolveApiErrorMessage: () => "error.500.description",
    resolveApiErrorTitle: () => "Request refused",
  });
  const response = new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
  const error = { response, data };
  return { notices, error };
}

for (const coreFirst of [false, true]) {
  test(`workspace creation shows one server warning with coreFirst=${coreFirst}`, async () => {
    const { notices, error } = setup({
      message: "error.read_only_demo",
      severity: "warning",
    });
    /** @type {Array<[string, string]>} */
    const requests = [];
    let pending = Promise.resolve(true);
    const runtime = browserRun(() => {
      const core = useApiErrorPresenter();
      const failures = useMutationToast();
      globalThis.useAuthFetch = () => ({
        /** @param {string} url
         * @param {{method?: string}} options */
        $authFetch: async (url, options) => {
          if (!options.method) return { workspaces: [] };
          requests.push([options.method, url]);
          if (coreFirst)
            core.presentError(error, { fallbackKey: "error.500.description" });
          throw error;
        },
      });
      const workspaces = useI18nWorkspaces();
      pending = failures.tryMutate(async () => {
        await workspaces.createWorkspace("demo", { code: "en" });
      });
    });
    try {
      assert.equal(await pending, false);
      assert.deepEqual(requests, [
        ["POST", "/api/lang/translations/workspace"],
      ]);
      assert.deepEqual(
        notices.map(({ title, color }) => ({ title, color })),
        [{ title: "This public demo is read-only.", color: "warning" }],
      );
    } finally {
      runtime.stop();
    }
  });
}

test("unknown server keys use the caller fallback and keep the retry action", () => {
  const { notices, error } = setup({ message: "unknown.server.key" }, 503);
  let retried = false;
  const runtime = browserRun(() => {
    useMutationToast().reportFailure(error, {
      fallbackKey: "dms_lang.workspace_details.save_failed",
      retry: () => {
        retried = true;
      },
    });
  });
  try {
    assert.deepEqual(
      notices.map(({ title, color }) => ({ title, color })),
      [{ title: "Could not save workspace details.", color: "error" }],
    );
    const action = notices[0].actions?.[0];
    assert.ok(action);
    assert.equal(action.label, "Retry");
    action.onClick();
    assert.equal(retried, true);
  } finally {
    runtime.stop();
  }
});

test("inline resolution translates the server key without consuming its toast", () => {
  const { notices, error } = setup({
    message: "error.read_only_demo",
    severity: "warning",
  });
  const runtime = browserRun(() => {
    const failures = useMutationToast();
    assert.equal(
      failures.errorMessage(error),
      "This public demo is read-only.",
    );
    assert.equal(notices.length, 0);
    failures.reportFailure(error);
    failures.reportFailure({ cause: error });
  });
  try {
    assert.deepEqual(
      notices.map(({ title, color }) => ({ title, color })),
      [{ title: "This public demo is read-only.", color: "warning" }],
    );
  } finally {
    runtime.stop();
  }
});
