import {
  Controller,
  Get,
  HTTPResult,
  Parameter,
} from "@antelopejs/interface-api";
import { readWorkspaceLocale } from "../utils/workspaces";

const JSON_SUFFIX_RE = /\.json$/i;

export class PublicLocalesController extends Controller("/i18n") {
  @Get("/:workspace/:locale")
  locale(
    @Parameter("workspace", "param") workspace: string,
    @Parameter("locale", "param") rawLocale: string,
  ) {
    const locale = rawLocale.replace(JSON_SUFFIX_RE, "");

    let messages: Record<string, unknown> | null;
    try {
      messages = readWorkspaceLocale(workspace, locale);
    } catch {
      messages = null;
    }

    if (messages === null) {
      return new HTTPResult(404, {
        error: `No such locale: ${workspace}/${locale}`,
      });
    }

    return messages;
  }
}
