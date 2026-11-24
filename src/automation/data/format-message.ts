import { z } from "zod";
import { renderMessage } from "../../utils/render-message";
import { BOOLEAN, MAX_TEXT_LENGTH, STRING, STRINGS } from "../fields";
import { messageParamsField, PARAMS_PORT } from "../actions/translate";
import { dataNode, nodeTexts, objectSchema } from "../support";

const ID = "lang.format-message";
const texts = nodeTexts("data", ID);

const input = z.object({
  message: z.string().max(MAX_TEXT_LENGTH),
  params: messageParamsField,
});

export const formatMessageData = dataNode({
  id: ID,
  icon: "i-ph-brackets-curly",
  inputSchema: objectSchema(
    {
      message: {
        type: "string",
        maxLength: MAX_TEXT_LENGTH,
        description: texts.hint("message"),
      },
      params: PARAMS_PORT,
    },
    ["message"],
  ),
  outputSchema: objectSchema({
    text: STRING,
    compiles: BOOLEAN,
    missingParams: STRINGS,
    linkedKeys: STRINGS,
  }),
  input,
  evaluate(request) {
    return { ...renderMessage(request.message, request.params) };
  },
});
