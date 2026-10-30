import assert from "node:assert/strict";
import { test } from "node:test";
import { queueViewOf } from "../frontend-vue/app/utils/queueView.ts";

void test("the queue waits for the workspace, not only its translations", () => {
  assert.equal(
    queueViewOf({ isResolved: false, exists: true, isBase: false }),
    "loading",
    "translations in but the workspace list not yet: nothing says it is editable",
  );
});

void test("a resolved workspace shows the queue, the base or an unknown language", () => {
  assert.equal(
    queueViewOf({ isResolved: true, exists: true, isBase: false }),
    "queue",
  );
  assert.equal(
    queueViewOf({ isResolved: true, exists: true, isBase: true }),
    "base",
  );
  assert.equal(
    queueViewOf({ isResolved: true, exists: false, isBase: false }),
    "unknown",
  );
});
