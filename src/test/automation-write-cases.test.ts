import { expect } from "chai";
import { createKeyAction } from "../automation/actions/create-key";
import { deleteKeyAction } from "../automation/actions/delete-key";
import { deleteWorkspaceAction } from "../automation/actions/delete-workspace";
import { importLanguageAction } from "../automation/actions/import-language";
import { importWorkspaceAction } from "../automation/actions/import-workspace";
import { removeLanguageAction } from "../automation/actions/remove-language";
import { removeOverrideAction } from "../automation/actions/remove-override";
import { renameKeyAction } from "../automation/actions/rename-key";
import { renameWorkspaceAction } from "../automation/actions/rename-workspace";
import { setBaseLanguageAction } from "../automation/actions/set-base-language";
import { updateWorkspaceAction } from "../automation/actions/update-workspace";
import { translationsChangedTrigger } from "../automation/triggers/translations-changed";
import { useWorkspaceStorage } from "./helpers/api-suite";
import { capture, failureOf, step, withEditable } from "./helpers/automation";
import { folderContents } from "./helpers/files";
import { seedWorkspace } from "./helpers/lang-seed";
import { useProjectFiles } from "./helpers/project";

const TIMEOUT_MS = 20_000;

describe("[integration] Lang write actions: dry runs write nothing and answer the real run", function () {
  this.timeout(TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);
  const contents = (id: string) => folderContents(storage.folder(id));

  it("dry-runs: rename-key, delete-key, remove-language, set-base-language, update-workspace and rename-workspace leave every file as it was", async () => {
    await seedWorkspace("dry", ["en", "fr", "de"], {
      a: { en: "A", fr: "Ah" },
      b: { en: "B" },
    });
    const cases = [
      [renameKeyAction, { workspace: "dry", key: "a", newKey: "c" }],
      [deleteKeyAction, { workspace: "dry", key: "b" }],
      [removeLanguageAction, { workspace: "dry", code: "de" }],
      [setBaseLanguageAction, { workspace: "dry", code: "fr" }],
      [updateWorkspaceAction, { workspace: "dry", description: "Shop" }],
    ] as const;
    for (const [action, input] of cases) {
      const before = contents("dry");
      const simulated = await step(action, input, true);
      expect(contents("dry"), action.id).to.deep.equal(before);
      expect(await step(action, input), action.id).to.deep.equal(simulated);
    }
    const before = contents("dry");
    const renamed = await step(
      renameWorkspaceAction,
      { workspace: "dry", newId: "wet" },
      true,
    );
    expect(contents("dry")).to.deep.equal(before);
    expect(contents("wet")).to.deep.equal({});
    expect(
      await step(renameWorkspaceAction, { workspace: "dry", newId: "wet" }),
    ).to.deep.equal(renamed);
  });
});

describe("[integration] Lang write actions: refusals and outputs", function () {
  this.timeout(TIMEOUT_MS);
  useWorkspaceStorage(true);

  it("keys: rename onto an existing key, delete a namespace, create on a key's child path, editing off", async () => {
    await seedWorkspace("keys", ["en"], {
      "a.b": { en: "AB" },
      c: { en: "C" },
    });
    expect(
      await failureOf(
        step(renameKeyAction, { workspace: "keys", key: "c", newKey: "a.b" }),
      ),
    ).to.match(/\(key_exists\)$/);
    expect(
      await failureOf(step(deleteKeyAction, { workspace: "keys", key: "a" })),
    ).to.match(/\(not_a_key\)$/);
    expect(
      await failureOf(
        step(createKeyAction, {
          workspace: "keys",
          key: "a.b.c",
          baseText: "X",
        }),
      ),
    ).to.match(/clashes with "a\.b" \(key_conflict\)$/);
    await withEditable(false, async () => {
      expect(
        await failureOf(
          step(createKeyAction, { workspace: "keys", key: "d", baseText: "D" }),
        ),
      ).to.match(/\(read_only\)$/);
    });
  });

  it("languages and workspaces: unknown language, same base, unknown workspace, an id taken, a newer backup", async () => {
    await seedWorkspace("langs", ["en", "fr"]);
    await seedWorkspace("taken", ["en"]);
    expect(
      await failureOf(
        step(removeLanguageAction, { workspace: "langs", code: "it" }),
      ),
    ).to.match(/\(unknown_locale\)$/);
    expect(
      await step(setBaseLanguageAction, { workspace: "langs", code: "en" }),
    ).to.deep.include({ changed: false, reviewTrackingCleared: false });
    expect(
      await failureOf(step(updateWorkspaceAction, { workspace: "nowhere" })),
    ).to.match(/\(unknown_workspace\)$/);
    expect(
      await failureOf(
        step(deleteWorkspaceAction, {
          workspace: "nowhere",
          confirm: "nowhere",
        }),
      ),
    ).to.match(/\(unknown_workspace\)$/);
    expect(
      await failureOf(
        step(renameWorkspaceAction, { workspace: "langs", newId: "taken" }),
      ),
    ).to.match(/\(workspace_exists\)$/);
    expect(
      await failureOf(
        step(importWorkspaceAction, {
          backup: { id: "newer", version: 2, messages: { en: {} } },
        }),
      ),
    ).to.match(/newer version of Lang \(invalid_body\)$/);
  });

  it("update-workspace: keeps an absent field, clears an empty one, and reports workspace-updated", async () => {
    await seedWorkspace("details", ["en"]);
    await step(updateWorkspaceAction, {
      workspace: "details",
      description: "Site",
      type: "website",
    });
    const watch = await capture(translationsChangedTrigger, {
      operations: ["workspace-updated"],
      includeAutomationWrites: true,
    });
    try {
      expect(
        await step(updateWorkspaceAction, { workspace: "details" }),
      ).to.deep.equal({
        workspace: "details",
        description: "Site",
        type: "website",
      });
      expect(
        await step(updateWorkspaceAction, { workspace: "details", type: "" }),
      ).to.deep.equal({ workspace: "details", description: "Site", type: "" });
      expect(watch.received.map((event) => event.workspace)).to.deep.equal([
        "details",
        "details",
      ]);
    } finally {
      await watch.stop();
    }
  });

  it("import-language: more than 5000 texts are refused before anything is written", async () => {
    await seedWorkspace("big", ["en"]);
    const messages = Object.fromEntries(
      Array.from({ length: 5001 }, (_, index) => [`k${index}`, "T"]),
    );
    expect(
      await failureOf(
        step(importLanguageAction, {
          workspace: "big",
          locale: "en",
          messages,
          createKeys: true,
        }),
      ),
    ).to.equal("lang.import-language: at most 5000 texts per step");
  });
});

describe("[integration] Lang write actions on the project files: cases", function () {
  this.timeout(TIMEOUT_MS);
  useWorkspaceStorage(true);
  const project = useProjectFiles();

  it("module keys: create refused, rename refused, delete of an override still shows the module text, dry run included", async () => {
    project.reset();
    expect(
      await failureOf(
        step(createKeyAction, {
          workspace: "default",
          key: "dms_lang.title",
          baseText: "X",
        }),
      ),
    ).to.match(/\(module_key\)$/);
    expect(
      await failureOf(
        step(renameKeyAction, {
          workspace: "default",
          key: "dms_lang.title",
          newKey: "mine.title",
        }),
      ),
    ).to.match(
      /comes from a module and cannot be renamed or deleted here \(key_not_found\)$/,
    );
    project.put("app-en-GB.json", { dms_lang: { title: "Ours" } });
    const input = { workspace: "default", key: "dms_lang.title" };
    const simulated = await step(deleteKeyAction, input, true);
    expect(simulated).to.deep.include({ stillVisible: true });
    expect(project.read("app-en-GB.json", "dms_lang", "title")).to.equal(
      "Ours",
    );
    expect(await step(deleteKeyAction, input)).to.deep.equal(simulated);
  });

  it("import-language and remove-override on the project files: writes the project's files, removes only the languages asked, a dry run removes nothing", async () => {
    project.reset();
    await step(importLanguageAction, {
      workspace: "default",
      locale: "fr",
      messages: { shop: { cancel: "Annuler" } },
    });
    expect(project.read("app-fr-FR.json", "shop", "cancel")).to.equal(
      "Annuler",
    );
    project.put("app-en-GB.json", { dms_lang: { title: "Ours" } });
    project.put("app-fr-FR.json", { dms_lang: { title: "Les nôtres" } });
    const input = { key: "dms_lang.title", locales: ["fr"] };
    const simulated = await step(removeOverrideAction, input, true);
    expect(project.read("app-fr-FR.json", "dms_lang", "title")).to.equal(
      "Les nôtres",
    );
    const removed = await step(removeOverrideAction, input);
    expect(removed).to.deep.equal(simulated);
    expect(removed).to.deep.equal({
      key: "dms_lang.title",
      removedLocales: ["fr"],
      moduleTexts: { fr: "Traductions" },
    });
    expect(project.read("app-en-GB.json", "dms_lang", "title")).to.equal(
      "Ours",
    );
    expect(project.read("app-fr-FR.json", "dms_lang", "title")).to.equal(
      undefined,
    );
  });
});
