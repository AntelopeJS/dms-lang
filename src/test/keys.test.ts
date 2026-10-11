import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
import {
  messageProblemDetails,
  messageProblems,
} from "../utils/message-syntax";
import { createKeyFor, updateKeyFor } from "../utils/mutations";
import { resolveFlat } from "../utils/resolve";
import { markReviewedFor } from "../utils/review";
import type { LocaleMessages } from "../utils/tree";
import { addLocale, createWorkspace } from "../utils/workspaces";
import { expectError } from "./errors";

interface InvalidMessageBody {
  message: string;
  problems?: string[];
}

/** An in-memory key store: `files` is what the writes produce. */
function memoryStore(
  files: LocaleMessages,
  reference: LocaleMessages = {},
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

function storefront(): LocaleMessages {
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
    const files: LocaleMessages = {
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
    expect(Object.keys(files.en.cart as object)).to.deep.equal([
      "title",
      "badge",
      "empty",
    ]);
    expect(Object.keys(files.fr.cart as object)).to.deep.equal([
      "badge",
      "empty",
    ]);
  });

  it("puts a key back at its base rank in a language that lacks the sibling it followed", () => {
    const files: LocaleMessages = {
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
    expect(Object.keys(files.en.cart as object)).to.deep.equal([
      "title",
      "empty",
      "items",
      "total",
    ]);
    expect(Object.keys(files.nl.cart as object)).to.deep.equal([
      "title",
      "empty",
      "total",
    ]);
    expectError(
      () => createKey(memoryStore(files), "cart.more", { en: "x" }, 42),
      400,
      "invalid_body",
    );
  });

  it("appends a key whose sibling is gone and refuses a sibling from another namespace", () => {
    const files = storefront();
    createKey(memoryStore(files), "nav.about", { en: "About" }, "nav.gone");
    expect(Object.keys(files.en.nav as object)).to.deep.equal([
      "home",
      "linked",
      "about",
    ]);
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
    const files: LocaleMessages = { en: {}, fr: {} };
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
    const files: LocaleMessages = {
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
  it("accepts only texts and null as values", () => {
    const store = memoryStore(storefront());
    expectError(
      () => createKey(store, "a.obj", { en: { nested: "o" } }),
      400,
      "invalid_value",
    );
    expectError(
      () => createKey(store, "a.num", { en: 42 }),
      400,
      "invalid_value",
    );
    expectError(
      () => createKey(store, "a.bool", { fr: true }),
      400,
      "invalid_value",
    );
    expectError(
      () => createKey(store, "a.blank", { en: " " }),
      400,
      "invalid_value",
    );
    expectError(
      () => createKey(store, "a.de", { de: "x" }),
      400,
      "unknown_locale",
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
      messageProblems("jane{'@'}example.com {name} @:nav.home @.lower:a"),
    ).to.deep.equal([]);
    expect(messageProblems("Hello {name")).to.deep.equal(["unclosed_brace"]);
    expect(messageProblems("a } b")).to.deep.equal(["unbalanced_brace"]);
    expect(messageProblems("{first-name} | {count} items")).to.deep.equal([]);
  });

  it("applies the vue-i18n rule for variable names, the one the interface applies", () => {
    for (const name of ["prénom", "user.name", "名前", "$amount", "1a"])
      expect(messageProblems(`Hi {${name}}`), name).to.deep.equal([
        "invalid_placeholder",
      ]);
    for (const name of ["name", "_x", "first-name", "a$b", "0", " name "])
      expect(messageProblems(`Hi {${name}}`), name).to.deep.equal([]);
  });

  it("explains each problem once in a readable message, without the codes", () => {
    const store = memoryStore(storefront());
    const body = expectError(
      () =>
        updateKey(store, "nav.home", { fr: "Texte {company} pour {prénom}" }),
      400,
      "invalid_message",
    );
    expect((body as InvalidMessageBody).problems).to.deep.equal([
      "invalid_placeholder",
    ]);
    expect(body.message).to.contain("{prénom}");
    expect(body.message).not.to.contain("invalid_placeholder");
    expect(messageProblemDetails("a@b {x y}")).to.have.length(2);
  });
});

describe("[unit] language codes", () => {
  it("normalizes codes to canonical BCP 47 and refuses unknown languages", () => {
    expect(normalizeLocaleCode("fr_FR")).to.equal("fr-FR");
    expect(normalizeLocaleCode("zh-hant-tw")).to.equal("zh-Hant-TW");
    expect(normalizeLocaleCode("EN-gb")).to.equal("en-GB");
    expect(canonicalLocale("not a code")).to.equal(undefined);
    for (const code of ["xyz", "fr-XY", "", 42]) {
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
    createKeyFor(workspace, "home.title", { en: "Home", fr: "Accueil" });
  });

  after(() => {
    setTranslationConfig(previous);
    rmSync(directory, { recursive: true, force: true });
  });

  const outdatedOf = (path: string) =>
    resolveFlat(workspace).rows.find((row) => row.key === path)?.outdated;

  it("takes a translation out of To review without changing its text", () => {
    updateKeyFor(workspace, "home.title", { en: "Homepage" });
    expect(outdatedOf("home.title")).to.deep.equal(["fr"]);
    markReviewedFor(workspace, "home.title", ["fr"]);
    expect(outdatedOf("home.title")).to.equal(undefined);
    expect(
      JSON.parse(
        readFileSync(join(directory, "ws", workspace, "fr.json"), "utf-8"),
      ),
    ).to.deep.equal({ home: { title: "Accueil" } });
    expectError(
      () => markReviewedFor("default", "home.title"),
      400,
      "invalid_body",
    );
  });

  it("writes a file back with its own line ends and indentation", () => {
    const crlf = join(directory, "crlf.json");
    writeFileSync(crlf, '{\r\n    "a": "1"\r\n}\r\n');
    writeJson(crlf, { a: "1", b: "2" });
    expect(readFileSync(crlf, "utf-8")).to.equal(
      '{\r\n    "a": "1",\r\n    "b": "2"\r\n}\r\n',
    );
    const fresh = join(directory, "fresh.json");
    writeJson(fresh, { a: "1" });
    expect(readFileSync(fresh, "utf-8")).to.equal('{\n\t"a": "1"\n}\n');
  });
});
