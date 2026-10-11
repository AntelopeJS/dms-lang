import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkMessage,
  cloneFlat,
  escapeMessage,
  formatTokens,
  hasBlockingIssue,
  isLocaleValueMissing,
  isValidKeyPath,
  keyPathConflict,
  isRowValueMissing,
  languageCoverage,
  MESSAGE_ISSUE_LABELS,
  messageIssueText,
  missingPlaceholders,
  namespaceCoverage,
  namespaceOf,
  nextSiblingPath,
  placeholdersOf,
  refreshCounts,
  replacePlaceholder,
  rowHasIssue,
  scanMessage,
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

test("placeholders are read from the text and compared with the base", () => {
  assert.deepEqual(placeholdersOf("Pay {amount} now, {amount} {user_name}"), [
    "amount",
    "user_name",
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

const issueSummary = (base, value) =>
  checkMessage(base, value).map(({ kind, tokens, count, expected }) => {
    const summary = { kind, tokens, count };
    if (expected !== undefined) summary.expected = expected;
    return summary;
  });

test("variables a translation drops or invents are reported", () => {
  assert.deepEqual(issueSummary("Hello {name}", "Bonjour {nmae}"), [
    { kind: "missing", tokens: ["name"], count: 1 },
    { kind: "extra", tokens: ["nmae"], count: 1 },
  ]);
  assert.deepEqual(issueSummary("Hello {name}", "Hallo {name} {extra}"), [
    { kind: "extra", tokens: ["extra"], count: 1 },
  ]);
  assert.deepEqual(
    issueSummary("Use {'{'}name{'}'}", "Utilisez la syntaxe {name}"),
    [{ kind: "extra", tokens: ["name"], count: 1 }],
  );
  assert.deepEqual(issueSummary("Hi {name}", ""), []);
});

test("a variable name follows the vue-i18n rule the server applies", () => {
  const syntax = (value) => issueSummary("", value).map((issue) => issue.kind);
  for (const name of ["prénom", "user.name", "名前", "$amount", "1a", "a b"])
    assert.deepEqual(syntax(`Hi {${name}}`), ["invalidPlaceholder"], name);
  for (const name of [
    "name",
    "_x",
    "first-name",
    "a$b",
    "Count2",
    "0",
    " name ",
  ])
    assert.deepEqual(syntax(`Hi {${name}}`), [], name);
  const [invalid] = checkMessage("Hi {name}", "Salut {prénom}");
  assert.equal(invalid.severity, "error");
  assert.deepEqual(invalid.tokens, ["{prénom}"]);
  assert.equal(
    hasBlockingIssue(checkMessage("Hi {name}", "Salut {prénom}")),
    true,
  );
});

test("a translation keeps the number of plural forms of the base", () => {
  assert.deepEqual(
    issueSummary("no items | one item | {count} items", "{count} articles"),
    [{ kind: "plural", tokens: [], count: 1, expected: 3 }],
  );
  assert.deepEqual(
    issueSummary(
      "{count} item | {count} items",
      "{n} élément | {count} éléments",
    ),
    [],
  );
});

test("syntax vue-i18n cannot compile is an error", () => {
  const syntax = (value) => issueSummary("", value).map((issue) => issue.kind);
  assert.deepEqual(syntax("Écrivez à contact@exemple.com"), ["bareAt"]);
  assert.deepEqual(syntax("Mail {email} @ ons"), ["bareAt"]);
  assert.deepEqual(syntax("Total {amount"), ["unclosedBrace"]);
  assert.deepEqual(syntax("Totaal }"), ["strayBrace"]);
  assert.deepEqual(syntax("{} { a b } {'abc}"), [
    "emptyPlaceholder",
    "invalidPlaceholder",
    "unclosedLiteral",
  ]);
  assert.deepEqual(
    syntax("jane{'@'}example.com @:common.yes @.lower:(a.b)"),
    [],
  );
  assert.equal(hasBlockingIssue(checkMessage("", "a@b")), true);
  assert.equal(hasBlockingIssue(checkMessage("{a}", "b")), false);
});

test("spaces at the ends of a text the base does not have are a warning", () => {
  assert.deepEqual(issueSummary("Sales", "Ventas\n"), [
    { kind: "spaces", tokens: [], count: 1 },
  ]);
  assert.deepEqual(issueSummary("Sales", " Ventas "), [
    { kind: "spaces", tokens: [], count: 2 },
  ]);
  assert.deepEqual(issueSummary("Total: ", "Total : "), []);
  assert.deepEqual(issueSummary("", "Checkout "), [
    { kind: "spaces", tokens: [], count: 1 },
  ]);
  assert.equal(hasBlockingIssue(checkMessage("Sales", "Ventas ")), false);
});

test("a text made of spaces only is no text", () => {
  assert.equal(isLocaleValueMissing("   "), true);
  assert.equal(isLocaleValueMissing("\n"), true);
  assert.equal(isLocaleValueMissing(" a "), false);
  assert.deepEqual(checkMessage("Sales", "   "), []);
});

test("a deleted key goes back before what followed it in its namespace", () => {
  const keys = ["cart.title", "cart.badge", "cart.items.one", "nav.home"];
  assert.equal(nextSiblingPath(keys, "cart.title"), "cart.badge");
  assert.equal(nextSiblingPath(keys, "cart.badge"), "cart.items");
  assert.equal(nextSiblingPath(keys, "cart.items.one"), undefined);
  assert.equal(nextSiblingPath(keys, "nav.home"), undefined);
  assert.equal(nextSiblingPath(keys, "gone"), undefined);
  assert.equal(nextSiblingPath(["a", "b.c"], "a"), "b");
});

test("a message is split into parts that give the text back", () => {
  const text = "x{'@'}y | {n} @:a.b }";
  const { parts } = scanMessage(text);
  assert.equal(parts.map((part) => part.raw).join(""), text);
  assert.deepEqual(
    parts
      .filter((part) => part.kind !== "text")
      .map((part) => `${part.kind}:${part.name}`),
    ["literal:@", "pipe:", "placeholder:n", "linked:a.b"],
  );
});

test("bare characters are escaped and variables renamed", () => {
  assert.equal(escapeMessage("a@b } {c"), "a{'@'}b {'}'} {'{'}c");
  assert.equal(escapeMessage("{name} @:ok"), "{name} @:ok");
  assert.equal(
    replacePlaceholder("voor {bedrijf}, {bedrijf}.", "bedrijf", "company"),
    "voor {company}, {company}.",
  );
});

test("each issue has a sentence with its tokens and count", () => {
  const calls = [];
  const t = (key, named, plural) => {
    calls.push({ key, named, plural });
    return key;
  };
  const [missing, plural] = checkMessage("{a} {b} | {b}", "{c} {d}");
  messageIssueText(missing, t);
  assert.deepEqual(calls[0], {
    key: MESSAGE_ISSUE_LABELS.missing,
    named: { tokens: "{a} {b}", count: 2, expected: 0, fix: "" },
    plural: 2,
  });
  const [bareAt] = checkMessage("", "x@y");
  messageIssueText(bareAt, t);
  assert.equal(calls[1].named.fix, "{'@'}");
  assert.ok(plural);
});

test("a syntax error in the base text is an issue of the base", () => {
  const row = { key: "contact", values: { en: "mail@site", fr: "mail" } };
  assert.equal(rowHasIssue(row, "en", "en"), true);
  assert.equal(rowHasIssue(row, "en", "fr"), false);
});

test("a new key path may not overlap an existing key", () => {
  const keys = ["nav.home", "nav.linked", "checkout.title"];
  assert.deepEqual(keyPathConflict("nav.home", keys), {
    kind: "exists",
    keys: ["nav.home"],
  });
  assert.deepEqual(keyPathConflict("nav", keys), {
    kind: "namespace",
    keys: ["nav.home", "nav.linked"],
  });
  assert.deepEqual(keyPathConflict("checkout.title.sub", keys), {
    kind: "leafParent",
    keys: ["checkout.title"],
  });
  assert.equal(keyPathConflict("checkout.subtitle", keys), null);
  assert.equal(keyPathConflict("navigation", keys), null);
});

test("a key path is dot-separated safe segments", () => {
  assert.equal(isValidKeyPath("checkout.coupon-code.invalid_1"), true);
  assert.equal(isValidKeyPath("checkout..title"), false);
  assert.equal(isValidKeyPath("has space"), false);
  assert.equal(isValidKeyPath("a.__proto__.b"), false);
  assert.equal(isValidKeyPath("x".repeat(129)), false);
});

test("the vue-i18n compiler decides what does not compile", () => {
  const syntax = (value) => issueSummary("", value).map((issue) => issue.kind);
  assert.deepEqual(syntax("a | | b"), ["emptyPlural"]);
  assert.deepEqual(syntax("{'a\\q'}"), ["invalidEscape"]);
  assert.deepEqual(syntax("{first-name} | {count} items @.upper:{x}"), []);
  const [invalid] = checkMessage("", "Hi {a b} and {c d}");
  assert.deepEqual(invalid.tokens, ["{a b}", "{c d}"]);
  assert.equal(invalid.index, 6);
});
