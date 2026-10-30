import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "chai";
import {
  getTranslationConfig,
  setTranslationConfig,
  type TranslationConfig,
} from "../utils/config";
import { writeJson } from "../utils/json";
import {
  createKey,
  deleteKey,
  type KeyChange,
  type KeyStore,
  markReviewed,
  removeOverride,
  renameKey,
  updateKey,
} from "../utils/keys";
import { canonicalLocale, normalizeLocaleCode } from "../utils/locale-codes";
import { messageIssues } from "../utils/message-syntax";
import { keyStoreOf, reviewStoreOf } from "../utils/key-stores";
import { resolveFlat } from "../utils/resolve";
import { readText } from "./helpers/files";
import type { LocaleTrees } from "../utils/tree";
import { addLocale, createWorkspace } from "../utils/workspaces";
import { expectError } from "./errors";

function problemsOf(message: string): string[] {
  return messageIssues(message).map((issue) => issue.problem);
}

/** An in-memory key store: `files` is what the writes produce. */
function memoryStore(
  files: LocaleTrees,
  reference: LocaleTrees = {},
): KeyStore {
  return {
    locales: Object.keys(files),
    baseLocale: Object.keys(files)[0] ?? "en",
    messages: files,
    reference,
    load: (locale) => structuredClone(files[locale] ?? {}),
    save: (locale, data) => {
      files[locale] = data;
    },
  };
}

function storefront(): LocaleTrees {
  return {
    en: {
      nav: { home: "Home", linked: "Linked" },
      checkout: { title: "Checkout" },
    },
    fr: { nav: { home: "Accueil" }, checkout: { title: "Paiement" } },
  };
}

describe("[unit] key writes keep the data whole", () => {
  it("refuses a key that is the parent or the child of an existing key", () => {
    const files = storefront();
    const store = memoryStore(files);
    expectError(
      () => createKey(store, "nav", { en: "Navigation" }),
      409,
      "key_conflict",
    );
    expectError(
      () => createKey(store, "checkout.title.sub", { en: "Sub" }),
      409,
      "key_conflict",
    );
    expectError(
      () => createKey(store, "nav.home", { en: "Home" }),
      409,
      "key_exists",
    );
    expect(files).to.deep.equal(storefront());
  });

  it("refuses to create a key on a module namespace or a module key", () => {
    const store = memoryStore(
      { en: {} },
      { en: { page: { auth: { keep: "Keep" } } } },
    );
    expectError(
      () => createKey(store, "page.auth", { en: "x" }),
      409,
      "key_conflict",
    );
    expectError(
      () => createKey(store, "page.auth.keep", { en: "x" }),
      409,
      "module_key",
    );
  });

  it("creates a key with the texts of every language given", () => {
    const files = storefront();
    createKey(memoryStore(files), "cart.title", { en: "Cart", fr: "Panier" });
    expect(files.en.cart).to.deep.equal({ title: "Cart" });
    expect(files.fr.cart).to.deep.equal({ title: "Panier" });
  });

  it("refuses a rename onto an occupied path, in every language, before writing", () => {
    const files = storefront();
    const store = memoryStore(files);
    expectError(
      () => renameKey(store, "nav.linked", "checkout"),
      409,
      "key_conflict",
    );
    expectError(
      () => renameKey(store, "nav.linked", "checkout.title.x"),
      409,
      "key_conflict",
    );
    expectError(
      () => renameKey(store, "nav.linked", "nav.home"),
      409,
      "key_exists",
    );
    expectError(
      () => renameKey(store, "nav.linked", "nav.linked"),
      400,
      "invalid_key_path",
    );
    expectError(
      () => renameKey(store, "missing.key", "x.y"),
      404,
      "key_not_found",
    );
    expect(files).to.deep.equal(storefront());
    renameKey(store, "nav.home", "home.title");
    expect(files.fr).to.deep.equal({
      checkout: { title: "Paiement" },
      home: { title: "Accueil" },
    });
  });
});

describe("[unit] an undone deletion puts the key back in place", () => {
  it("puts a key back before the sibling it followed, in every language that has it", () => {
    const files: LocaleTrees = {
      en: { cart: { title: "Cart", badge: "{n} items", empty: "Empty" } },
      fr: { cart: { empty: "Vide" } },
    };
    const store = memoryStore(files);
    deleteKey(store, "cart.badge");
    createKey(
      memoryStore(files),
      "cart.badge",
      { en: "{n} items", fr: "{n} articles" },
      "cart.empty",
    );
    expect(JSON.stringify(files.en.cart)).to.equal(
      JSON.stringify({ title: "Cart", badge: "{n} items", empty: "Empty" }),
    );
    expect(JSON.stringify(files.fr.cart)).to.equal(
      JSON.stringify({ badge: "{n} articles", empty: "Vide" }),
    );
  });

  it("puts a key back at its base rank in a language that lacks the sibling it followed", () => {
    const files: LocaleTrees = {
      en: {
        cart: { title: "Cart", empty: "Empty", items: "Items", total: "Total" },
      },
      nl: { cart: { title: "Winkelwagen", total: "Totaal" } },
    };
    deleteKey(memoryStore(files), "cart.empty");
    createKey(
      memoryStore(files),
      "cart.empty",
      { en: "Empty", nl: "Leeg" },
      "cart.items",
    );
    expect(JSON.stringify(files.en.cart)).to.equal(
      JSON.stringify({
        title: "Cart",
        empty: "Empty",
        items: "Items",
        total: "Total",
      }),
    );
    expect(JSON.stringify(files.nl.cart)).to.equal(
      JSON.stringify({ title: "Winkelwagen", empty: "Leeg", total: "Totaal" }),
    );
  });

  it("appends a key whose sibling is gone and refuses a sibling from another namespace", () => {
    const files = storefront();
    createKey(memoryStore(files), "nav.about", { en: "About" }, "nav.gone");
    expect(JSON.stringify(files.en.nav)).to.equal(
      JSON.stringify({ home: "Home", linked: "Linked", about: "About" }),
    );
    expectError(
      () =>
        createKey(
          memoryStore(files),
          "nav.help",
          { en: "Help" },
          "checkout.title",
        ),
      400,
      "invalid_body",
    );
  });
});

describe("[unit] key updates never lose a text", () => {
  it("never writes an empty string: clearing a field removes the value", () => {
    const files = storefront();
    updateKey(memoryStore(files), "nav.home", { fr: "" });
    expect(files.fr.nav).to.equal(undefined);
    updateKey(memoryStore(files), "checkout.title", { fr: "   " });
    expect(files.fr).to.deep.equal({});
    expect(JSON.stringify(files)).not.to.contain('""');
  });

  it("overrides only the languages given and falls back to the module for the others", () => {
    const files: LocaleTrees = { en: {}, fr: {} };
    const store = memoryStore(files, {
      en: { banner: "Coming soon" },
      fr: { banner: "Bientôt" },
    });
    updateKey(store, "banner", { fr: "Prochainement" });
    expect(files).to.deep.equal({ en: {}, fr: { banner: "Prochainement" } });
    updateKey(memoryStore(files, store.reference), "banner", { fr: "" });
    expect(files).to.deep.equal({ en: {}, fr: {} });
  });

  it("removes an override so the module text shows again", () => {
    const files: LocaleTrees = {
      en: { banner: "Mine" },
      fr: { banner: "La mienne" },
    };
    const reference = { en: { banner: "Module" } };
    removeOverride(memoryStore(files, reference), "banner", ["fr"]);
    expect(files).to.deep.equal({ en: { banner: "Mine" }, fr: {} });
    expectError(
      () => removeOverride(memoryStore(files, {}), "banner"),
      404,
      "not_an_override",
    );
  });

  it("refuses to clear the last text of a key", () => {
    const store = memoryStore(storefront());
    expectError(
      () => updateKey(store, "nav.linked", { en: "" }),
      409,
      "last_value",
    );
  });

  it("answers 409 with the current values when the expected value is stale", () => {
    const files = storefront();
    const body = expectError(
      () =>
        updateKey(
          memoryStore(files),
          "nav.home",
          { fr: "Mine" },
          { fr: "Old" },
        ),
      409,
      "conflict",
    );
    expect(body.current).to.deep.equal({ fr: "Accueil" });
    updateKey(
      memoryStore(files),
      "nav.home",
      { fr: "Mine" },
      { fr: "Accueil" },
    );
    expect(files.fr.nav).to.deep.equal({ home: "Mine" });
  });

  it("does not recreate a key deleted meanwhile and refuses a namespace", () => {
    const store = memoryStore(storefront());
    expectError(
      () => updateKey(store, "nav.gone", { fr: "x" }),
      404,
      "key_not_found",
    );
    expectError(() => deleteKey(store, "does.not.exist"), 404, "key_not_found");
    expectError(() => deleteKey(store, "nav"), 400, "not_a_key");
  });
});

describe("[unit] key writes validate their input", () => {
  it("refuses a key without text or with a language the workspace lacks", () => {
    const store = memoryStore(storefront());
    expectError(
      () => createKey(store, "a.blank", { en: " " }),
      400,
      "invalid_value",
    );
    expectError(
      () => createKey(store, "a.de", { de: "x" }),
      400,
      "undeclared_locale",
    );
  });

  it("applies one path rule: no spaces, unicode, prototype names or huge segments", () => {
    const store = memoryStore(storefront());
    for (const path of [
      "a.with space",
      "a.trail ",
      "a.été",
      "__proto__.x",
      "constructor.prototype",
      `a.${"x".repeat(129)}`,
    ]) {
      expectError(
        () => createKey(store, path, { en: "x" }),
        400,
        "invalid_key_path",
      );
    }
  });

  it("refuses a vue-i18n message that would not compile", () => {
    const store = memoryStore(storefront());
    expectError(
      () => createKey(store, "a.mail", { en: "jane@example.com" }),
      400,
      "invalid_message",
    );
    expect(
      problemsOf("jane{'@'}example.com {name} @:nav.home @.lower:a"),
    ).to.deep.equal([]);
    expect(problemsOf("Hello {name")).to.deep.equal([
      "unterminated_closing_brace",
    ]);
    expect(problemsOf("a } b")).to.deep.equal(["unbalanced_closing_brace"]);
    expect(problemsOf("{first-name} | {count} items")).to.deep.equal([]);
  });

  it("applies the vue-i18n rule for variable names, the one the interface applies", () => {
    for (const name of ["prénom", "user.name", "名前", "$amount", "1a"])
      expect(problemsOf(`Hi {${name}}`), name).not.to.deep.equal([]);
    for (const name of ["name", "_x", "first-name", "a$b", "0", " name "])
      expect(problemsOf(`Hi {${name}}`), name).to.deep.equal([]);
  });

  it("names each problem once with its sentence key and where it starts", () => {
    const store = memoryStore(storefront());
    const body = expectError(
      () =>
        updateKey(store, "nav.home", { fr: "Texte {company} pour {prénom}" }),
      400,
      "invalid_message",
    );
    expect(body.problems).to.deep.equal(["invalid_token_in_placeholder"]);
    expect(body.details).to.deep.equal([
      "$dms_lang.errors.message_syntax.invalid_token_in_placeholder",
    ]);
    expect(body.issues).to.deep.equal([
      { problem: "invalid_token_in_placeholder", offset: 22 },
    ]);
    expect(body.locale).to.equal("fr");
  });
});

describe("[unit] language codes", () => {
  it("normalizes codes to canonical BCP 47 and refuses unknown languages", () => {
    expect(normalizeLocaleCode("fr_FR")).to.equal("fr-FR");
    expect(normalizeLocaleCode("zh-hant-tw")).to.equal("zh-Hant-TW");
    expect(normalizeLocaleCode("EN-gb")).to.equal("en-GB");
    expect(canonicalLocale("not a code")).to.equal(undefined);
    for (const code of [
      "xyz",
      "fr-XY",
      "",
      "und",
      "en-u-nu-latn",
      "de-x-foo",
    ]) {
      expectError(() => normalizeLocaleCode(code), 400, "invalid_locale");
    }
  });
});

describe("[unit] marking translations as reviewed", () => {
  it("records the current texts of the given languages without writing them", () => {
    const files = storefront();
    const changes: KeyChange[] = [];
    const store = {
      ...memoryStore(files),
      track: (change: KeyChange) => changes.push(change),
    };
    markReviewed(store, "nav.home", ["fr"]);
    expect(changes.map((change) => change.texts)).to.deep.equal([
      { fr: "Accueil" },
    ]);
    expect(files).to.deep.equal(storefront());
    markReviewed(store, "nav.linked");
    expect(changes[1]?.texts).to.deep.equal({});
    expectError(() => markReviewed(store, "nav.gone"), 404, "key_not_found");
  });
});

describe("[integration] review tracking and file layout", () => {
  const workspace = "keys-review";
  let directory: string;
  let previous: TranslationConfig;

  before(() => {
    previous = getTranslationConfig();
    directory = mkdtempSync(join(tmpdir(), "dms-lang-keys-"));
    setTranslationConfig({
      workspacesDir: join(directory, "ws"),
      editable: true,
    });
    createWorkspace(workspace, { code: "en" });
    addLocale(workspace, { code: "fr" });
    createKey(keyStoreOf(workspace), "home.title", {
      en: "Home",
      fr: "Accueil",
    });
  });

  after(() => {
    setTranslationConfig(previous);
    rmSync(directory, { recursive: true, force: true });
  });

  const outdatedOf = (path: string) =>
    resolveFlat(workspace).rows.find((row) => row.key === path)?.outdated;

  it("takes a translation out of To review without changing its text", () => {
    updateKey(keyStoreOf(workspace), "home.title", { en: "Homepage" });
    expect(outdatedOf("home.title")).to.deep.equal(["fr"]);
    markReviewed(reviewStoreOf(workspace), "home.title", ["fr"]);
    expect(outdatedOf("home.title")).to.equal(undefined);
    expect(
      JSON.parse(readText(join(directory, "ws", workspace, "fr.json"))),
    ).to.deep.equal({ home: { title: "Accueil" } });
    expectError(
      () => markReviewed(reviewStoreOf("default"), "home.title"),
      400,
      "invalid_body",
    );
  });

  it("writes a file back with its own line ends and indentation", () => {
    const crlf = join(directory, "crlf.json");
    writeFileSync(crlf, '{\r\n    "a": "1"\r\n}\r\n');
    writeJson(crlf, { a: "1", b: "2" });
    expect(readText(crlf)).to.equal(
      '{\r\n    "a": "1",\r\n    "b": "2"\r\n}\r\n',
    );
    const fresh = join(directory, "fresh.json");
    writeJson(fresh, { a: "1" });
    expect(readText(fresh)).to.equal('{\n\t"a": "1"\n}\n');
  });
});
