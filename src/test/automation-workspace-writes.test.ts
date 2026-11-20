import { expect } from "chai";
import { createWorkspaceAction } from "../automation/actions/create-workspace";
import { deleteKeyAction } from "../automation/actions/delete-key";
import { deleteWorkspaceAction } from "../automation/actions/delete-workspace";
import { exportWorkspaceAction } from "../automation/actions/export-workspace";
import { importLanguageAction } from "../automation/actions/import-language";
import { importWorkspaceAction } from "../automation/actions/import-workspace";
import { removeLanguageAction } from "../automation/actions/remove-language";
import { removeOverrideAction } from "../automation/actions/remove-override";
import { renameKeyAction } from "../automation/actions/rename-key";
import { renameWorkspaceAction } from "../automation/actions/rename-workspace";
import { setBaseLanguageAction } from "../automation/actions/set-base-language";
import { setTranslationAction } from "../automation/actions/set-translation";
import { updateWorkspaceAction } from "../automation/actions/update-workspace";
import { resolveRow } from "../utils/resolve";
import { useWorkspaceStorage } from "./helpers/api-suite";
import { failureOf, objectField, step, textField } from "./helpers/automation";
import { folderContents } from "./helpers/files";
import { seedWorkspace } from "./helpers/lang-seed";
import { useProjectFiles } from "./helpers/project";

const TIMEOUT_MS = 20_000;

describe("[integration] Lang write actions: language imports", function () {
  this.timeout(TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);
  const contents = (id: string) => folderContents(storage.folder(id));

  it("import-language: merges, fills missing, replaces, reads flat and nested alike, and skips or creates unknown keys", async () => {
    await seedWorkspace("bulk", ["en", "fr"], {
      "a.one": { en: "One", fr: "Un" },
      "a.two": { en: "Two" },
      "b.three": { en: "Three", fr: "Trois" },
    });
    const filled = await step(importLanguageAction, {
      workspace: "bulk",
      locale: "fr",
      messages: { a: { one: "UN", two: "Deux" }, "c.new": "Nouveau" },
      mode: "fillMissing",
    });
    expect(filled).to.deep.equal({
      workspace: "bulk",
      locale: "fr",
      written: 1,
      unchanged: 1,
      cleared: 0,
      created: [],
      skipped: ["c.new"],
      coverage: 100,
      missing: 0,
    });
    expect(resolveRow("bulk", "a.one")?.values.fr).to.equal("Un");
    const replaced = await step(importLanguageAction, {
      workspace: "bulk",
      locale: "fr",
      messages: { "a.one": "Un", "a.two": "Deux", "c.new": "Nouveau" },
      mode: "replace",
      createKeys: true,
    });
    expect([
      replaced.written,
      replaced.unchanged,
      replaced.cleared,
      replaced.created,
    ]).to.deep.equal([1, 2, 1, ["c.new"]]);
    expect(resolveRow("bulk", "b.three")?.values.fr).to.equal(undefined);
    expect(
      await failureOf(
        step(importLanguageAction, {
          workspace: "bulk",
          locale: "en",
          messages: { a: { one: "1" } },
          mode: "replace",
        }),
      ),
    ).to.match(/\(replace_base\)$/);
  });

  it("import-language atomic: one text that does not compile fails the whole import and names it, nothing written; a dry run answers the real run", async () => {
    await seedWorkspace("atomic", ["en", "fr"], {
      x: { en: "X" },
      y: { en: "Y" },
    });
    const before = contents("atomic");
    const broken = await failureOf(
      step(importLanguageAction, {
        workspace: "atomic",
        locale: "fr",
        messages: { x: "Ok", y: "Hello {name" },
      }),
    );
    expect(broken).to.equal(
      'Lang: these texts in "fr" are not valid messages: "y" (invalid_message)',
    );
    expect(contents("atomic")).to.deep.equal(before);
    const input = {
      workspace: "atomic",
      locale: "fr",
      messages: { x: "Iks", y: "Igrec" },
    };
    const simulated = await step(importLanguageAction, input, true);
    expect(contents("atomic")).to.deep.equal(before);
    expect(await step(importLanguageAction, input)).to.deep.equal(simulated);
    expect(resolveRow("atomic", "x")?.outdated).to.equal(undefined);
    await step(setTranslationAction, {
      workspace: "atomic",
      key: "x",
      locale: "en",
      text: "Ex",
    });
    expect(
      resolveRow("atomic", "x")?.outdated,
      "the import recorded the base it translated",
    ).to.deep.equal(["fr"]);
  });
});

describe("[integration] Lang write actions: workspaces", function () {
  this.timeout(TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);

  it("create, edit, rename and delete a workspace: refusals, dry runs that write nothing, and confirm guarding the delete", async () => {
    expect(
      await step(createWorkspaceAction, {
        id: "Site",
        baseLocale: "en",
        description: "Site",
        type: "website",
      }),
    ).to.deep.include({ workspace: "site", baseLocale: "en" });
    expect(
      await failureOf(
        step(createWorkspaceAction, { id: "site", baseLocale: "en" }),
      ),
    ).to.match(/\(workspace_exists\)$/);
    expect(
      await failureOf(
        step(createWorkspaceAction, { id: "modules", baseLocale: "en" }),
      ),
    ).to.match(/\(reserved_workspace\)$/);
    await step(createWorkspaceAction, { id: "ghost", baseLocale: "en" }, true);
    expect(storage.files("ghost")).to.deep.equal([]);

    expect(
      await step(updateWorkspaceAction, { workspace: "site", type: "mobile" }),
    ).to.deep.equal({
      workspace: "site",
      description: "Site",
      type: "mobile",
    });
    expect(
      await step(updateWorkspaceAction, { workspace: "site", description: "" }),
    ).to.deep.equal({
      workspace: "site",
      description: "",
      type: "mobile",
    });

    const renamed = await step(renameWorkspaceAction, {
      workspace: "site",
      newId: "web",
    });
    expect([renamed.workspace, renamed.previousWorkspace]).to.deep.equal([
      "web",
      "site",
    ]);
    expect(textField(renamed, "publicUrl")).to.match(
      /\/web\/\{locale\}\.json$/,
    );
    expect(storage.files("site")).to.deep.equal([]);

    expect(
      await failureOf(
        step(deleteWorkspaceAction, { workspace: "web", confirm: "site" }),
      ),
    ).to.match(/\(confirm_mismatch\)$/);
    await step(
      deleteWorkspaceAction,
      { workspace: "web", confirm: "web" },
      true,
    );
    expect(storage.files("web")).to.not.deep.equal([]);
    expect(
      await step(deleteWorkspaceAction, { workspace: "web", confirm: "WEB" }),
    ).to.deep.equal({
      workspace: "web",
      locales: ["en"],
      totalKeys: 0,
    });
    expect(storage.files("web")).to.deep.equal([]);
  });

  it("import-workspace: restores an export in backup format under another id, refuses an existing id, and a dry run creates no folder", async () => {
    await seedWorkspace("origin", ["en", "fr"], { a: { en: "A", fr: "Ah" } });
    const exported = await step(exportWorkspaceAction, {
      workspace: "origin",
      format: "backup",
    });
    const backup = objectField(exported, "data");
    expect(await failureOf(step(importWorkspaceAction, { backup }))).to.match(
      /\(workspace_exists\)$/,
    );
    expect(
      await step(importWorkspaceAction, { backup, id: "copy" }, true),
    ).to.deep.equal({
      workspace: "copy",
      baseLocale: "en",
      locales: ["en", "fr"],
      totalKeys: 1,
    });
    expect(storage.files("copy")).to.deep.equal([]);
    await step(importWorkspaceAction, { backup, id: "copy" });
    expect(resolveRow("copy", "a")?.values).to.deep.equal({
      en: "A",
      fr: "Ah",
    });
  });
});

describe("[integration] Lang write actions: keys and languages", function () {
  this.timeout(TIMEOUT_MS);
  useWorkspaceStorage(true);

  it("keys and languages: renames and deletes a key, removes a language and switches the base", async () => {
    await seedWorkspace("misc", ["en", "fr", "de"], {
      old: { en: "Old", fr: "Vieux", de: "Alt" },
    });
    expect(
      await step(renameKeyAction, {
        workspace: "misc",
        key: "old",
        newKey: "fresh",
      }),
    ).to.deep.equal({
      workspace: "misc",
      key: "fresh",
      previousKey: "old",
    });
    expect(
      await step(removeLanguageAction, { workspace: "misc", code: "de" }),
    ).to.deep.equal({
      workspace: "misc",
      code: "de",
      textsRemoved: 1,
    });
    expect(
      await failureOf(
        step(removeLanguageAction, { workspace: "misc", code: "en" }),
      ),
    ).to.match(/\(base_locale\)$/);
    expect(
      await step(setBaseLanguageAction, { workspace: "misc", code: "fr" }),
    ).to.deep.equal({
      workspace: "misc",
      baseLocale: "fr",
      previousBaseLocale: "en",
      changed: true,
      reviewTrackingCleared: true,
    });
    expect(
      await step(deleteKeyAction, { workspace: "misc", key: "fresh" }),
    ).to.deep.equal({
      workspace: "misc",
      key: "fresh",
      locales: ["en", "fr"],
      stillVisible: false,
      totalKeys: 0,
    });
  });
});

describe("[integration] Lang write actions on the project files", function () {
  this.timeout(TIMEOUT_MS);
  useWorkspaceStorage(true);
  const project = useProjectFiles();

  it("default-writes: a procedure writes the project's files where editing is on", async () => {
    project.reset();
    await step(setTranslationAction, {
      workspace: "default",
      key: "shop.cancel",
      locale: "fr",
      text: "Annuler",
    });
    expect(project.read("app-fr-FR.json", "shop", "cancel")).to.equal(
      "Annuler",
    );
  });

  it("remove-override: restores the module text of an overridden key, refuses a key no module has", async () => {
    project.reset();
    project.put("app-en-GB.json", { dms_lang: { title: "Our translations" } });
    const removed = await step(removeOverrideAction, { key: "dms_lang.title" });
    expect(removed.removedLocales).to.deep.equal(["en"]);
    expect(removed.moduleTexts).to.deep.equal({ en: "Translations" });
    expect(
      await failureOf(step(removeOverrideAction, { key: "shop.title" })),
    ).to.match(/\(not_an_override\)$/);
  });
});
