import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { useQueueToasts } from "../frontend-vue/app/build/composables/useQueueToasts.ts";

function setup() {
  /** @type {Array<{title: string, color: string, actions?: Array<{label: string, onClick: () => void}>}>} */
  const notices = [];
  Object.assign(globalThis, {
    useI18n: () => ({
      /** @param {string} key */
      t: (key) => key,
    }),
    useToast: () => ({
      /** @param {(typeof notices)[number]} notice */
      add: (notice) => notices.push(notice),
    }),
  });
  return { notices, queue: useQueueToasts() };
}

for (const copied of [false, true]) {
  test(`copying a deleted draft shows one outcome toast with copied=${copied}`, async () => {
    const { notices, queue } = setup();
    const writes = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        async writeText(value) {
          writes.push(value);
          if (!copied) throw new Error("Clipboard permission denied");
        },
      },
    });

    queue.announceDeleted("greeting", "Brouillon non enregistré");
    const action = notices[0].actions?.[0];
    assert.ok(action);
    assert.equal(action.label, "dms_lang.queue.copy_draft");
    action.onClick();
    await setImmediate();

    assert.deepEqual(writes, ["Brouillon non enregistré"]);
    assert.deepEqual(
      notices.slice(1),
      copied
        ? [{ title: "dms_lang.queue.copied", color: "success" }]
        : [
            {
              title: "dms_lang.queue.copy_failed",
              description: "Brouillon non enregistré",
              color: "warning",
              icon: "i-ph-copy",
              duration: 15000,
            },
          ],
    );
  });
}

test("blocked local validation shows a warning rather than a red error", () => {
  const { notices, queue } = setup();
  queue.warnBlocked();
  assert.deepEqual(notices, [
    {
      title: "dms_lang.queue.blocked",
      color: "warning",
      icon: "i-ph-warning-circle",
    },
  ]);
});
