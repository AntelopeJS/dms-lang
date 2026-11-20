import { expect } from "chai";
import { checkMessageData } from "../automation/data/check-message";
import { formatMessageData } from "../automation/data/format-message";
import { languageNameData } from "../automation/data/language-name";
import { hasMessageIssue } from "../utils/message-check";
import { renderMessage } from "../utils/render-message";
import { withoutFileReads } from "./helpers/files";

describe("[unit] message rendering", () => {
  it("fills named, list and literal placeholders, picks plural forms, lists missing parameters and resolves linked messages", () => {
    expect(
      renderMessage("Hi {name}, {0}!", { name: "Ann", 0: "welcome" }).text,
    ).to.equal("Hi Ann, welcome!");
    expect(renderMessage("jane{'@'}example.com").text).to.equal(
      "jane@example.com",
    );
    const two = "one apple | {count} apples";
    expect(
      [1, 0, 4].map((count) => renderMessage(two, { count }).text),
    ).to.deep.equal(["one apple", "0 apples", "4 apples"]);
    const three = "none | one | {n} many";
    expect(
      [0, 1, 5].map((n) => renderMessage(three, { n }).text),
    ).to.deep.equal(["none", "one", "5 many"]);
    expect(renderMessage("Hi {name}").missingParams).to.deep.equal(["name"]);
    expect(
      renderMessage("See @:a.b and @.upper:c", {}, (key) =>
        key === "c" ? "cee" : "bee",
      ).text,
    ).to.equal("See bee and CEE");
    expect(renderMessage("Hi {name").compiles).to.equal(false);
  });
});

describe("[unit] Lang data nodes", () => {
  it("format-message: renders without reading any file, lists linked keys rendered empty, and reports a message that does not compile", () => {
    withoutFileReads(() => {
      const input = { message: "Total {amount} @:x.y", params: { amount: 3 } };
      const first = formatMessageData.evaluate(input);
      expect(first).to.deep.equal({
        text: "Total 3 ",
        compiles: true,
        missingParams: [],
        linkedKeys: ["x.y"],
      });
      expect(formatMessageData.evaluate(input)).to.deep.equal(first);
      expect(
        formatMessageData.evaluate({ message: "Hello {name" }),
      ).to.deep.include({ text: "", compiles: false });
    });
  });

  it("check-message: one reason at a time, with the verdict of the review queue", () => {
    const cases: [string, string, string][] = [
      ["Pay {price}", "Payer {price}", "none"],
      ["Pay {price}", "Payer", "missingParams"],
      ["Pay", "Payer {prix}", "unknownParams"],
      ["a | b", "a", "pluralFormsDiffer"],
      ["Pay", "Payer ", "extraSpaces"],
      ["", "Hello {name", "compiles"],
      ["Pay", "", "isEmpty"],
    ];
    for (const [baseText, text, reason] of cases) {
      const checked = checkMessageData.evaluate({ baseText, text });
      expect(checked.hasIssue, text).to.equal(hasMessageIssue(baseText, text));
      if (reason === "missingParams")
        expect(checked.missingParams).to.deep.equal(["price"]);
      if (reason === "unknownParams")
        expect(checked.unknownParams).to.deep.equal(["prix"]);
      if (reason === "pluralFormsDiffer")
        expect(checked.pluralFormsDiffer).to.equal(true);
      if (reason === "extraSpaces") expect(checked.extraSpaces).to.equal(true);
      if (reason === "compiles")
        expect([checked.compiles, checked.problems.length > 0]).to.deep.equal([
          false,
          true,
        ]);
      if (reason === "isEmpty")
        expect([checked.isEmpty, checked.hasIssue]).to.deep.equal([
          true,
          false,
        ]);
      if (reason === "none") expect(checked.hasIssue).to.equal(false);
    }
  });

  it("language-name: the native name, the region only beside a sibling of the same language, another display language, an invalid code", () => {
    expect(languageNameData.evaluate({ code: "fr" })).to.deep.equal({
      name: "Français",
      code: "fr",
      language: "fr",
      valid: true,
    });
    expect(
      languageNameData.evaluate({ code: "pt-BR", siblings: ["pt-PT"] }).name,
    ).to.equal("Português (Brasil)");
    expect(
      languageNameData.evaluate({ code: "fr", inLanguage: "en" }).name,
    ).to.equal("French");
    expect(languageNameData.evaluate({ code: "zz-??" })).to.deep.include({
      valid: false,
      name: "zz-??",
    });
  });
});
