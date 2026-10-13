import { expect } from "chai";
import { HTTPResult } from "@antelopejs/interface-api";

const MESSAGE_KEY_RE = /^\$dms_lang\.errors\.[a-z_]+$/;

interface ErrorBody {
  code: string;
  message: string;
  current?: Record<string, string | null>;
  [detail: string]: unknown;
}

/** The status and JSON body of the HTTP error `run` throws. */
interface HttpError {
  status: number;
  body: ErrorBody;
}

function errorOf(run: () => unknown): HttpError {
  try {
    run();
  } catch (error) {
    expect(error).to.be.instanceOf(HTTPResult);
    const result = error as HTTPResult;
    return { status: result.getStatus(), body: JSON.parse(result.getBody()) };
  }
  throw new Error("expected an HTTP error");
}

export function expectError(
  run: () => unknown,
  status: number,
  code: string,
): ErrorBody {
  const { status: actual, body } = errorOf(run);
  expect([actual, body.code]).to.deep.equal([status, code]);
  expect(body.message).to.match(MESSAGE_KEY_RE);
  return body;
}
