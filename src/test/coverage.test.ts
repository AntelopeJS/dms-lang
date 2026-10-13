import { expect } from "chai";
import { coveragePercent } from "../utils/coverage";
import type { FlatResult } from "../utils/resolve";
import { targetCoverage } from "../utils/summary";

function flatOf(totalKeys: number, localeMissing: Record<string, number>) {
  const locales = Object.keys(localeMissing);
  const flat: FlatResult = {
    defaultLocale: locales[0] ?? "",
    locales,
    rows: [],
    localeProgress: {},
    localeMissing,
    totalKeys,
    baseMissing: 0,
    incompleteKeys: 0,
  };
  return flat;
}

describe("[unit] one coverage rounding rule", () => {
  it("rounds down so that only a complete set reads 100", () => {
    expect(coveragePercent(200, 201)).to.equal(99);
    expect(coveragePercent(201, 201)).to.equal(100);
    expect(coveragePercent(29, 100)).to.equal(29);
    expect(coveragePercent(2, 3)).to.equal(66);
    expect(coveragePercent(0, 0)).to.equal(100);
  });

  it("covers the target languages as one pool of texts, rounded once", () => {
    expect(targetCoverage(flatOf(3, { en: 0, fr: 1, de: 0 }))).to.equal(83);
    expect(targetCoverage(flatOf(200, { en: 0, fr: 1, de: 1 }))).to.equal(99);
    expect(targetCoverage(flatOf(3, { en: 0 }))).to.equal(undefined);
    expect(targetCoverage(flatOf(0, { en: 0, fr: 0 }))).to.equal(undefined);
  });
});
