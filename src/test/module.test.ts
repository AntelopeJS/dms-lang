import { expect } from "chai";
import { GetFrontendModules } from "@antelopejs/interface-dms/page";

describe("[unit] dms-lang module", () => {
  it("registers its Vue frontend with the DMS identity", async () => {
    const module = (await GetFrontendModules()).find(
      (entry) => entry.name === "@antelopejs/dms-lang-frontend-vue",
    );
    expect(module?.renderer).to.deep.equal({ name: "vue", version: "3" });
    expect(module?.sourcePath).to.match(/frontend-vue$/);
    expect(module?.priority).to.equal(0);
  });
});
