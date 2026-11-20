import { expect } from "chai";
import { addLanguageAction } from "../automation/actions/add-language";
import { createKeyAction } from "../automation/actions/create-key";
import { markReviewedAction } from "../automation/actions/mark-reviewed";
import { setTranslationAction } from "../automation/actions/set-translation";
import { resolveRow } from "../utils/resolve";
import { useWorkspaceStorage } from "./helpers/api-suite";
import { failureOf, step, withEditable } from "./helpers/automation";
import { join } from "node:path";
import { folderContents, readText } from "./helpers/files";
import { seedWorkspace } from "./helpers/lang-seed";

const TIMEOUT_MS = 20_000;

describe("[integration] Lang write actions: set-translation and create-key", function () {
  this.timeout(TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);

  const contents = (id: string) => folderContents(storage.folder(id));

  it("set-translation: writes, reads back, clears, and refuses a stale expected text, the last text and a broken message", async () => {
    await seedWorkspace("shop", ["en", "fr"], { "cart.title": { en: "Cart" } });
    const written = await step(setTranslationAction, {
      workspace: "shop",
      key: "cart.title",
      locale: "fr",
      text: "Panier",
    });
    expect(written).to.deep.equal({
      workspace: "shop",
      key: "cart.title",
      locale: "fr",
      text: "Panier",
      previousText: "",
      changed: true,
      isBase: false,
      coverage: 100,
      missing: 0,
    });
    expect(resolveRow("shop", "cart.title")?.values.fr).to.equal("Panier");
    const stale = await failureOf(
      step(setTranslationAction, {
        workspace: "shop",
        key: "cart.title",
        locale: "fr",
        text: "Chariot",
        checkExpected: true,
        expectedText: "",
      }),
    );
    expect(stale).to.match(/\(conflict\)$/);
    const cleared = await step(setTranslationAction, {
      workspace: "shop",
      key: "cart.title",
      locale: "fr",
      text: " ",
    });
    expect([cleared.text, cleared.previousText, cleared.missing]).to.deep.equal(
      ["", "Panier", 1],
    );
    expect(
      await failureOf(
        step(setTranslationAction, {
          workspace: "shop",
          key: "cart.title",
          locale: "en",
          text: "",
        }),
      ),
    ).to.match(/\(last_value\)$/);
    expect(
      await failureOf(
        step(setTranslationAction, {
          workspace: "shop",
          key: "cart.title",
          locale: "fr",
          text: "Hello {name",
        }),
      ),
    ).to.match(/\(invalid_message\)$/);
    expect(
      await failureOf(
        step(setTranslationAction, {
          workspace: "modules",
          key: "a",
          locale: "en",
          text: "x",
        }),
      ),
    ).to.match(/read-only \(read_only\)$/);
  });

  it("set-translation dry run: writes no file and answers what the real run then answers", async () => {
    await seedWorkspace("dry", ["en", "fr"], { greeting: { en: "Hello" } });
    const before = contents("dry");
    const input = {
      workspace: "dry",
      key: "greeting",
      locale: "fr",
      text: "Bonjour",
    };
    const simulated = await step(setTranslationAction, input, true);
    expect(contents("dry")).to.deep.equal(before);
    expect(await step(setTranslationAction, input)).to.deep.equal(simulated);
  });
});

describe("[integration] Lang write actions: editable gate", function () {
  this.timeout(TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);
  const contents = (id: string) => folderContents(storage.folder(id));

  it("editable-false: fails execute and dry run with read_only before any read, the workspace untouched", async () => {
    await seedWorkspace("locked", ["en", "fr"], { a: { en: "A" } });
    const before = contents("locked");
    const input = { workspace: "locked", key: "a", locale: "fr", text: "A" };
    await withEditable(false, async () => {
      for (const dryRun of [false, true])
        expect(
          await failureOf(step(setTranslationAction, input, dryRun)),
        ).to.equal(
          "Lang editing is off on this process (editable: false); lang.set-translation writes nothing here (read_only)",
        );
    });
    expect(contents("locked")).to.deep.equal(before);
  });

  it("create-key: creates with base text and translations, places it before a sibling, refuses an existing key, and a dry run creates nothing", async () => {
    await seedWorkspace("keys", ["en", "fr"], {
      "nav.home": { en: "Home" },
      "nav.help": { en: "Help" },
    });
    const created = await step(createKeyAction, {
      workspace: "keys",
      key: "nav.shop",
      baseText: "Shop",
      texts: { fr: "Boutique" },
      before: "nav.help",
    });
    expect(created).to.deep.equal({
      workspace: "keys",
      key: "nav.shop",
      locales: ["fr", "en"],
      totalKeys: 3,
    });
    expect(readText(join(storage.folder("keys"), "en.json"))).to.match(
      /"home"[\s\S]*"shop"[\s\S]*"help"/,
    );
    expect(
      await failureOf(
        step(createKeyAction, {
          workspace: "keys",
          key: "nav.shop",
          baseText: "Again",
        }),
      ),
    ).to.match(/\(key_exists\)$/);
    const before = contents("keys");
    const simulated = await step(
      createKeyAction,
      { workspace: "keys", key: "nav.cart", baseText: "Cart" },
      true,
    );
    expect(simulated.totalKeys).to.equal(4);
    expect(contents("keys")).to.deep.equal(before);
  });
});

describe("[integration] Lang write actions: reviews and languages", function () {
  this.timeout(TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);
  const contents = (id: string) => folderContents(storage.folder(id));

  it("mark-reviewed: takes an outdated translation out of the queue, refused on the project files, nothing changed by a dry run", async () => {
    await seedWorkspace("review", ["en", "fr"], {
      title: { en: "Title", fr: "Titre" },
    });
    await step(setTranslationAction, {
      workspace: "review",
      key: "title",
      locale: "en",
      text: "Heading",
    });
    expect(resolveRow("review", "title")?.outdated).to.deep.equal(["fr"]);
    const before = contents("review");
    const simulated = await step(
      markReviewedAction,
      { workspace: "review", key: "title" },
      true,
    );
    expect(simulated).to.deep.equal({
      workspace: "review",
      key: "title",
      reviewed: ["fr"],
      stillOutdated: [],
    });
    expect(contents("review")).to.deep.equal(before);
    expect(
      await step(markReviewedAction, { workspace: "review", key: "title" }),
    ).to.deep.equal(simulated);
    expect(resolveRow("review", "title")?.outdated).to.equal(undefined);
    expect(
      await failureOf(
        step(markReviewedAction, { workspace: "default", key: "title" }),
      ),
    ).to.match(/\(added_only\)$/);
  });

  it("add-language: adds a language, names the same language beside it, refuses a duplicate and an unknown code, and a dry run adds no file", async () => {
    await seedWorkspace("langs", ["en", "fr"], { a: { en: "A" } });
    expect(
      await step(addLanguageAction, { workspace: "langs", code: "fr-be" }),
    ).to.deep.equal({
      workspace: "langs",
      code: "fr-BE",
      sameLanguage: ["fr"],
      totalKeys: 1,
      missing: 1,
    });
    expect(
      await failureOf(
        step(addLanguageAction, { workspace: "langs", code: "FR" }),
      ),
    ).to.match(/\(locale_exists\)$/);
    expect(
      await failureOf(
        step(addLanguageAction, { workspace: "langs", code: "zz" }),
      ),
    ).to.match(/\(invalid_locale\)$/);
    expect(
      await failureOf(
        step(addLanguageAction, { workspace: "default", code: "de" }),
      ),
    ).to.match(/\(added_only\)$/);
    await step(addLanguageAction, { workspace: "langs", code: "de" }, true);
    expect(storage.files("langs")).to.not.include("de.json");
  });
});
