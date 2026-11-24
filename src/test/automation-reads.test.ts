import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "chai";
import { exportWorkspaceAction } from "../automation/actions/export-workspace";
import { getKeyAction } from "../automation/actions/get-key";
import { keysToReviewAction } from "../automation/actions/keys-to-review";
import { languageCoverageAction } from "../automation/actions/language-coverage";
import { listWorkspacesAction } from "../automation/actions/list-workspaces";
import { missingKeysAction } from "../automation/actions/missing-keys";
import { namespaceCoverageAction } from "../automation/actions/namespace-coverage";
import { publicUrlAction } from "../automation/actions/public-url";
import { translateAction } from "../automation/actions/translate";
import { workspaceSummaryAction } from "../automation/actions/workspace-summary";
import { field, lang, objects } from "./helpers/api";
import { seed, useWorkspaceStorage } from "./helpers/api-suite";
import {
  failureOf,
  objectsField,
  step,
  textField,
  withEditable,
} from "./helpers/automation";
import { readText } from "./helpers/files";
import { useProjectFiles } from "./helpers/project";

const TIMEOUT_MS = 20_000;

/** An added workspace with four languages, plurals, placeholders and linked messages. */
async function seedStore(): Promise<void> {
  await seed("store", {
    locales: ["en", "fr", "fr-BE", "de"],
    keys: {
      "cart.title": { en: "Cart", fr: "Panier" },
      "cart.count": {
        en: "No item | One item | {count} items",
        fr: "Aucun | Un | {count} articles",
      },
      "cart.pay": { en: "Pay {price}", fr: "Payer {prix}" },
      "mail.hello": { en: "Hello {name}, @:cart.title" },
      "mail.loop": { en: "@:mail.loop2" },
      "mail.loop2": { en: "@:mail.loop" },
    },
  });
}

describe("[integration] Lang read actions: translate", function () {
  this.timeout(TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);
  const project = useProjectFiles();

  before(seedStore);

  it("translate: exact hit, regional fallback, fallback language then base, fallback off, linked messages, plurals and the onMissing modes", async () => {
    const ask = (
      input: Record<string, string | boolean | Record<string, number | string>>,
    ) => step(translateAction, { workspace: "store", ...input });
    expect(await ask({ key: "cart.title", locale: "fr" })).to.deep.equal({
      text: "Panier",
      template: "Panier",
      found: true,
      locale: "fr",
      usedFallback: false,
      missingParams: [],
    });
    expect(await ask({ key: "cart.title", locale: "fr-CA" })).to.deep.include({
      locale: "fr",
      usedFallback: false,
    });
    expect(
      await ask({ key: "cart.title", locale: "de", fallbackLocale: "fr" }),
    ).to.deep.include({
      text: "Panier",
      usedFallback: true,
    });
    expect(await ask({ key: "cart.title", locale: "de" })).to.deep.include({
      text: "Cart",
      locale: "en",
    });
    expect(
      await failureOf(
        ask({ key: "cart.title", locale: "de", fallback: false }),
      ),
    ).to.match(/\(missing_text\)$/);
    expect(
      await ask({
        key: "cart.title",
        locale: "de",
        fallback: false,
        onMissing: "key",
      }),
    ).to.deep.include({
      text: "cart.title",
      found: false,
    });
    expect(
      await ask({ key: "cart.count", locale: "en", params: { count: 3 } }),
    ).to.deep.include({ text: "3 items" });
    expect(
      await ask({ key: "cart.count", locale: "fr", params: { count: 1 } }),
    ).to.deep.include({ text: "Un" });
    expect(
      await ask({ key: "mail.hello", locale: "fr", params: {} }),
    ).to.deep.include({
      text: "Hello , Panier",
      missingParams: ["name"],
      usedFallback: true,
    });
    expect(await failureOf(ask({ key: "mail.loop", locale: "en" }))).to.match(
      /\(linked_cycle\)$/,
    );
    expect(await failureOf(ask({ key: "cart", locale: "en" }))).to.match(
      /\(not_a_key\)$/,
    );
    expect(
      await failureOf(
        step(translateAction, { workspace: "nowhere", key: "a", locale: "en" }),
      ),
    ).to.match(/\(unknown_workspace\)$/);
  });

  it("translate-files: reads the project text over the module text, reads the modules, and sees a hand-edited file on the next call, with editing off", async () => {
    project.reset();
    project.put("app-en-GB.json", { dms_lang: { title: "Our texts" } });
    await withEditable(false, async () => {
      expect(
        await step(translateAction, { key: "dms_lang.title", locale: "en" }),
      ).to.deep.include({ text: "Our texts" });
      expect(
        await step(translateAction, {
          workspace: "modules",
          key: "dms_lang.title",
          locale: "en",
        }),
      ).to.deep.include({
        text: "Translations",
      });
      const file = join(storage.folder("store"), "fr.json");
      const original = readText(file);
      writeFileSync(file, original.replace('"Panier"', '"Chariot"'));
      try {
        expect(
          await step(translateAction, {
            workspace: "store",
            key: "cart.title",
            locale: "fr",
          }),
        ).to.deep.include({
          text: "Chariot",
        });
      } finally {
        writeFileSync(file, original);
      }
    });
  });
});

describe("[integration] Lang read actions: keys and lists", function () {
  this.timeout(TIMEOUT_MS);
  useWorkspaceStorage(true);
  const project = useProjectFiles();
  before(seedStore);

  it("get-key: every language with outdated, issues and module texts; unknown and namespace paths answer exists false", async () => {
    const row = await step(getKeyAction, {
      workspace: "store",
      key: "cart.pay",
    });
    expect(row).to.deep.include({
      exists: true,
      isNamespace: false,
      baseLocale: "en",
      baseText: "Pay {price}",
      values: { en: "Pay {price}", fr: "Payer {prix}" },
      missingLocales: ["de", "fr-BE"],
      issues: ["fr"],
    });
    expect(
      await step(getKeyAction, { workspace: "store", key: "cart" }),
    ).to.deep.include({ exists: false, isNamespace: true });
    expect(
      await step(getKeyAction, { workspace: "store", key: "nope" }),
    ).to.deep.include({ exists: false, isNamespace: false });
    project.reset();
    project.put("app-en-GB.json", { dms_lang: { title: "Ours" } });
    expect(await step(getKeyAction, { key: "dms_lang.title" })).to.deep.include(
      {
        values: { en: "Ours" },
        inherited: { en: "Translations", fr: "Traductions" },
      },
    );
  });

  it("lists: missing keys in file order with paging and prefix; keys to review by reason; an unknown language fails", async () => {
    const missing = await step(missingKeysAction, {
      workspace: "store",
      locale: "de",
      limit: 2,
    });
    expect(missing).to.deep.include({
      keys: ["cart.title", "cart.count"],
      total: 6,
      hasMore: true,
    });
    const prefixed = await step(missingKeysAction, {
      workspace: "store",
      locale: "de",
      keyPrefix: "mail",
      offset: 2,
    });
    expect(prefixed).to.deep.include({
      keys: ["mail.loop2"],
      total: 3,
      hasMore: false,
    });
    const review = await step(keysToReviewAction, {
      workspace: "store",
      locale: "fr",
      reason: "issue",
    });
    expect(review.keys).to.deep.equal(["cart.pay"]);
    const page = await lang("GET", "/locale-stats?workspace=store&locale=fr");
    const issues = objects(page.body, "items").find(
      (item) => item.id === "issues",
    );
    expect(review.total).to.equal(field(issues, "value"));
    expect(
      await failureOf(
        step(missingKeysAction, { workspace: "store", locale: "it" }),
      ),
    ).to.match(/\(unknown_locale\)$/);
  });
});

describe("[integration] Lang read actions: figures, export and URLs", function () {
  this.timeout(TIMEOUT_MS);
  useWorkspaceStorage(true);
  before(seedStore);

  it("figures: language and namespace coverage, the workspace summary as /summary lists it, and the list of workspaces", async () => {
    expect(
      await step(languageCoverageAction, {
        workspace: "store",
        locale: "fr-FR",
      }),
    ).to.deep.include({
      locale: "fr",
      name: "Français",
      isBase: false,
      totalKeys: 6,
      missing: 3,
      coverage: 50,
      complete: false,
    });
    const heatmap = await step(namespaceCoverageAction, {
      workspace: "store",
      locale: "fr",
    });
    expect(heatmap).to.deep.include({
      locales: ["fr"],
      total: 2,
      truncated: false,
    });
    const summary = await step(workspaceSummaryAction, { workspace: "store" });
    const listed = objects(
      (await lang("GET", "/summary")).body,
      "workspaces",
    ).find((entry) => entry.id === "store");
    expect([
      summary.totalKeys,
      summary.coverage,
      summary.missing,
      summary.publicUrl,
    ]).to.deep.equal([
      listed?.totalKeys,
      listed?.coverage,
      listed?.missing,
      listed?.publicUrl,
    ]);
    expect(summary.editable).to.equal(true);
    const all = await step(listWorkspacesAction, { includeStats: true });
    const kinds = objectsField(all, "workspaces").map((entry) => entry.kind);
    expect(kinds[0]).to.equal("default");
    expect(kinds.at(-1)).to.equal("modules");
    const modulesOnly = await step(listWorkspacesAction, {
      kinds: ["modules"],
    });
    expect(modulesOnly.total).to.equal(1);
  });

  it("export-and-url: exports texts, one language, a backup, refuses an export above maxBytes; public URL of an added workspace only", async () => {
    const french = await step(exportWorkspaceAction, {
      workspace: "store",
      locale: "fr",
    });
    expect(french).to.deep.include({
      format: "messages",
      locales: ["fr"],
      keyCount: 3,
    });
    expect(
      await failureOf(
        step(exportWorkspaceAction, { workspace: "modules", maxBytes: 1000 }),
      ),
    ).to.match(/\(export_too_large\)$/);
    const backup = await step(exportWorkspaceAction, {
      workspace: "store",
      format: "backup",
    });
    expect(backup.data).to.deep.include({
      format: "dms-lang.workspace",
      id: "store",
      defaultLocale: "en",
    });
    const url = await step(publicUrlAction, {
      workspace: "store",
      locale: "fr-CA",
    });
    expect(url).to.deep.include({ served: true, servedLocale: "fr" });
    expect(textField(url, "url")).to.match(/\/store\/fr-CA\.json$/);
    expect(await step(publicUrlAction, { workspace: "default" })).to.deep.equal(
      {
        served: false,
        url: "",
        template: "",
        servedLocale: "",
      },
    );
  });
});
