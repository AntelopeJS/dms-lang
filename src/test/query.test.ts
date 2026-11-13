import { expect } from "chai";
import { TranslationsController } from "../routes/translations";

describe("query parameters", () => {
  it("reads a workspace given without a value as the project files", () => {
    const routes = new TranslationsController();
    expect(routes.workspace(true)).to.deep.equal(routes.workspace(undefined));
    expect(routes.kpis(true)).to.deep.equal(routes.kpis(undefined));
  });

  it("reads a locale given without a value as no locale", () => {
    const routes = new TranslationsController();
    expect(routes.export(undefined, true)).to.deep.equal(
      routes.export(undefined, undefined),
    );
  });
});
