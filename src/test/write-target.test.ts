import { expect } from "chai";
import { type LocaleFile, writeTargetOf } from "../utils/write-target";

function file(path: string, data: Record<string, unknown>): LocaleFile {
  return { path, data };
}

describe("[unit] project file write target", () => {
  const files = [
    file("app-en-GB.json", { app: { title: "App" } }),
    file("demo-en-GB.json", { demo: { title: "Demo" } }),
    file("helio-crm-en-GB.json", {
      helio: { crm: { title: "CRM", deals: { title: "Deals" } } },
    }),
    file("helio-team-en-GB.json", { helio: { team: { title: "Team" } } }),
  ];

  it("writes a key back to the file that defines it", () => {
    expect(writeTargetOf(files, ["helio", "crm", "title"])).to.equal(
      "helio-crm-en-GB.json",
    );
    expect(writeTargetOf(files, ["demo", "title"])).to.equal("demo-en-GB.json");
  });

  it("writes a key several files define to the last one, whose value shows", () => {
    const shadowed = [
      file("a-en-GB.json", { common: { save: "Save" } }),
      file("b-en-GB.json", { common: { save: "Store" } }),
      file("c-en-GB.json", {}),
    ];
    expect(writeTargetOf(shadowed, ["common", "save"])).to.equal(
      "b-en-GB.json",
    );
  });

  it("writes a new key to the file holding its longest namespace", () => {
    expect(writeTargetOf(files, ["helio", "crm", "deals", "empty"])).to.equal(
      "helio-crm-en-GB.json",
    );
    expect(writeTargetOf(files, ["helio", "crm", "subtitle"])).to.equal(
      "helio-crm-en-GB.json",
    );
    expect(writeTargetOf(files, ["helio", "team", "subtitle"])).to.equal(
      "helio-team-en-GB.json",
    );
  });

  it("breaks a namespace tie on the last file", () => {
    expect(writeTargetOf(files, ["helio", "billing", "title"])).to.equal(
      "helio-team-en-GB.json",
    );
  });

  it("writes a key of a new namespace to the app file", () => {
    const withAppDomain = [
      ...files,
      file("app-zebra-en-GB.json", { zebra: { title: "Zebra" } }),
    ];
    expect(writeTargetOf(withAppDomain, ["billing", "title"])).to.equal(
      "app-en-GB.json",
    );
    expect(writeTargetOf(withAppDomain, ["zebra", "subtitle"])).to.equal(
      "app-zebra-en-GB.json",
    );
  });

  it("falls back on the last file without an app file", () => {
    expect(writeTargetOf(files.slice(1), ["billing", "title"])).to.equal(
      "helio-team-en-GB.json",
    );
    expect(writeTargetOf([], ["billing", "title"])).to.equal(undefined);
  });

  it("ignores a value standing where the namespace of the key would be", () => {
    const leaf = [
      file("app-en-GB.json", {}),
      file("crm-en-GB.json", { crm: "CRM" }),
    ];
    expect(writeTargetOf(leaf, ["crm", "title"])).to.equal("app-en-GB.json");
  });
});
