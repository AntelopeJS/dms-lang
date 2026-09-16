import assert from "node:assert/strict";
import { test } from "node:test";
import { useLanguageCatalog } from "../frontend-vue/app/composables/translation/useLanguageCatalog.ts";
import { useLocaleMeta } from "../frontend-vue/app/composables/translation/useLocaleMeta.ts";

test("locale labels and flags preserve the module catalog", () => {
  globalThis.useLanguageCatalog = useLanguageCatalog;
  globalThis.useUniqueLocales = () => ({
    uniqueLocales: {
      value: [
        { code: "fr", name: "français" },
        { code: "custom", name: "Custom language" },
      ],
    },
  });
  try {
    const { localeMetaOf } = useLocaleMeta();
    assert.deepEqual(localeMetaOf("fr"), { name: "Français", flag: "fr" });
    assert.deepEqual(localeMetaOf("en"), { name: "English", flag: "gb-ukm" });
    assert.deepEqual(localeMetaOf("custom"), {
      name: "Custom language",
      flag: "",
    });
  } finally {
    delete globalThis.useLanguageCatalog;
    delete globalThis.useUniqueLocales;
  }
});
