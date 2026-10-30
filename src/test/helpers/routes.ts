import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import {
  computeParameter,
  getRegisteredRouteHandlers,
  HTTPResult,
  type RequestContext,
} from "@antelopejs/interface-api";
import { isObject } from "../../utils/guards";

/** `template` with its `{{query.name}}` tokens set to the page query's values, as the DMS fills an action target. */
export function filled(
  template: string,
  query: Record<string, string>,
): string {
  return template.replace(/\{\{query\.(\w+)\}\}/g, (_token, name: string) =>
    Object.hasOwn(query, name) ? query[name] : "",
  );
}

/**
 * The answer of the API handler registered for `method` at `url`'s path,
 * called with the parameters it computes from `url`, as the API calls it.
 */
export async function requestHandler(method: string, url: URL) {
  const registered = getRegisteredRouteHandlers().find(
    ({ handler }) =>
      handler.mode === "handler" &&
      handler.method === method &&
      handler.location === url.pathname,
  );
  if (!registered) throw new Error(`no ${method} handler at ${url.pathname}`);
  const { handler } = registered;
  const rawRequest = new IncomingMessage(new Socket());
  const context: RequestContext = {
    rawRequest,
    rawResponse: new ServerResponse(rawRequest),
    url,
    routeParameters: {},
    response: new HTTPResult(),
  };
  const proto: unknown = handler.proto;
  if (!isObject(proto)) throw new Error(`no controller at ${url.pathname}`);
  const receiver: unknown = Object.create(proto);
  const parameters = await Promise.all(
    handler.parameters.map((parameter) =>
      computeParameter(context, parameter, receiver),
    ),
  );
  const answer: unknown = handler.callback.apply(receiver, parameters);
  return answer;
}
