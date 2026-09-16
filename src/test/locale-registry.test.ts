import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect } from "chai";
import { AddFrontendModule } from "@antelopejs/interface-dms/page";
import {
  getOwnWriteTarget,
  initializeLocaleRegistry,
  loadMessages,
} from "../utils/registry";

describe("[integration] registered locale sources", () => {
  let directory: string;

  before(() => {
    directory = mkdtempSync(join(tmpdir(), "dms-lang-registry-"));
  });
  after(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  async function register(
    name: string,
    priority: number,
    own: boolean,
  ): Promise<string> {
    const sourcePath = join(directory, name);
    const localeDir = join(sourcePath, "i18n/locales");
    mkdirSync(localeDir, { recursive: true });
    const file = join(localeDir, "app-en-GB.json");
    writeFileSync(file, JSON.stringify({ migrationFixture: { winner: name } }));
    await AddFrontendModule({
      name: `dms-lang-test-${name}`,
      sourcePath,
      renderer: { name: "vue", version: "3" },
      priority,
      options: { dmsI18nAppLayer: own },
    });
    return file;
  }

  it("writes to the same highest-priority own source that supplies the visible value", async () => {
    const high = await register("high", 20, true);
    await register("external", 30, false);
    await register("low", 10, true);
    await initializeLocaleRegistry();
    expect(loadMessages("own").en.migrationFixture).to.deep.equal({
      winner: "high",
    });
    expect(getOwnWriteTarget("en")).to.equal(high);
    writeFileSync(
      high,
      JSON.stringify({ migrationFixture: { winner: "edited" } }),
    );
    expect(loadMessages("own").en.migrationFixture).to.deep.equal({
      winner: "edited",
    });
    rmSync(high);
    expect(loadMessages("own").en.migrationFixture).to.deep.equal({
      winner: "low",
    });
  });
});
