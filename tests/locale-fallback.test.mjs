import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDefaultLocale } from "../frontend-vue/app/composables/translation/useTranslationProgress.ts";

test("translation default comes from the fallback chain", () => {
  assert.equal(resolveDefaultLocale("fr"), "fr");
  assert.equal(resolveDefaultLocale(["nl", "en"]), "nl");
  assert.equal(
    resolveDefaultLocale({ fr: ["de"], default: ["it", "en"] }),
    "it",
  );
});

test("missing fallback chains use the adapter default", () => {
  assert.equal(resolveDefaultLocale([]), "en");
  assert.equal(resolveDefaultLocale(false), "en");
  assert.equal(resolveDefaultLocale({ fr: ["de"] }), "en");
});
