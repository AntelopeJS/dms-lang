import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cloneFlat,
  formatTokens,
  isRowValueMissing,
  languageCoverage,
  missingPlaceholders,
  namespaceCoverage,
  namespaceOf,
  placeholdersOf,
  refreshCounts,
  resolveDefaultLocale,
  rowHasIssue,
} from "../frontend-vue/app/utils/translations.ts";
import {
  canonicalLocale,
  isRightToLeft,
} from "../frontend-vue/app/utils/languages.ts";

const flat = {
  defaultLocale: "en",
  locales: ["en", "fr", "it"],
  rows: [
    {
      key: "checkout.cta",
      values: { en: "Pay {amount} now", fr: "Payer {amount}", it: undefined },
    },
    {
      key: "checkout.title",
      values: { en: "Checkout", fr: "Paiement", it: "Cassa" },
    },
    { key: "emails.intro", values: { en: "Hi {name}", fr: "Bonjour", it: "" } },
  ],
  localeProgress: {},
  localeMissing: {},
  totalKeys: 3,
};

test("translation default comes from the fallback chain", () => {
  assert.equal(resolveDefaultLocale("fr"), "fr");
  assert.equal(resolveDefaultLocale(["nl", "en"]), "nl");
  assert.equal(
    resolveDefaultLocale({ fr: ["de"], default: ["it", "en"] }),
    "it",
  );
  assert.equal(resolveDefaultLocale([]), "en");
  assert.equal(resolveDefaultLocale(false), "en");
  assert.equal(resolveDefaultLocale({ fr: ["de"] }), "en");
});

test("placeholders are read from the text and compared with the base", () => {
  assert.deepEqual(placeholdersOf("Pay {amount} now, {amount} {user.name}"), [
    "amount",
    "user.name",
  ]);
  assert.deepEqual(missingPlaceholders("Pay {amount} now", "Pagar ahora"), [
    "amount",
  ]);
  assert.deepEqual(
    missingPlaceholders("Pay {amount} now", "Payer { amount }"),
    [],
  );
  assert.deepEqual(missingPlaceholders("Pay {amount} now", ""), []);
  assert.equal(formatTokens(["amount", "name"]), "{amount} {name}");
});

test("a placeholder issue is only reported on a translation", () => {
  const [cta, , intro] = flat.rows;
  assert.equal(rowHasIssue(cta, "en", "fr"), false);
  assert.equal(rowHasIssue(intro, "en", "fr"), true);
  assert.equal(rowHasIssue(intro, "en", "en"), false);
  assert.equal(rowHasIssue(intro, "en", "it"), false);
});

test("coverage is counted per language and per namespace", () => {
  const coverage = languageCoverage(flat, (code) => code.toUpperCase());
  assert.deepEqual(
    coverage.map(({ code, isBase, coverage: percent, missing }) => ({
      code,
      isBase,
      percent,
      missing,
    })),
    [
      { code: "en", isBase: true, percent: 100, missing: 0 },
      { code: "fr", isBase: false, percent: 100, missing: 0 },
      { code: "it", isBase: false, percent: 33, missing: 2 },
    ],
  );
  assert.equal(namespaceOf("checkout.cta"), "checkout");
  assert.equal(namespaceOf("root"), "root");
  const [checkout, emails] = namespaceCoverage(flat.rows, ["it"]);
  assert.deepEqual(checkout, {
    namespace: "checkout",
    keys: 2,
    coverage: { it: 50 },
    missing: { it: 1 },
  });
  assert.deepEqual(emails, {
    namespace: "emails",
    keys: 1,
    coverage: { it: 0 },
    missing: { it: 1 },
  });
});

test("a local edit recomputes the counts without touching the source", () => {
  const next = cloneFlat(flat);
  next.rows[0].values.it = "Paga {amount}";
  const counted = refreshCounts(next);
  assert.equal(flat.rows[0].values.it, undefined);
  assert.deepEqual(counted.localeMissing, { en: 0, fr: 0, it: 1 });
  assert.deepEqual(counted.localeProgress, { en: 100, fr: 100, it: 67 });
});

test("language codes are canonicalised and right-to-left scripts detected", () => {
  assert.equal(canonicalLocale(" pt-br "), "pt-BR");
  assert.equal(canonicalLocale("not a code"), null);
  assert.equal(isRightToLeft("ar-SA"), true);
  assert.equal(isRightToLeft("fr"), false);
});

test("a value a module gives a project key is not missing", () => {
  const row = {
    key: "menu.home",
    values: { fr: undefined },
    inherited: { fr: "Accueil" },
  };
  assert.equal(isRowValueMissing(row, "fr"), false);
  assert.equal(isRowValueMissing({ key: "menu.home", values: {} }, "fr"), true);
});
