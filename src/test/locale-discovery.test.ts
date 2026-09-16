import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect } from "chai";
import type { AddFrontendModuleOptions } from "@antelopejs/interface-dms/page";
import { discoverLocaleRegistry } from "../utils/locale-discovery";

describe("[unit] Vue locale discovery", () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "dms-lang-locales-"));
  });
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  function localeFile(relative: string): string {
    const path = join(directory, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "{}");
    return path;
  }

  function module(name: string, own = false): AddFrontendModuleOptions {
    return {
      name,
      sourcePath: join(directory, name),
      renderer: { name: "vue", version: "3" },
      options: { dmsI18nAppLayer: own },
    };
  }

  it("discovers application and nested module sources without a frontend build", () => {
    const own = localeFile("app/i18n/locales/app-fr-FR.json");
    const external = localeFile("dms/layers/core/i18n/locales/core-en-GB.json");
    localeFile("dms/layers/core/i18n/locales/not-a-locale.json");
    expect(
      discoverLocaleRegistry([module("app", true), module("dms")]),
    ).to.deep.equal({
      en: [{ path: external, origin: "external" }],
      fr: [{ path: own, origin: "own" }],
    });
  });

  it("keeps low-priority sources first for last-write-wins message merging", () => {
    const high = localeFile("high/i18n/locales/high-en-GB.json");
    const low = localeFile("low/i18n/locales/low-en-GB.json");
    expect(
      discoverLocaleRegistry([module("low"), module("high")]).en,
    ).to.deep.equal([
      { path: low, origin: "external" },
      { path: high, origin: "external" },
    ]);
  });

  it("discovers added and removed files on subsequent reads", () => {
    const modules = [module("app", true)];
    expect(discoverLocaleRegistry(modules)).to.deep.equal({});
    const path = localeFile("app/i18n/locales/app-en-GB.json");
    expect(discoverLocaleRegistry(modules).en).to.deep.equal([
      { path, origin: "own" },
    ]);
    rmSync(path);
    expect(discoverLocaleRegistry(modules)).to.deep.equal({});
  });
});
