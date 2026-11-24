import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AddFrontendModule } from "@antelopejs/interface-dms/page";
import { expect } from "chai";
import { createKeyAction } from "../automation/actions/create-key";
import { importLanguageAction } from "../automation/actions/import-language";
import { setTranslationAction } from "../automation/actions/set-translation";
import { changeChannel } from "../automation/events";
import { automationLoopGuard } from "../automation/loop-guard";
import { baseTextChangedTrigger } from "../automation/triggers/base-text-changed";
import { coverageBelowTrigger } from "../automation/triggers/coverage-below";
import { languageCompletedTrigger } from "../automation/triggers/language-completed";
import { moduleTextsChangedTrigger } from "../automation/triggers/module-texts-changed";
import { translationsChangedTrigger } from "../automation/triggers/translations-changed";
import { lang } from "./helpers/api";
import { seed, useWorkspaceStorage } from "./helpers/api-suite";
import { capture, PROCEDURE_ID, step } from "./helpers/automation";
import { useProjectFiles } from "./helpers/project";

const TIMEOUT_MS = 30_000;

describe("[integration] lang.translations-changed", function () {
  this.timeout(TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);
  beforeEach(() => automationLoopGuard.reset());

  it("every-route-write: each write through the API fires once, in order, with its operation, keys and the user who wrote", async () => {
    const watch = await capture(translationsChangedTrigger, {});
    try {
      await seed("ops", { locales: ["en", "fr"] });
      await lang("POST", "/key", {
        workspace: "ops",
        path: "a.b",
        values: { en: "B" },
      });
      await lang("PUT", "/key", {
        workspace: "ops",
        path: "a.b",
        values: { fr: "Bé" },
      });
      await lang("POST", "/key/rename", {
        workspace: "ops",
        path: "a.b",
        newPath: "a.c",
      });
      await lang("POST", "/key/reviewed", { workspace: "ops", path: "a.c" });
      await lang("DELETE", "/key", { workspace: "ops", path: "a.c" });
      await lang("POST", "/locale", { workspace: "ops", code: "de" });
      await lang("POST", "/languages/ops/fr/base");
      await lang("DELETE", "/languages/ops/de");
      await lang("PATCH", "/workspace", { id: "ops", description: "Ops" });
      await lang("POST", "/workspace/rename", { id: "ops", newId: "ops2" });
      await lang("POST", "/import", {
        id: "ops3",
        messages: { en: { x: "X" } },
      });
      await lang("DELETE", "/workspace", { id: "ops2" });
      expect(watch.received.map((event) => event.operation)).to.deep.equal([
        "workspace-created",
        "language-added",
        "key-created",
        "key-updated",
        "key-renamed",
        "reviewed",
        "key-deleted",
        "language-added",
        "base-language-changed",
        "language-removed",
        "workspace-updated",
        "workspace-renamed",
        "workspace-imported",
        "workspace-deleted",
      ]);
      const renamed = watch.received.find(
        (event) => event.operation === "key-renamed",
      );
      expect(renamed).to.deep.include({
        workspace: "ops",
        workspaceKind: "added",
        keys: ["a.c"],
        previousKey: "a.b",
        origin: "user",
        keyCount: 1,
        keysTruncated: false,
      });
      expect(renamed?.actorId).to.be.a("string");
      expect(
        watch.received.find((event) => event.operation === "workspace-renamed"),
      ).to.deep.include({
        workspace: "ops2",
        previousWorkspace: "ops",
      });
      expect(
        new Set(watch.received.map((event) => event.deliveryId)).size,
      ).to.equal(14);
    } finally {
      await watch.stop();
    }
    expect(storage.files("ops3")).to.include("en.json");
  });

  it("procedure-writes: ignored by default, delivered with includeAutomationWrites and the procedure that wrote; refused writes and dry runs fire nothing", async () => {
    await seed("auto", { locales: ["en", "fr"], keys: { k: { en: "K" } } });
    const users = await capture(translationsChangedTrigger, {
      workspace: "auto",
    });
    const all = await capture(translationsChangedTrigger, {
      workspace: "AUTO",
      includeAutomationWrites: true,
    });
    try {
      await step(setTranslationAction, {
        workspace: "auto",
        key: "k",
        locale: "fr",
        text: "Ka",
      });
      await step(
        setTranslationAction,
        { workspace: "auto", key: "k", locale: "fr", text: "Kb" },
        true,
      );
      await step(setTranslationAction, {
        workspace: "auto",
        key: "missing",
        locale: "fr",
        text: "x",
      }).catch(() => undefined);
      expect(users.received).to.deep.equal([]);
      expect(all.received).to.have.length(1);
      expect(all.received[0]).to.deep.include({
        origin: "automation",
        originProcedureId: PROCEDURE_ID,
        operation: "key-updated",
        locales: ["fr"],
      });
    } finally {
      await users.stop();
      await all.stop();
    }
  });
});

describe("[integration] lang.translations-changed: filters and loop protection", function () {
  this.timeout(TIMEOUT_MS);
  useWorkspaceStorage(true);
  beforeEach(() => automationLoopGuard.reset());

  it("filters-and-caps: workspace, operations and keyPrefix filters, a 600-key import capped at 500 keys, and deactivate stops delivery", async () => {
    await seed("filters", { locales: ["en", "fr"] });
    const prefixed = await capture(translationsChangedTrigger, {
      keyPrefix: "emails",
      includeAutomationWrites: true,
    });
    const created = await capture(translationsChangedTrigger, {
      operations: ["key-created"],
      includeAutomationWrites: true,
    });
    const other = await capture(translationsChangedTrigger, {
      workspace: "elsewhere",
      includeAutomationWrites: true,
    });
    try {
      await step(createKeyAction, {
        workspace: "filters",
        key: "emailsX.a",
        baseText: "A",
      });
      await step(createKeyAction, {
        workspace: "filters",
        key: "emails.welcome",
        baseText: "Hi",
      });
      const messages = Object.fromEntries(
        Array.from({ length: 600 }, (_, i) => [`bulk.k${i}`, `T${i}`]),
      );
      await step(importLanguageAction, {
        workspace: "filters",
        locale: "en",
        messages,
        createKeys: true,
      });
      expect(prefixed.received.map((event) => event.keys)).to.deep.equal([
        ["emails.welcome"],
      ]);
      expect(created.received.map((event) => event.keys[0])).to.deep.equal([
        "emailsX.a",
        "emails.welcome",
      ]);
      expect(other.received).to.deep.equal([]);
    } finally {
      await prefixed.stop();
      await other.stop();
    }
    const imported = await capture(translationsChangedTrigger, {
      operations: ["language-imported"],
      includeAutomationWrites: true,
    });
    const messages = Object.fromEntries(
      Array.from({ length: 600 }, (_, i) => [`bulk.k${i}`, `F${i}`]),
    );
    await step(importLanguageAction, {
      workspace: "filters",
      locale: "fr",
      messages,
    });
    await imported.stop();
    await step(importLanguageAction, {
      workspace: "filters",
      locale: "fr",
      messages: { "bulk.k0": "again" },
    });
    expect(imported.received).to.have.length(1);
    expect(imported.received[0]).to.deep.include({
      keyCount: 600,
      keysTruncated: true,
    });
    expect(imported.received[0]?.keys).to.have.length(500);
    await created.stop();
  });

  it("listener-failure-and-breaker: a throwing listener never fails the write; a sixth procedure write on one key within a minute is dropped", async () => {
    await seed("loop", { locales: ["en", "fr"], keys: { k: { en: "K" } } });
    const stopThrowing = changeChannel.subscribe(() => {
      throw new Error("listener failure");
    });
    const watch = await capture(translationsChangedTrigger, {
      includeAutomationWrites: true,
    });
    try {
      for (let index = 0; index < 6; index += 1)
        await step(setTranslationAction, {
          workspace: "loop",
          key: "k",
          locale: "fr",
          text: `K${index}`,
        });
      expect(watch.received).to.have.length(5);
    } finally {
      stopThrowing();
      await watch.stop();
    }
  });
});

describe("[integration] lang.base-text-changed and lang.language-completed", function () {
  this.timeout(TIMEOUT_MS);
  useWorkspaceStorage(true);
  const project = useProjectFiles();
  beforeEach(() => automationLoopGuard.reset());

  it("base-text: a base change fires with the outdated languages; a target change, the same text and a key creation do not", async () => {
    await seed("base", {
      locales: ["en", "fr", "de"],
      keys: { t: { en: "Title", fr: "Titre" } },
    });
    const watch = await capture(baseTextChangedTrigger, { workspace: "base" });
    try {
      await lang("PUT", "/key", {
        workspace: "base",
        path: "t",
        values: { fr: "Titre 2" },
      });
      await lang("PUT", "/key", {
        workspace: "base",
        path: "t",
        values: { en: "Title" },
      });
      await lang("POST", "/key", {
        workspace: "base",
        path: "u",
        values: { en: "U" },
      });
      await lang("PUT", "/key", {
        workspace: "base",
        path: "t",
        values: { en: "Heading" },
      });
      expect(watch.received).to.have.length(1);
      expect(watch.received[0]).to.deep.include({
        workspace: "base",
        key: "t",
        baseLocale: "en",
        previousText: "Title",
        text: "Heading",
        removed: false,
        staleLocales: ["fr"],
        origin: "user",
      });
    } finally {
      await watch.stop();
    }
  });

  it("base-text-project-files: overriding a module text reports the module text before; removing the override reports it after", async () => {
    project.reset();
    const watch = await capture(baseTextChangedTrigger, {
      keyPrefix: "dms_lang",
    });
    try {
      await lang("PUT", "/key", {
        workspace: "default",
        path: "dms_lang.title",
        values: { en: "Ours" },
      });
      await lang("DELETE", "/key/override", {
        workspace: "default",
        path: "dms_lang.title",
      });
      expect(
        watch.received.map((event) => [event.previousText, event.text]),
      ).to.deep.equal([
        ["Translations", "Ours"],
        ["Ours", "Translations"],
      ]);
    } finally {
      await watch.stop();
    }
  });

  it("completion: the last missing text fires once, whoever wrote it, with distinct ids per language; the base and a fresh empty language never do", async () => {
    await seed("done", {
      locales: ["en", "fr", "de"],
      keys: { a: { en: "A" }, b: { en: "B", fr: "Bé" } },
    });
    const watch = await capture(languageCompletedTrigger, {
      workspace: "done",
    });
    try {
      await step(setTranslationAction, {
        workspace: "done",
        key: "a",
        locale: "fr",
        text: "Ah",
      });
      await step(importLanguageAction, {
        workspace: "done",
        locale: "de",
        messages: { a: "Ah", b: "Beh" },
      });
      await lang("POST", "/key", {
        workspace: "done",
        path: "c",
        values: { en: "C", fr: "Cé" },
      });
      await lang("DELETE", "/key", { workspace: "done", path: "c" });
      expect(
        watch.received.map((event) => [
          event.locale,
          event.operation,
          event.origin,
        ]),
      ).to.deep.equal([
        ["fr", "key-updated", "automation"],
        ["de", "language-imported", "automation"],
        ["de", "key-deleted", "user"],
      ]);
      expect(watch.received[0]?.originProcedureId).to.equal(PROCEDURE_ID);
      expect(watch.received[0]?.deliveryId).to.match(/:fr$/);
      expect(watch.received[0]?.totalKeys).to.equal(2);
    } finally {
      await watch.stop();
    }
  });
});

describe("[integration] lang.coverage-below", function () {
  this.timeout(TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);

  it("transitions: seeds without firing, fires on the drop below the threshold once, again after recovering, and sees a hand-edited file", async () => {
    await seed("cov", {
      locales: ["en", "fr"],
      keys: { a: { en: "A", fr: "Ah" } },
    });
    const watch = await capture(coverageBelowTrigger, { workspace: "cov" });
    try {
      expect(watch.received).to.deep.equal([]);
      await lang("POST", "/key", {
        workspace: "cov",
        path: "b",
        values: { en: "B" },
      });
      watch.handle.poll();
      watch.handle.poll();
      expect(
        watch.received.map((event) => [
          event.locale,
          event.previousCoverage,
          event.coverage,
        ]),
      ).to.deep.equal([["fr", 100, 50]]);
      writeFileSync(
        join(storage.folder("cov"), "fr.json"),
        JSON.stringify({ a: "Ah", b: "Bé" }),
      );
      watch.handle.poll();
      writeFileSync(
        join(storage.folder("cov"), "fr.json"),
        JSON.stringify({ a: "Ah" }),
      );
      watch.handle.poll();
      expect(watch.received).to.have.length(2);
      expect(watch.received[1]).to.deep.include({
        workspace: "cov",
        workspaceKind: "added",
        missing: 1,
        totalKeys: 2,
      });
    } finally {
      await watch.stop();
    }
  });

  it("fire-on-start-and-threshold: fires on the first poll for languages already below with fireOnStart, honours a lower threshold", async () => {
    await seed("low", {
      locales: ["en", "fr"],
      keys: { a: { en: "A" }, b: { en: "B" }, c: { en: "C", fr: "Cé" } },
    });
    const atStart = await capture(coverageBelowTrigger, {
      workspace: "low",
      fireOnStart: true,
    });
    const at80 = await capture(coverageBelowTrigger, {
      workspace: "low",
      threshold: 30,
    });
    try {
      expect(
        atStart.received.map((event) => [
          event.coverage,
          event.previousCoverage,
        ]),
      ).to.deep.equal([[33, undefined]]);
      await lang("PUT", "/key", {
        workspace: "low",
        path: "c",
        values: { fr: null },
      });
      at80.handle.poll();
      expect(
        at80.received.map((event) => [event.coverage, event.threshold]),
      ).to.deep.equal([[0, 30]]);
    } finally {
      await atStart.stop();
      await at80.stop();
    }
  });
});

describe("[integration] lang.module-texts-changed", function () {
  this.timeout(TIMEOUT_MS);
  useWorkspaceStorage(true);
  let directory = "";
  before(() => {
    directory = mkdtempSync(join(tmpdir(), "dms-lang-module-"));
  });
  after(() => rmSync(directory, { recursive: true, force: true }));

  it("module-changes: the first settled state is the baseline; a module registered later and an edited module file are reported", async () => {
    const watch = await capture(moduleTextsChangedTrigger, {
      intervalSeconds: 0,
    });
    try {
      watch.handle.settle();
      expect(watch.received).to.deep.equal([]);
      const locales = join(directory, "i18n", "locales");
      mkdirSync(locales, { recursive: true });
      writeFileSync(
        join(locales, "extra-en-GB.json"),
        JSON.stringify({ extra: { hello: "Hello" } }),
      );
      await AddFrontendModule({
        name: "dms-lang-test-extra",
        sourcePath: directory,
        renderer: { name: "vue", version: "3" },
        priority: 10,
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
      watch.handle.settle();
      expect(watch.received).to.have.length(1);
      expect(watch.received[0]).to.deep.include({
        modulesAdded: ["dms-lang-test-extra"],
        keysAdded: ["extra.hello"],
        keysRemoved: [],
      });
      writeFileSync(
        join(locales, "extra-en-GB.json"),
        JSON.stringify({ extra: { hello: "Hi" } }),
      );
      watch.handle.settle();
      expect(watch.received[1]).to.deep.include({
        modulesAdded: [],
        keysChanged: ["extra.hello"],
      });
    } finally {
      await watch.stop();
    }
  });
});
