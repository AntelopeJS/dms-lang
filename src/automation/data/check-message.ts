import { z } from "zod";
import { messageCheck } from "../../utils/message-check";
import { BOOLEAN, MAX_TEXT_LENGTH, STRINGS } from "../fields";
import { dataNode, nodeTexts, objectSchema } from "../support";

const ID = "lang.check-message";
const texts = nodeTexts("data", ID);

const input = z.object({
  baseText: z.string().max(MAX_TEXT_LENGTH).optional().default(""),
  text: z.string().max(MAX_TEXT_LENGTH),
});

export const checkMessageData = dataNode({
  id: ID,
  icon: "i-ph-shield-check",
  inputSchema: objectSchema(
    {
      baseText: {
        type: "string",
        maxLength: MAX_TEXT_LENGTH,
        description: texts.hint("baseText"),
      },
      text: {
        type: "string",
        maxLength: MAX_TEXT_LENGTH,
        description: texts.hint("text"),
      },
    },
    ["text"],
  ),
  outputSchema: objectSchema({
    hasIssue: BOOLEAN,
    compiles: BOOLEAN,
    problems: STRINGS,
    missingParams: STRINGS,
    unknownParams: STRINGS,
    pluralFormsDiffer: BOOLEAN,
    extraSpaces: BOOLEAN,
    isEmpty: BOOLEAN,
  }),
  input,
  evaluate(request) {
    return { ...messageCheck(request.baseText, request.text) };
  },
});
