import {
  Context,
  Controller,
  Get,
  HandlerPriority,
  HTTPResult,
  Parameter,
  Prefix,
  type RequestContext,
} from "@antelopejs/interface-api";
import { errorResult } from "../utils/errors";
import { readWorkspaceLocale } from "../utils/workspaces";

const JSON_SUFFIX_RE = /\.json$/i;
const ANY_ORIGIN = "*";
const ALLOWED_METHODS = "GET,HEAD,OPTIONS";
const PREFLIGHT_MAX_AGE = "86400";
const CACHE_POLICY = "no-cache";
/** Runs before the CORS middleware of the api module (HIGHEST), so its origin list does not apply here. */
const BEFORE_API_CORS = (HandlerPriority.HIGHEST - 1) as HandlerPriority;

/** Opens the public files to any origin, without credentials, whatever the CORS config of the api module. */
function openToAnyOrigin(response: HTTPResult): void {
  response.removeHeader("Access-Control-Allow-Credentials");
  response.removeHeader("Vary");
  response.addHeader("Access-Control-Allow-Origin", ANY_ORIGIN);
}

/** The translation files of the added workspaces, public and readable from any site. */
export class PublicLocalesController extends Controller("/i18n") {
  @Prefix("options", "/:workspace/:locale", BEFORE_API_CORS)
  preflight() {
    const response = new HTTPResult(204, null);
    openToAnyOrigin(response);
    response.addHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
    response.addHeader("Access-Control-Allow-Headers", ANY_ORIGIN);
    response.addHeader("Access-Control-Max-Age", PREFLIGHT_MAX_AGE);
    return response;
  }

  @Get("/:workspace/:locale")
  locale(
    @Context() context: RequestContext,
    @Parameter("workspace", "param") workspace: string,
    @Parameter("locale", "param") rawLocale: string,
  ) {
    openToAnyOrigin(context.response);
    context.response.addHeader("Cache-Control", CACHE_POLICY);
    const locale = rawLocale.replace(JSON_SUFFIX_RE, "");
    const served = readWorkspaceLocale(workspace, locale);
    if (served === null)
      return errorResult("unknown_locale", { workspace, locale });
    context.response.addHeader("Content-Language", served.code);
    return served.messages;
  }
}
