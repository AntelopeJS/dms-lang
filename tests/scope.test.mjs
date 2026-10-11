import assert from "node:assert/strict";
import { test } from "node:test";
import { coveragePercent } from "../frontend-vue/app/utils/translations.ts";
import {
  isConflict,
  serverErrorCode,
} from "../frontend-vue/app/composables/translation/useMutationToast.ts";
import {
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

test("conflicts and error codes are recognised", () => {
  assert.equal(isConflict({ status: 409, data: { code: "conflict" } }), true);
  assert.equal(isConflict({ status: 404 }), false);
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
