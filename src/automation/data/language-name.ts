import { z } from "zod";
import { nativeName } from "../../utils/languages";
import {
  canonicalLocale,
  languageOf,
  normalizeLocaleCode,
} from "../../utils/locale-codes";
import {
  BOOLEAN,
  MAX_LIST_ITEMS,
  MAX_LOCALE_LENGTH,
  STRING,
  STRINGS,
} from "../fields";
import { dataNode, nodeTexts, objectSchema } from "../support";

const ID = "lang.language-name";
const texts = nodeTexts("data", ID);

const input = z.object({
  code: z.string().max(MAX_LOCALE_LENGTH),
  inLanguage: z.string().max(MAX_LOCALE_LENGTH).optional().default(""),
  siblings: z
    .array(z.string().max(MAX_LOCALE_LENGTH))
    .max(MAX_LIST_ITEMS)
    .optional()
    .default([]),
});

function validCode(code: string): string | undefined {
  try {
    return normalizeLocaleCode(code);
  } catch {
    return undefined;
  }
}

export const languageNameData = dataNode({
  id: ID,
  icon: "i-ph-globe",
  inputSchema: objectSchema(
    {
      code: {
        type: "string",
        maxLength: MAX_LOCALE_LENGTH,
        description: texts.hint("code"),
      },
      inLanguage: {
        type: "string",
        maxLength: MAX_LOCALE_LENGTH,
        description: texts.hint("inLanguage"),
      },
      siblings: {
        ...STRINGS,
        maxItems: MAX_LIST_ITEMS,
        description: texts.hint("siblings"),
      },
    },
    ["code"],
  ),
  outputSchema: objectSchema({
    name: STRING,
    code: STRING,
    language: STRING,
    valid: BOOLEAN,
  }),
  input,
  evaluate(request) {
    const code = validCode(request.code);
    if (code === undefined)
      return {
        name: request.code,
        code: canonicalLocale(request.code) ?? request.code,
        language: languageOf(request.code),
        valid: false,
      };
    const display = validCode(request.inLanguage) ?? code;
    const siblings = request.siblings.flatMap(
      (sibling) => validCode(sibling) ?? [],
    );
    return {
      name: nativeName(code, siblings, display),
      code,
      language: languageOf(code),
      valid: true,
    };
  },
});
