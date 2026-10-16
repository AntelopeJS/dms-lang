import { expect } from "chai";
import { GetFrontendModules } from "@antelopejs/interface-dms/page";

const FRONTEND_NAME = "@antelopejs/dms-lang-frontend-vue";

const frontendModule = async () =>
  (await GetFrontendModules()).find((entry) => entry.name === FRONTEND_NAME);

describe("[unit] dms-lang module", () => {
  it("registers its Vue frontend with the DMS identity", async () => {
    const module = await frontendModule();
    expect(module?.renderer).to.deep.equal({ name: "vue", version: "3" });
    expect(module?.sourcePath).to.match(/frontend-vue$/);
    expect(module?.priority).to.equal(0);
  });

  it("has the frontend server proxy the public language files, without a session", async () => {
    const module = await frontendModule();
    expect(module?.backendProxies).to.deep.include({
      path: "/i18n/**",
      auth: "none",
    });
  });
});
