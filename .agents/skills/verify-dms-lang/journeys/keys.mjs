import { freshId, guarded, lang, list, pick, readLocaleFile, seedWorkspace } from "../lang.mjs";

/** @typedef {import("../lang.mjs").Ctx} Ctx */

/** Translation keys: add, translate, rename, delete, and what a text may contain. */
export const journeys = guarded([
  {
    id: "create-translate-read",
    title: "a key added with a base text is translated, its figures follow, and a changed placeholder is flagged as an issue",
    entryPoint: "POST /api/lang/translations/key, PUT /key",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "shop");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"] });
      const created = await lang(ctx, "add a key", "POST", "/key", { workspace: id, path: "checkout.pay", values: { en: "Pay {price}" } });
      await ctx.verify("the key is created and French lacks it", [
        ctx.status(created, 200),
        ctx.equal("row", pick(created.body, "row"), { key: "checkout.pay", values: { en: "Pay {price}" } }),
        ctx.equal("counts", pick(created.body, "counts"), { localeProgress: { en: 100, fr: 0 }, localeMissing: { en: 0, fr: 1 }, totalKeys: 1, baseMissing: 0, incompleteKeys: 1 }),
      ]);
      const wrong = await lang(ctx, "translate with another placeholder", "PUT", "/key", { workspace: id, path: "checkout.pay", values: { fr: "Payer {prix}" } });
      await ctx.verify("a placeholder that differs from the base text is an issue of that language", [
        ctx.status(wrong, 200),
        ctx.equal("row", pick(wrong.body, "row"), { key: "checkout.pay", values: { en: "Pay {price}", fr: "Payer {prix}" }, issues: ["fr"] }),
      ]);
      const left = await lang(ctx, "translate without the placeholder", "PUT", "/key", { workspace: id, path: "checkout.pay", values: { fr: "Payer" } });
      await ctx.verify("a text that leaves a placeholder of the base text out is an issue too", [ctx.equal("row", pick(left.body, "row"), { key: "checkout.pay", values: { en: "Pay {price}", fr: "Payer" }, issues: ["fr"] })]);
      const right = await lang(ctx, "fix the placeholder", "PUT", "/key", { workspace: id, path: "checkout.pay", values: { fr: "Payer {price}" } });
      await ctx.verify("the fixed text carries no issue and the language is complete", [
        ctx.equal("row", pick(right.body, "row"), { key: "checkout.pay", values: { en: "Pay {price}", fr: "Payer {price}" } }),
        ctx.equal("counts", pick(right.body, "counts", "localeMissing"), { en: 0, fr: 0 }),
        ctx.equal("file", readLocaleFile(ctx, id, "fr"), { checkout: { pay: "Payer {price}" } }),
      ]);
      const cleared = await lang(ctx, "clear the translation", "PUT", "/key", { workspace: id, path: "checkout.pay", values: { fr: "" } });
      const last = await lang(ctx, "clear the base text", "PUT", "/key", { workspace: id, path: "checkout.pay", values: { en: null, fr: null } });
      await ctx.verify("an empty text removes the value, the last value of a key cannot be removed", [
        ctx.equal("row after clearing", pick(cleared.body, "row"), { key: "checkout.pay", values: { en: "Pay {price}" } }),
        ctx.equal("the last value", [last.status, pick(last.body, "code")], [409, "last_value"]),
      ]);
    },
  },
  {
    id: "key-path-rules",
    title: "a key path is dotted names; an existing key, a key under a text or an undeclared language is refused",
    entryPoint: "POST /api/lang/translations/key",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "shop");
      await seedWorkspace(ctx, id, { locales: ["en"], keys: { "a.b": { en: "x" } } });
      /** @type {[string, Record<string, unknown>, number, string][]} */
      const cases = [
        ["a key that exists", { path: "a.b", values: { en: "y" } }, 409, "key_exists"],
        ["a key under a text", { path: "a.b.c", values: { en: "y" } }, 409, "key_conflict"],
        ["a key above a text", { path: "a", values: { en: "y" } }, 409, "key_conflict"],
        ["an empty path", { path: "", values: { en: "y" } }, 400, "invalid_body"],
        ["an empty segment", { path: "x..y", values: { en: "y" } }, 400, "invalid_key_path"],
        ["a space in the path", { path: "a.with space", values: { en: "y" } }, 400, "invalid_key_path"],
        ["an accent in the path", { path: "a.été", values: { en: "y" } }, 400, "invalid_key_path"],
        ["a prototype name", { path: "__proto__.x", values: { en: "y" } }, 400, "invalid_key_path"],
        ["an undeclared language", { path: "a.c", values: { de: "y" } }, 400, "undeclared_locale"],
      ];
      for (const [label, body, status, code] of cases) {
        const answer = await lang(ctx, `create ${label}`, "POST", "/key", { workspace: id, ...body });
        await ctx.verify(`${label} is refused`, [ctx.equal("status and code", [answer.status, pick(answer.body, "code")], [status, code])]);
      }
      const flat = await lang(ctx, "read the keys", "GET", `/flat?workspace=${id}`);
      await ctx.verify("none of the refusals wrote a key", [ctx.equal("keys", list(flat.body, "rows").map((row) => row.key), ["a.b"])]);
    },
  },
  {
    id: "message-syntax",
    title: "a message must compile in vue-i18n: a bare @ or an open brace is refused, a quoted @ and plurals are accepted",
    entryPoint: "POST /api/lang/translations/key",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "mail");
      await seedWorkspace(ctx, id, { locales: ["en"] });
      for (const [index, text] of ["jane@example.com", "Hello {name", "a } b"].entries()) {
        const answer = await lang(ctx, `write "${text}"`, "POST", "/key", { workspace: id, path: `bad.k${index}`, values: { en: text } });
        await ctx.verify(`"${text}" is refused as an invalid message`, [ctx.equal("status and code", [answer.status, pick(answer.body, "code")], [400, "invalid_message"]), ctx.equal("locale", pick(answer.body, "locale"), "en")]);
      }
      for (const [index, text] of ["jane{'@'}example.com", "Hello {name}", "no apples | one apple | {count} apples"].entries()) {
        const answer = await lang(ctx, `write "${text}"`, "POST", "/key", { workspace: id, path: `good.k${index}`, values: { en: text } });
        await ctx.verify(`"${text}" is accepted`, [ctx.status(answer, 200), ctx.equal("stored", pick(answer.body, "row", "values"), { en: text })]);
      }
      const update = await lang(ctx, "update a key with a bad message", "PUT", "/key", { workspace: id, path: "good.k1", values: { en: "Hello {name" } });
      await ctx.verify("an update is checked the same way and keeps the old text", [
        ctx.equal("refused", [update.status, pick(update.body, "code")], [400, "invalid_message"]),
        ctx.equal("file", pick(readLocaleFile(ctx, id, "en"), "good", "k1"), "Hello {name}"),
      ]);
    },
  },
  {
    id: "update-conflict",
    title: "a save that expected the old text of another editor is refused with the current text",
    entryPoint: "PUT /api/lang/translations/key with expected",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "shop");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.b": { en: "One", fr: "Un" } } });
      const first = await lang(ctx, "editor A saves", "PUT", "/key", { workspace: id, path: "a.b", values: { fr: "Une" }, expected: { fr: "Un" } });
      const second = await lang(ctx, "editor B saves over the old text", "PUT", "/key", { workspace: id, path: "a.b", values: { fr: "Uno" }, expected: { fr: "Un" } });
      await ctx.verify("the second save is a conflict that names what is stored now", [
        ctx.status(first, 200),
        ctx.equal("second", [second.status, pick(second.body, "code"), pick(second.body, "current")], [409, "conflict", { fr: "Une" }]),
        ctx.equal("file", readLocaleFile(ctx, id, "fr"), { a: { b: "Une" } }),
      ]);
    },
  },
  {
    id: "rename-and-delete-a-key",
    title: "renaming moves every language's text, deleting removes the key everywhere, and the figures follow",
    entryPoint: "POST /api/lang/translations/key/rename, DELETE /key",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "shop");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "cart.title": { en: "Cart", fr: "Panier" }, "cart.empty": { en: "Empty" } } });
      const renamed = await lang(ctx, "rename the key", "POST", "/key/rename", { workspace: id, path: "cart.title", newPath: "basket.title" });
      await ctx.verify("both languages follow the key", [
        ctx.equal("row", pick(renamed.body, "row"), { key: "basket.title", values: { en: "Cart", fr: "Panier" } }),
        ctx.equal("English file", readLocaleFile(ctx, id, "en"), { cart: { empty: "Empty" }, basket: { title: "Cart" } }),
        ctx.equal("French file", readLocaleFile(ctx, id, "fr"), { basket: { title: "Panier" } }),
      ]);
      const onto = await lang(ctx, "rename onto a key", "POST", "/key/rename", { workspace: id, path: "basket.title", newPath: "cart.empty" });
      const same = await lang(ctx, "rename to itself", "POST", "/key/rename", { workspace: id, path: "basket.title", newPath: "basket.title" });
      const missing = await lang(ctx, "rename a key that does not exist", "POST", "/key/rename", { workspace: id, path: "no.key", newPath: "no.other" });
      await ctx.verify("a taken, identical or unknown path is refused", [
        ctx.equal("taken", [onto.status, pick(onto.body, "code")], [409, "key_exists"]),
        ctx.equal("same", [same.status, pick(same.body, "code")], [400, "invalid_key_path"]),
        ctx.equal("unknown", [missing.status, pick(missing.body, "code")], [404, "key_not_found"]),
      ]);
      const deleted = await lang(ctx, "delete the key", "DELETE", "/key", { workspace: id, path: "basket.title" });
      const again = await lang(ctx, "delete it again", "DELETE", "/key", { workspace: id, path: "basket.title" });
      await ctx.verify("the key is gone from every language", [
        ctx.status(deleted, 200),
        ctx.equal("counts", pick(deleted.body, "counts"), { localeProgress: { en: 100, fr: 0 }, localeMissing: { en: 0, fr: 1 }, totalKeys: 1, baseMissing: 0, incompleteKeys: 1 }),
        ctx.equal("English file", readLocaleFile(ctx, id, "en"), { cart: { empty: "Empty" } }),
        ctx.equal("French file", readLocaleFile(ctx, id, "fr"), {}),
        ctx.equal("deleting again", [again.status, pick(again.body, "code")], [404, "key_not_found"]),
      ]);
    },
  },
  {
    id: "mark-reviewed",
    title: "a translation written for an older base text is to review until the key is marked reviewed; an unknown key is 404 and the project files refuse",
    entryPoint: "POST /api/lang/translations/key/reviewed",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "review");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"], keys: { "a.b": { en: "Hi", fr: "Salut" } } });
      const fresh = await lang(ctx, "read the key", "GET", `/row?workspace=${id}&key=a.b`);
      await lang(ctx, "change the base text", "PUT", "/key", { workspace: id, path: "a.b", values: { en: "Hello" } });
      const changed = await lang(ctx, "read the key after the base changed", "GET", `/row?workspace=${id}&key=a.b`);
      await ctx.verify("the French text was written for the old base text", [
        ctx.equal("before", pick(fresh.body, "row", "outdated"), undefined),
        ctx.equal("after", pick(changed.body, "row", "outdated"), ["fr"]),
      ]);
      const reviewed = await lang(ctx, "mark reviewed", "POST", "/key/reviewed", { workspace: id, path: "a.b", locales: ["fr"] });
      const after = await lang(ctx, "read the key after the review", "GET", `/row?workspace=${id}&key=a.b`);
      await ctx.verify("marking it reviewed clears the review state", [ctx.equal("outdated", pick(after.body, "row", "outdated"), undefined)]);
      const unknown = await lang(ctx, "mark an unknown key", "POST", "/key/reviewed", { workspace: id, path: "no.such" });
      const project = await lang(ctx, "mark a project key", "POST", "/key/reviewed", { workspace: "default", path: "shop.title" });
      await ctx.verify("reviewing leaves the texts and refuses what it cannot apply", [
        ctx.equal("reviewed", [reviewed.status, pick(reviewed.body, "row", "values")], [200, { en: "Hello", fr: "Salut" }]),
        ctx.equal("unknown", [unknown.status, pick(unknown.body, "code")], [404, "key_not_found"]),
        ctx.equal("project files", [project.status, pick(project.body, "message")], [400, "$dms_lang.errors.review_added_only"]),
      ]);
    },
  },
  {
    id: "texts-with-edge-values",
    title: "texts with a plural, a quoted at sign, a placeholder at both ends and 1000 letters are stored as typed; a missing language is not an empty one",
    entryPoint: "PUT /api/lang/translations/key",
    async run(/** @type {Ctx} */ ctx) {
      const id = freshId(ctx, "edge");
      await seedWorkspace(ctx, id, { locales: ["en", "fr"] });
      const long = "é".repeat(1000);
      /** @type {[string, string][]} */
      const cases = [["plural", "no apples | one apple | {count} apples"], ["at", "jane{'@'}example.com"], ["ends", "{a} and {b}"], ["long", long]];
      for (const [name, text] of cases) {
        const answer = await lang(ctx, `store the ${name} text`, "POST", "/key", { workspace: id, path: `edge.${name}`, values: { en: text } });
        await ctx.verify(`the ${name} text is stored as typed`, [ctx.status(answer, 200), ctx.equal("value", pick(answer.body, "row", "values", "en"), text)]);
      }
      const flat = await lang(ctx, "read the figures", "GET", `/flat?workspace=${id}`);
      await ctx.verify("French has none of the four texts, which counts them as missing", [ctx.equal("missing", pick(flat.body, "localeMissing"), { en: 0, fr: 4 }), ctx.equal("file", readLocaleFile(ctx, id, "fr"), {})]);
    },
  },
]);
