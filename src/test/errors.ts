import { expect } from "chai";
import { HTTPResult } from "@antelopejs/interface-api";
import { z } from "zod";

const MESSAGE_KEY_RE = /^\$dms_lang\.errors\.[a-z_]+$/;

const ERROR_BODY = z
  .object({
    code: z.string(),
    message: z.string(),
    current: z.record(z.string().nullable()).optional(),
    id: z.string().optional(),
    locale: z.string().optional(),
    problems: z.array(z.string()).optional(),
    details: z.array(z.string()).optional(),
    /** Zod issues on a refused input, message issues on a refused text. */
    issues: z.unknown().optional(),
  })
  .passthrough();

type ErrorBody = z.infer<typeof ERROR_BODY>;

/** The status and JSON body of the HTTP error `run` throws. */
interface HttpError {
  status: number;
  body: ErrorBody;
}

function errorOf(run: () => void): HttpError {
  try {
    run();
  } catch (error) {
    expect(error).to.be.instanceOf(HTTPResult);
    if (error instanceof HTTPResult)
      return {
        status: error.getStatus(),
        body: ERROR_BODY.parse(JSON.parse(z.string().parse(error.getBody()))),
      };
  }
  throw new Error("expected an HTTP error");
}

export function expectError(
  run: () => void,
  status: number,
  code: string,
): ErrorBody {
  const { status: actual, body } = errorOf(run);
  expect([actual, body.code]).to.deep.equal([status, code]);
  expect(body.message).to.match(MESSAGE_KEY_RE);
  return body;
}
