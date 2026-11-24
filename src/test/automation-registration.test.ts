import { internal } from "@antelopejs/interface-dms-automation";
import { expect } from "chai";
import {
  isMissingAutomationInterface,
  LANG_ACTIONS,
  LANG_DATA_NODES,
  LANG_READ_ACTIONS,
  LANG_TRIGGERS,
  LANG_WRITE_ACTIONS,
  registerAutomationNodes,
  unregisterAutomationNodes,
} from "../automation";
import { localeTextKeys } from "./helpers/files";

/** The `$dms_lang.*` texts a value names, keys without the `$`. */
function textKeys(json: string): Set<string> {
  return new Set(
    [...json.matchAll(/"\$(dms_lang\.[^"]+)"/g)].map((match) => match[1] ?? ""),
  );
}

describe("[integration] Lang automation node registration", () => {
  it("declares 5 triggers, 25 actions and 3 data nodes under lang ids; every write has a dry run, every read no side effect", () => {
    expect([
      LANG_TRIGGERS.length,
      LANG_ACTIONS.length,
      LANG_DATA_NODES.length,
    ]).to.deep.equal([5, 25, 3]);
    const ids = [...LANG_TRIGGERS, ...LANG_ACTIONS, ...LANG_DATA_NODES].map(
      (node) => node.id,
    );
    expect(new Set(ids).size).to.equal(33);
    expect(ids.every((id) => id.startsWith("lang."))).to.equal(true);
    for (const action of LANG_WRITE_ACTIONS)
      expect(
        [action.sideEffects, Object.hasOwn(action, "dryRun")],
        action.id,
      ).to.deep.equal([true, true]);
    for (const action of LANG_READ_ACTIONS)
      expect(
        [action.sideEffects, Object.hasOwn(action, "dryRun")],
        action.id,
      ).to.deep.equal([false, false]);
    expect(
      LANG_TRIGGERS.map((trigger) => [trigger.id, trigger.cluster]),
    ).to.deep.equal([
      ["lang.translations-changed", "replicated"],
      ["lang.base-text-changed", "replicated"],
      ["lang.language-completed", "replicated"],
      ["lang.coverage-below", "singleton"],
      ["lang.module-texts-changed", "singleton"],
    ]);
    const filtered = LANG_TRIGGERS.filter(
      (trigger) =>
        trigger.configSchema.properties?.includeAutomationWrites !== undefined,
    ).map((trigger) => trigger.id);
    expect(filtered).to.deep.equal([
      "lang.translations-changed",
      "lang.base-text-changed",
    ]);
  });

  it("start registered every node, stop unregisters them and a new start registers them again", async () => {
    const registered = new Set<string>();
    const leases = [
      internal.RegisterTriggerType,
      internal.RegisterActionType,
      internal.RegisterDataNodeType,
    ].map(
      (proxy) =>
        [
          proxy,
          proxy.onHandlers(
            (id: string) => {
              if (id.startsWith("lang.")) registered.add(id);
            },
            (id: string) => registered.delete(id),
            true,
          ),
        ] as const,
    );
    try {
      expect(registered.size).to.equal(33);
      await unregisterAutomationNodes();
      expect(registered.size).to.equal(0);
      await registerAutomationNodes();
      expect(registered.size).to.equal(33);
    } finally {
      for (const [proxy, lease] of leases) proxy.detach(lease);
    }
  });

  it("treats only the interface package's own not-found error as absent", () => {
    const missing = Object.assign(
      new Error(
        "Cannot find module '@antelopejs/interface-dms-automation'\nRequire stack:",
      ),
      {
        code: "MODULE_NOT_FOUND",
      },
    );
    const nested = Object.assign(new Error("Cannot find module 'left-pad'"), {
      code: "MODULE_NOT_FOUND",
    });
    expect([
      isMissingAutomationInterface(missing),
      isMissingAutomationInterface(nested),
    ]).to.deep.equal([true, false]);
  });

  it("names every node, port and hint with a text present in both locale files", () => {
    const keys = textKeys(
      JSON.stringify([...LANG_TRIGGERS, ...LANG_ACTIONS, ...LANG_DATA_NODES]),
    );
    expect(keys.size).to.be.greaterThan(200);
    for (const file of ["lang-en-GB.json", "lang-fr-FR.json"]) {
      const texts = localeTextKeys(file);
      expect(
        [...keys].filter((key) => !texts.has(key)),
        file,
      ).to.deep.equal([]);
    }
  });
});
