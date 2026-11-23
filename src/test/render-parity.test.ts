import {
  compile,
  createCoreContext,
  fallbackWithLocaleChain,
  registerLocaleFallbacker,
  registerMessageCompiler,
  registerMessageResolver,
  translate,
} from "@intlify/core-base";
import { expect } from "chai";
import { type MessageParams, renderMessage } from "../utils/render-message";
import { localeTexts } from "./helpers/files";

const PLACEHOLDER = /\{\s*([A-Za-z_]\w*|\d+)\s*\}/g;
const PLURAL_CHOICES = [0, 1, 2, 5];

function placeholders(text: string): string[] {
  return [...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? "");
}

/** The parameter sets a text is rendered with: each placeholder named after itself, and every plural choice. */
function paramSets(text: string): MessageParams[] {
  const named = Object.fromEntries(
    placeholders(text).map((name) => [name, `<${name}>`]),
  );
  return [
    named,
    ...PLURAL_CHOICES.map((count) => ({ ...named, count })),
    ...PLURAL_CHOICES.map((n) => ({ ...named, n })),
  ];
}

describe("[unit] message rendering matches vue-i18n", () => {
  it("renders every text of the English catalog as vue-i18n does, for every placeholder and plural choice", () => {
    const texts = localeTexts("lang-en-GB.json");
    registerMessageCompiler(compile);
    registerMessageResolver((_messages, path) => texts.get(path) ?? null);
    registerLocaleFallbacker(fallbackWithLocaleChain);
    const context = createCoreContext({
      locale: "en-US",
      messages: { "en-US": Object.fromEntries(texts) },
      missingWarn: false,
      fallbackWarn: false,
      warnHtmlMessage: false,
    });
    const differences: string[] = [];
    for (const [key, text] of texts) {
      for (const params of paramSets(text)) {
        const resolve = (linked: string): string | undefined => {
          const target = texts.get(linked);
          return target === undefined
            ? undefined
            : renderMessage(target, params, resolve).text;
        };
        const ours = renderMessage(text, params, resolve).text;
        const theirs = translate(context, key, params);
        if (ours !== theirs)
          differences.push(
            `${key} ${JSON.stringify(params)}: ${JSON.stringify(ours)} != ${JSON.stringify(theirs)}`,
          );
      }
    }
    expect(texts.size).to.be.greaterThan(500);
    expect(differences).to.deep.equal([]);
  });
});
