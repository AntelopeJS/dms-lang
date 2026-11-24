import { expect } from "chai";
import { getKeyAction } from "../automation/actions/get-key";
import { languageCoverageAction } from "../automation/actions/language-coverage";
import { listWorkspacesAction } from "../automation/actions/list-workspaces";
import { namespaceCoverageAction } from "../automation/actions/namespace-coverage";
import { publicUrlAction } from "../automation/actions/public-url";
import { translateAction } from "../automation/actions/translate";
import { workspaceSummaryAction } from "../automation/actions/workspace-summary";
import { seed, useWorkspaceStorage } from "./helpers/api-suite";
import {
  failureOf,
  objectsField,
  step,
  textField,
  withEditable,
} from "./helpers/automation";

const TIMEOUT_MS = 20_000;
const CHAIN_LENGTH = 10;

describe("[integration] Lang read actions: cases", function () {
  this.timeout(TIMEOUT_MS);
  useWorkspaceStorage(true);

  before(async () => {
    const chain = Object.fromEntries(
      Array.from({ length: CHAIN_LENGTH }, (_, index) => [
        `chain.k${index}`,
        { en: index === CHAIN_LENGTH - 1 ? "end" : `@:chain.k${index + 1}` },
      ]),
    );
    await seed("cases", {
      locales: ["en", "fr"],
      keys: {
        ...chain,
        "a.one": { en: "One", fr: "Un" },
        "b.two": { en: "Two" },
        "b.three": { en: "Three" },
      },
    });
  });

  it("refusals: linked messages deeper than 8, an invalid key path, an unknown language for coverage and for the heatmap", async () => {
    expect(
      await failureOf(
        step(translateAction, {
          workspace: "cases",
          key: "chain.k0",
          locale: "en",
        }),
      ),
    ).to.match(/deeper than 8 .*\(linked_depth\)$/);
    expect(
      await step(translateAction, {
        workspace: "cases",
        key: "chain.k2",
        locale: "en",
      }),
    ).to.deep.include({ text: "end" });
    expect(
      await failureOf(step(getKeyAction, { workspace: "cases", key: "a..b" })),
    ).to.match(/\(invalid_key_path\)$/);
    expect(
      await failureOf(
        step(languageCoverageAction, { workspace: "cases", locale: "it" }),
      ),
    ).to.match(/\(unknown_locale\)$/);
    expect(
      await failureOf(
        step(namespaceCoverageAction, { workspace: "cases", locale: "it" }),
      ),
    ).to.match(/\(unknown_locale\)$/);
  });

  it("figures: the base language, the heatmap limit and its order for one language, and the URL template for an empty language", async () => {
    expect(
      await step(languageCoverageAction, { workspace: "cases", locale: "en" }),
    ).to.deep.include({ isBase: true, missing: 0, complete: true });
    const heatmap = await step(namespaceCoverageAction, {
      workspace: "cases",
      locale: "fr",
      limit: 1,
    });
    expect(heatmap).to.deep.include({ total: 3, truncated: true });
    expect(
      objectsField(heatmap, "namespaces").map((row) => row.namespace),
    ).to.deep.equal(["chain"]);
    const url = await step(publicUrlAction, { workspace: "cases" });
    expect(url).to.deep.include({ served: true, servedLocale: "" });
    expect(textField(url, "url")).to.equal(textField(url, "template"));
    expect(textField(url, "template")).to.match(/\/cases\/\{locale\}\.json$/);
  });

  it("editable: the summary and the list say a workspace is editable only where editing is on", async () => {
    const editableKinds = async () =>
      objectsField(await step(listWorkspacesAction, {}), "workspaces")
        .filter(
          (entry) =>
            entry.id === "default" ||
            entry.id === "cases" ||
            entry.id === "modules",
        )
        .map((entry) => [entry.id, entry.editable]);
    expect(await editableKinds()).to.deep.equal([
      ["default", true],
      ["cases", true],
      ["modules", false],
    ]);
    expect(
      await step(workspaceSummaryAction, { workspace: "cases" }),
    ).to.deep.include({ editable: true });
    await withEditable(false, async () => {
      expect(await editableKinds()).to.deep.equal([
        ["default", false],
        ["cases", false],
        ["modules", false],
      ]);
      expect(
        await step(workspaceSummaryAction, { workspace: "cases" }),
      ).to.deep.include({ editable: false });
    });
  });
});
