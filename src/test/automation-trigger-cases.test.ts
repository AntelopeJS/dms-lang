import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AddFrontendModule } from "@antelopejs/interface-dms/page";
import { expect } from "chai";
import { addLanguageAction } from "../automation/actions/add-language";
import { createWorkspaceAction } from "../automation/actions/create-workspace";
import { importLanguageAction } from "../automation/actions/import-language";
import { setTranslationAction } from "../automation/actions/set-translation";
import { automationLoopGuard } from "../automation/loop-guard";
import { baseTextChangedTrigger } from "../automation/triggers/base-text-changed";
import { coverageBelowTrigger } from "../automation/triggers/coverage-below";
import { languageCompletedTrigger } from "../automation/triggers/language-completed";
import { moduleTextsChangedTrigger } from "../automation/triggers/module-texts-changed";
import { translationsChangedTrigger } from "../automation/triggers/translations-changed";
import { countsBeforeWrite } from "../services/writer";
import { lang } from "./helpers/api";
import { seed, useWorkspaceStorage } from "./helpers/api-suite";
import { capture, failureOf, step, withEditable } from "./helpers/automation";
import { useProjectFiles } from "./helpers/project";

const TIMEOUT_MS = 30_000;

describe("[integration] trigger cases: the circuit breaker and lang.base-text-changed", function () {
  this.timeout(TIMEOUT_MS);
  useWorkspaceStorage(true);
  beforeEach(() => automationLoopGuard.reset());

  it("breaker-per-write: two procedures listening each receive the first five procedure writes of one key, whatever their order", async () => {
    await seed("pair", { locales: ["en", "fr"], keys: { k: { en: "K" } } });
    const first = await capture(translationsChangedTrigger, {
      includeAutomationWrites: true,
    });
    const second = await capture(translationsChangedTrigger, {
      includeAutomationWrites: true,
    });
    try {
      for (let index = 0; index < 6; index += 1)
        await step(setTranslationAction, {
          workspace: "pair",
          key: "k",
          locale: "fr",
          text: `K${index}`,
        });
      expect([first.received.length, second.received.length]).to.deep.equal([
        5, 5,
      ]);
      expect(first.received.map((event) => event.deliveryId)).to.deep.equal(
        second.received.map((event) => event.deliveryId),
      );
    } finally {
      await first.stop();
      await second.stop();
    }
  });

  it("base-text: clearing the base gives removed; creation, rename, deletion, base switch and imports fire nothing; procedure writes only when asked; refused writes nothing", async () => {
    await seed("bt", {
      locales: ["en", "fr"],
      keys: { t: { en: "Title", fr: "Titre" } },
    });
    const users = await capture(baseTextChangedTrigger, { workspace: "bt" });
    const all = await capture(baseTextChangedTrigger, {
      workspace: "bt",
      includeAutomationWrites: true,
    });
    try {
      await lang("PUT", "/key", {
        workspace: "bt",
        path: "t",
        values: { en: null },
      });
      expect(
        users.received.map((event) => [event.text, event.removed]),
      ).to.deep.equal([["", true]]);
      await lang("POST", "/key", {
        workspace: "bt",
        path: "u",
        values: { en: "U" },
      });
      await lang("POST", "/key/rename", {
        workspace: "bt",
        path: "u",
        newPath: "v",
      });
      await lang("DELETE", "/key", { workspace: "bt", path: "v" });
      await step(importLanguageAction, {
        workspace: "bt",
        locale: "en",
        messages: { t: "Imported" },
      });
      await lang("POST", "/languages/bt/fr/base");
      expect(users.received).to.have.length(1);
      await step(setTranslationAction, {
        workspace: "bt",
        key: "t",
        locale: "fr",
        text: "Titre 2",
      });
      expect(users.received).to.have.length(1);
      expect(all.received.at(-1)).to.deep.include({
        origin: "automation",
        previousText: "Titre",
        text: "Titre 2",
      });
      await withEditable(false, async () => {
        expect(
          await failureOf(
            step(setTranslationAction, {
              workspace: "bt",
              key: "t",
              locale: "fr",
              text: "X",
            }),
          ),
        ).to.match(/\(read_only\)$/);
      });
      expect(all.received).to.have.length(2);
    } finally {
      await users.stop();
      await all.stop();
    }
  });
});

describe("[integration] trigger cases: lang.language-completed", function () {
  this.timeout(TIMEOUT_MS);
  useWorkspaceStorage(true);
  const project = useProjectFiles();

  it("empty-and-module: a language added to an empty workspace does not fire; on the project files a module text counts as present", async () => {
    const watch = await capture(languageCompletedTrigger, {});
    try {
      await step(createWorkspaceAction, { id: "empty", baseLocale: "en" });
      await step(addLanguageAction, { workspace: "empty", code: "fr" });
      expect(watch.received).to.deep.equal([]);
      project.reset();
      project.put("app-en-GB.json", {
        shop: { title: "Shop", pay: "Pay" },
        dms_lang: { title: "Ours" },
      });
      project.put("app-fr-FR.json", { shop: { title: "Boutique" } });
      await step(setTranslationAction, {
        workspace: "default",
        key: "shop.pay",
        locale: "fr",
        text: "Payer",
      });
      expect(
        watch.received.map((event) => [event.workspace, event.locale]),
      ).to.deep.equal([["default", "fr"]]);
    } finally {
      await watch.stop();
    }
  });

  it("before-counts: figures are read before a write only while a language-completed trigger listens", async () => {
    await seed("counts", { locales: ["en", "fr"] });
    expect(countsBeforeWrite("counts", {})).to.equal(undefined);
    const watch = await capture(languageCompletedTrigger, {});
    try {
      expect(countsBeforeWrite("counts", {})).to.not.equal(undefined);
      expect(countsBeforeWrite("counts", { dryRun: true })).to.equal(undefined);
    } finally {
      await watch.stop();
    }
    expect(countsBeforeWrite("counts", {})).to.equal(undefined);
  });
});

describe("[integration] trigger cases: pollers", function () {
  this.timeout(TIMEOUT_MS);
  useWorkspaceStorage(true);
  const project = useProjectFiles();
  let directory = "";
  before(() => {
    directory = mkdtempSync(join(tmpdir(), "dms-lang-module-cases-"));
  });
  after(() => rmSync(directory, { recursive: true, force: true }));

  it("coverage-forgets-deleted: a watched workspace deleted then created again starts a new baseline", async () => {
    await seed("gone", {
      locales: ["en", "fr"],
      keys: { a: { en: "A", fr: "Ah" } },
    });
    const watch = await capture(coverageBelowTrigger, { workspace: "gone" });
    try {
      await lang("DELETE", "/workspace", { id: "gone" });
      watch.handle.poll();
      await seed("gone", { locales: ["en", "fr"], keys: { a: { en: "A" } } });
      watch.handle.poll();
      expect(watch.received).to.deep.equal([]);
      await lang("PUT", "/key", {
        workspace: "gone",
        path: "a",
        values: { fr: "Ah" },
      });
      watch.handle.poll();
      await lang("POST", "/key", {
        workspace: "gone",
        path: "b",
        values: { en: "B" },
      });
      watch.handle.poll();
      expect(
        watch.received.map((event) => [event.previousCoverage, event.coverage]),
      ).to.deep.equal([[100, 50]]);
    } finally {
      await watch.stop();
    }
  });

  it("module-filters: keyPrefix keeps only matching keys; a changed module text the project overrides is in overriddenChanged", async () => {
    project.reset();
    const locales = join(directory, "i18n", "locales");
    mkdirSync(locales, { recursive: true });
    const file = join(locales, "cases-en-GB.json");
    writeFileSync(
      file,
      JSON.stringify({ cases: { a: "A", b: "B" }, other: { c: "C" } }),
    );
    await AddFrontendModule({
      name: "dms-lang-test-cases",
      sourcePath: directory,
      renderer: { name: "vue", version: "3" },
      priority: 10,
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    project.put("app-en-GB.json", { cases: { a: "Ours" } });
    const prefixed = await capture(moduleTextsChangedTrigger, {
      intervalSeconds: 0,
      keyPrefix: "cases",
    });
    try {
      prefixed.handle.settle();
      writeFileSync(
        file,
        JSON.stringify({ cases: { a: "A", b: "B" }, other: { c: "C2" } }),
      );
      prefixed.handle.settle();
      expect(prefixed.received).to.deep.equal([]);
      writeFileSync(
        file,
        JSON.stringify({ cases: { a: "A2", b: "B2" }, other: { c: "C2" } }),
      );
      prefixed.handle.settle();
      expect(prefixed.received).to.have.length(1);
      expect(prefixed.received[0]).to.deep.include({
        keysChanged: ["cases.a", "cases.b"],
        overriddenChanged: ["cases.a"],
        keyCount: 2,
      });
    } finally {
      await prefixed.stop();
    }
  });
});
