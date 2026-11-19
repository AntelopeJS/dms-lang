import { expect } from "chai";
import { failure, field, lang, objects } from "./helpers/api";
import { seed, useWorkspaceStorage } from "./helpers/api-suite";
import { readJson, readText } from "./helpers/files";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const REQUEST_TIMEOUT_MS = 20_000;
const ONE_KEY_COUNTS = {
  localeProgress: { en: 100, fr: 0 },
  localeMissing: { en: 0, fr: 1 },
  totalKeys: 1,
  baseMissing: 0,
  incompleteKeys: 1,
};

describe("[integration] writing keys over the HTTP API", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);

  it("create-translate-read: translates a key, its figures follow, and a changed placeholder is flagged as an issue", async () => {
    const id = "pay";
    await seed(id, { locales: ["en", "fr"] });
    const key = { workspace: id, path: "checkout.pay" };
    const frenchFile = () => readJson(join(storage.folder(id), "fr.json"));
    const created = await lang("POST", "/key", {
      ...key,
      values: { en: "Pay {price}" },
    });
    expect(created.status).to.equal(200);
    expect(field(created.body, "row")).to.deep.equal({
      key: "checkout.pay",
      values: { en: "Pay {price}" },
    });
    expect(field(created.body, "counts")).to.deep.equal(ONE_KEY_COUNTS);

    const wrong = await lang("PUT", "/key", {
      ...key,
      values: { fr: "Payer {prix}" },
    });
    expect(field(wrong.body, "row")).to.deep.equal({
      key: "checkout.pay",
      values: { en: "Pay {price}", fr: "Payer {prix}" },
      issues: ["fr"],
    });
    const left = await lang("PUT", "/key", { ...key, values: { fr: "Payer" } });
    expect(field(left.body, "row")).to.deep.equal({
      key: "checkout.pay",
      values: { en: "Pay {price}", fr: "Payer" },
      issues: ["fr"],
    });
    const right = await lang("PUT", "/key", {
      ...key,
      values: { fr: "Payer {price}" },
    });
    expect(field(right.body, "row")).to.deep.equal({
      key: "checkout.pay",
      values: { en: "Pay {price}", fr: "Payer {price}" },
    });
    expect(field(right.body, "counts", "localeMissing")).to.deep.equal({
      en: 0,
      fr: 0,
    });
    expect(frenchFile()).to.deep.equal({ checkout: { pay: "Payer {price}" } });

    const cleared = await lang("PUT", "/key", { ...key, values: { fr: "" } });
    const last = await lang("PUT", "/key", {
      ...key,
      values: { en: null, fr: null },
    });
    expect(field(cleared.body, "row")).to.deep.equal({
      key: "checkout.pay",
      values: { en: "Pay {price}" },
    });
    expect(failure(last)).to.deep.equal([409, "last_value"]);
  });

  it("key-path-rules: refuses an existing key, a key under or above a text, a bad path and an undeclared language", async () => {
    const id = "paths";
    await seed(id, { keys: { "a.b": { en: "x" } } });
    const cases: [string, string, string, number, string][] = [
      ["a key that exists", "a.b", "en", 409, "key_exists"],
      ["a key under a text", "a.b.c", "en", 409, "key_conflict"],
      ["a key above a text", "a", "en", 409, "key_conflict"],
      ["an empty path", "", "en", 400, "invalid_body"],
      ["an empty segment", "x..y", "en", 400, "invalid_key_path"],
      ["a space in the path", "a.with space", "en", 400, "invalid_key_path"],
      ["an accent in the path", "a.été", "en", 400, "invalid_key_path"],
      ["a prototype name", "__proto__.x", "en", 400, "invalid_key_path"],
      ["an undeclared language", "a.c", "de", 400, "undeclared_locale"],
    ];
    for (const [label, path, locale, status, code] of cases) {
      const answer = await lang("POST", "/key", {
        workspace: id,
        path,
        values: { [locale]: "y" },
      });
      expect(failure(answer), label).to.deep.equal([status, code]);
    }
    const flat = await lang("GET", `/flat?workspace=${id}`);
    expect(objects(flat.body, "rows").map((row) => row.key)).to.deep.equal([
      "a.b",
    ]);
  });
});

describe("[integration] message syntax over the HTTP API", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);

  it("message-syntax: refuses a bare @ and an open brace, accepts a quoted @ and plurals, and keeps the old text on a bad update", async () => {
    const id = "syntax";
    await seed(id);
    const bad = ["jane@example.com", "Hello {name", "a } b"];
    for (const [index, text] of bad.entries()) {
      const answer = await lang("POST", "/key", {
        workspace: id,
        path: `bad.k${index}`,
        values: { en: text },
      });
      expect(failure(answer), text).to.deep.equal([400, "invalid_message"]);
      expect(field(answer.body, "locale")).to.equal("en");
    }
    const good = [
      "jane{'@'}example.com",
      "Hello {name}",
      "no apples | one apple | {count} apples",
    ];
    for (const [index, text] of good.entries()) {
      const answer = await lang("POST", "/key", {
        workspace: id,
        path: `good.k${index}`,
        values: { en: text },
      });
      expect(answer.status, text).to.equal(200);
      expect(field(answer.body, "row", "values")).to.deep.equal({ en: text });
    }
    const update = await lang("PUT", "/key", {
      workspace: id,
      path: "good.k1",
      values: { en: "Hello {name" },
    });
    expect(failure(update)).to.deep.equal([400, "invalid_message"]);
    expect(
      field(readJson(join(storage.folder(id), "en.json")), "good", "k1"),
    ).to.equal("Hello {name}");
  });
});

describe("[integration] changing keys over the HTTP API", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);
  const file = (id: string, locale: string) =>
    readJson(join(storage.folder(id), `${locale}.json`));

  it("update-conflict: refuses a save that expected the old text of another editor and names the current text", async () => {
    await seed("conflict", {
      locales: ["en", "fr"],
      keys: { "a.b": { en: "One", fr: "Un" } },
    });
    const save = (fr: string) =>
      lang("PUT", "/key", {
        workspace: "conflict",
        path: "a.b",
        values: { fr },
        expected: { fr: "Un" },
      });
    const first = await save("Une");
    const second = await save("Uno");
    expect(first.status).to.equal(200);
    expect([
      second.status,
      field(second.body, "code"),
      field(second.body, "current"),
    ]).to.deep.equal([409, "conflict", { fr: "Une" }]);
    expect(file("conflict", "fr")).to.deep.equal({ a: { b: "Une" } });
  });

  it("rename-and-delete-a-key: moves every language's text on a rename, removes the key everywhere on a delete, and the figures follow", async () => {
    const id = "moving";
    await seed(id, {
      locales: ["en", "fr"],
      keys: {
        "cart.title": { en: "Cart", fr: "Panier" },
        "cart.empty": { en: "Empty" },
      },
    });
    const post = (path: string, newPath: string) =>
      lang("POST", "/key/rename", { workspace: id, path, newPath });
    const renamed = await post("cart.title", "basket.title");
    expect(field(renamed.body, "row")).to.deep.equal({
      key: "basket.title",
      values: { en: "Cart", fr: "Panier" },
    });
    expect(file(id, "en")).to.deep.equal({
      cart: { empty: "Empty" },
      basket: { title: "Cart" },
    });
    expect(file(id, "fr")).to.deep.equal({ basket: { title: "Panier" } });
    expect(failure(await post("basket.title", "cart.empty"))).to.deep.equal([
      409,
      "key_exists",
    ]);
    expect(failure(await post("basket.title", "basket.title"))).to.deep.equal([
      400,
      "invalid_key_path",
    ]);
    expect(failure(await post("no.key", "no.other"))).to.deep.equal([
      404,
      "key_not_found",
    ]);

    const del = () =>
      lang("DELETE", "/key", { workspace: id, path: "basket.title" });
    const deleted = await del();
    expect(deleted.status).to.equal(200);
    expect(field(deleted.body, "counts")).to.deep.equal(ONE_KEY_COUNTS);
    expect(file(id, "en")).to.deep.equal({ cart: { empty: "Empty" } });
    expect(file(id, "fr")).to.deep.equal({});
    expect(failure(await del())).to.deep.equal([404, "key_not_found"]);
  });

  it("mark-reviewed: flags a translation written for an older base text until the key is marked reviewed, 404 for an unknown key, refused on the project files", async () => {
    const id = "review";
    await seed(id, {
      locales: ["en", "fr"],
      keys: { "a.b": { en: "Hi", fr: "Salut" } },
    });
    const row = async () =>
      field(
        (await lang("GET", `/row?workspace=${id}&key=a.b`)).body,
        "row",
        "outdated",
      );
    expect(await row()).to.equal(undefined);
    await lang("PUT", "/key", {
      workspace: id,
      path: "a.b",
      values: { en: "Hello" },
    });
    expect(await row()).to.deep.equal(["fr"]);
    const reviewed = await lang("POST", "/key/reviewed", {
      workspace: id,
      path: "a.b",
      locales: ["fr"],
    });
    expect(await row()).to.equal(undefined);
    expect(reviewed.status).to.equal(200);
    expect(field(reviewed.body, "row", "values")).to.deep.equal({
      en: "Hello",
      fr: "Salut",
    });
    const unknown = await lang("POST", "/key/reviewed", {
      workspace: id,
      path: "no.such",
    });
    const project = await lang("POST", "/key/reviewed", {
      workspace: "default",
      path: "shop.title",
    });
    expect(failure(unknown)).to.deep.equal([404, "key_not_found"]);
    expect([project.status, field(project.body, "message")]).to.deep.equal([
      400,
      "$dms_lang.errors.review_added_only",
    ]);
  });
});

/** Whether writing `french` as the French text of a key whose base text is `base` reports an issue for French. */
async function reportsIssue(
  workspace: string,
  path: string,
  base: string,
  french: string,
): Promise<boolean> {
  await lang("POST", "/key", { workspace, path, values: { en: base } });
  const written = await lang("PUT", "/key", {
    workspace,
    path,
    values: { fr: french },
  });
  const issues = field(written.body, "row", "issues");
  return Array.isArray(issues) && issues.includes("fr");
}

describe("[integration] what makes a translation an issue, over the HTTP API", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  useWorkspaceStorage(true);

  it("edge-spaces-are-an-issue: flags a space at an end the base text does not have, not one the base has", async () => {
    await seed("edges", { locales: ["en", "fr"] });
    expect(
      await reportsIssue("edges", "a.trailing", "Hello", "Salut "),
    ).to.equal(true);
    expect(
      await reportsIssue("edges", "a.leading", "Hello", " Salut"),
    ).to.equal(true);
    expect(await reportsIssue("edges", "a.same", "Hello ", "Salut ")).to.equal(
      false,
    );
    expect(await reportsIssue("edges", "a.plain", "Hello", "Salut")).to.equal(
      false,
    );
  });

  it("plural-forms-must-match-the-base: flags another number of plural forms than the base, not the same number", async () => {
    await seed("forms", { locales: ["en", "fr"] });
    expect(await reportsIssue("forms", "a.few", "one | many", "une")).to.equal(
      true,
    );
    expect(
      await reportsIssue("forms", "a.same", "one | many", "une | plusieurs"),
    ).to.equal(false);
    expect(
      await reportsIssue(
        "forms",
        "a.more",
        "one | many",
        "zero | une | plusieurs",
      ),
    ).to.equal(true);
  });

  it("plural-messages-may-use-count-and-n: lets a plural translation use {count} and {n} without the base naming them, not a plain text", async () => {
    await seed("implicit", { locales: ["en", "fr"] });
    const plural = "no apples | many apples";
    expect(
      await reportsIssue("implicit", "a.n", plural, "aucune | {n} pommes"),
    ).to.equal(false);
    expect(
      await reportsIssue(
        "implicit",
        "a.count",
        plural,
        "aucune | {count} pommes",
      ),
    ).to.equal(false);
    expect(
      await reportsIssue("implicit", "a.plain", "Hello", "Salut {n}"),
    ).to.equal(true);
    expect(
      await reportsIssue(
        "implicit",
        "a.other",
        plural,
        "aucune | {total} pommes",
      ),
    ).to.equal(true);
  });
});

describe("[integration] texts and files of keys over the HTTP API", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);

  it("spaces-only-text-is-missing: counts a text of spaces only, written in a language file by hand, as no text", async () => {
    const id = "blank";
    await seed(id, {
      locales: ["en", "fr"],
      keys: {
        "a.one": { en: "One", fr: "Un" },
        "a.two": { en: "Two", fr: "Deux" },
      },
    });
    const missing = async () =>
      (await lang("GET", `/flat?workspace=${id}`)).body;
    expect(field(await missing(), "localeMissing", "fr")).to.equal(0);
    writeFileSync(
      join(storage.folder(id), "fr.json"),
      `${JSON.stringify({ a: { one: "Un", two: "   " } }, null, "\t")}\n`,
    );
    const after = await missing();
    expect(field(after, "localeMissing", "fr")).to.equal(1);
    expect(field(after, "localeProgress", "fr")).to.equal(50);
  });

  it("texts-with-edge-values: stores a plural, a quoted at sign, a placeholder at both ends and 1000 letters as typed, and a missing language is not an empty one", async () => {
    const id = "edge";
    await seed(id, { locales: ["en", "fr"] });
    const texts = {
      plural: "no apples | one apple | {count} apples",
      at: "jane{'@'}example.com",
      ends: "{a} and {b}",
      long: "é".repeat(1000),
    };
    for (const [name, text] of Object.entries(texts)) {
      const answer = await lang("POST", "/key", {
        workspace: id,
        path: `edge.${name}`,
        values: { en: text },
      });
      expect(answer.status, name).to.equal(200);
      expect(field(answer.body, "row", "values", "en"), name).to.equal(text);
    }
    const flat = await lang("GET", `/flat?workspace=${id}`);
    expect(field(flat.body, "localeMissing")).to.deep.equal({ en: 0, fr: 4 });
    expect(readJson(join(storage.folder(id), "fr.json"))).to.deep.equal({});
  });

  it("key-segments-are-at-most-128-characters: accepts a segment of 128 characters and refuses 129 as invalid_key_path", async () => {
    await seed("segments");
    const add = (length: number) =>
      lang("POST", "/key", {
        workspace: "segments",
        path: `a.${"s".repeat(length)}`,
        values: { en: "x" },
      });
    expect((await add(128)).status).to.equal(200);
    expect(failure(await add(129))).to.deep.equal([400, "invalid_key_path"]);
  });

  it("files-are-written-back-in-their-own-layout: keeps two-space indentation, CRLF lines and no final newline when a key is written", async () => {
    const id = "layout";
    await seed(id, {
      locales: ["en", "fr"],
      keys: { "a.one": { en: "One", fr: "Un" } },
    });
    const file = join(storage.folder(id), "fr.json");
    writeFileSync(file, '{\r\n  "a": {\r\n    "one": "Un"\r\n  }\r\n}');
    await lang("POST", "/key", {
      workspace: id,
      path: "a.two",
      values: { en: "Two", fr: "Deux" },
    });
    expect(readText(file)).to.equal(
      '{\r\n  "a": {\r\n    "one": "Un",\r\n    "two": "Deux"\r\n  }\r\n}',
    );
  });
});
