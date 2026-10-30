import assert from "node:assert/strict";
import { test } from "node:test";
import { boundedCache } from "../frontend-vue/app/utils/boundedCache.ts";

void test("a bounded cache drops its oldest entry past its limit", () => {
  const cache = boundedCache(2);
  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  assert.equal(cache.has("a"), false);
  assert.equal(cache.get("b"), 2);
  assert.equal(cache.get("c"), 3);
});

void test("setting an entry again makes it the newest", () => {
  const cache = boundedCache(2);
  cache.set("a", 1);
  cache.set("b", 2);
  assert.equal(cache.set("a", 10), 10);
  cache.set("c", 3);
  assert.equal(cache.get("a"), 10);
  assert.equal(cache.has("b"), false);
});

void test("a cache keeps a null value apart from a missing one", () => {
  const cache = boundedCache(2);
  cache.set("refused", null);
  assert.equal(cache.has("refused"), true);
  assert.equal(cache.get("refused"), null);
  assert.equal(cache.has("other"), false);
});
