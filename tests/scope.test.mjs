import assert from "node:assert/strict";
import { test } from "node:test";
import { coveragePercent } from "../frontend-vue/app/utils/translations.ts";
import { serverErrorCode } from "../frontend-vue/app/composables/translation/useMutationToast.ts";
import {
  deleteAfterLeaving,
  matchesWorkspace,
  sortWorkspaces,
} from "../frontend-vue/app/utils/workspaces.ts";

test("coverage never rounds a gap up to 100", () => {
  assert.equal(coveragePercent(200, 201), 99);
  assert.equal(coveragePercent(201, 201), 100);
  assert.equal(coveragePercent(2, 3), 66);
  assert.equal(coveragePercent(0, 3), 0);
  assert.equal(coveragePercent(1, 1000), 0);
  assert.equal(coveragePercent(0, 0), 100);
  assert.equal(coveragePercent(29, 100), 29);
});

test("error codes are recognised", () => {
  assert.equal(serverErrorCode({ data: { code: "key_exists" } }), "key_exists");
  assert.equal(serverErrorCode({ data: "text" }), "");
});

test("workspaces are found by name, description or label and sorted", () => {
  const list = [
    { id: "default", coverage: 80 },
    { id: "modules", coverage: 100 },
    { id: "storefront", description: "Shop texts", coverage: 40 },
    { id: "app-mobile", description: "iOS and Android", coverage: 40 },
  ];
  const found = (search, labels) =>
    list
      .filter((workspace) => matchesWorkspace(workspace, search, labels))
      .map((workspace) => workspace.id);
  assert.deepEqual(found("SHOP"), ["storefront"]);
  assert.deepEqual(found(" android "), ["app-mobile"]);
  assert.deepEqual(
    found("project", ["Project files"]),
    list.map((w) => w.id),
  );
  assert.deepEqual(
    found(""),
    list.map((w) => w.id),
  );
  const ids = (sort) => sortWorkspaces(list, sort).map((w) => w.id);
  assert.deepEqual(ids("kind"), [
    "default",
    "modules",
    "storefront",
    "app-mobile",
  ]);
  assert.deepEqual(ids("name"), [
    "app-mobile",
    "default",
    "modules",
    "storefront",
  ]);
  assert.deepEqual(ids("coverage"), [
    "app-mobile",
    "storefront",
    "default",
    "modules",
  ]);
  assert.deepEqual(list[0].id, "default");
});

function deletionSteps(remove) {
  const calls = [];
  const step = (name, run) => async () => {
    calls.push(name);
    await run?.();
  };
  return {
    calls,
    steps: {
      leave: step("leave"),
      remove: step("remove", remove),
      restore: step("restore"),
    },
  };
}

test("a workspace is deleted once the page has left it", async () => {
  const { calls, steps } = deletionSteps();
  await deleteAfterLeaving(steps);
  assert.deepEqual(
    calls,
    ["leave", "remove"],
    "no block still shows the workspace when its deletion is announced",
  );
});

test("a failed deletion brings the page back to the workspace", async () => {
  const failure = new Error("refused");
  const { calls, steps } = deletionSteps(() => Promise.reject(failure));
  await assert.rejects(deleteAfterLeaving(steps), failure);
  assert.deepEqual(calls, ["leave", "remove", "restore"]);
});
