import {
  Context,
  Controller,
  Delete,
  Get,
  Parameter,
  Post,
  Put,
  type RequestContext,
  Route,
} from "@antelopejs/interface-api";
import { AuthOwnerOnly } from "@antelopejs/interface-dms/auth";
import type { User } from "@antelopejs/interface-dms/auth/db";
import { AuthUserWithPermission } from "@antelopejs/interface-dms/guards";
import { PublishMessage } from "@antelopejs/interface-dms/realtime";
import {
  createWorkspaceAction,
  deleteWorkspaceAction,
  editTranslationsAction,
  editWorkspaceAction,
  manageKeysAction,
  manageLanguagesAction,
  renameWorkspaceAction,
} from "../pages/actions";
import { LANG_REALTIME_TOPIC } from "../pages/module";
import { localeStats, workspaceAbout, workspaceKpis } from "../utils/blocks";
import { JsonBody } from "../utils/body";
import { listAllWorkspaces, resolveWorkspaceId } from "../utils/catalog";
import { getTranslationConfig } from "../utils/config";
import {
  backupWorkspace,
  exportWorkspace,
  importWorkspace,
} from "../utils/export";
import {
  baseConfirm,
  publicLocaleUrl,
  publicOrigin,
  removalConfirm,
  workspaceEndpoint,
  workspaceNotice,
  workspaceSnippet,
} from "../utils/integration";
import { listLanguages } from "../utils/languages";
import { keyStoreOf, reviewStoreOf } from "../utils/key-stores";
import {
  createKey,
  deleteKey,
  markReviewed,
  removeOverride,
  renameKey,
  updateKey,
} from "../utils/keys";
import { type FlatRow, resolveFlat, resolveRow } from "../utils/resolve";
import { summarizeWorkspaces } from "../utils/summary";
import {
  type AddedLocale,
  addLocale,
  assertEditable,
  createWorkspace,
  deleteWorkspace,
  getWorkspaceSummary,
  normalizeWorkspaceId,
  removeLocale,
  renameWorkspace,
  setWorkspaceDefaultLocale,
  updateWorkspaceDetails,
  type WorkspaceSummary,
} from "../utils/workspaces";
import { keySchema } from "../validation/key.schema";
import { querySchema } from "../validation/query.schema";
import { validate } from "../validation/validate";
import { workspaceSchema } from "../validation/workspace.schema";

interface KeyResult {
  row?: FlatRow;
}

interface DefaultLocaleResult {
  defaultLocale: string;
}

const REALTIME_CHANGE = "changed";
const PUBLIC_PATH = "/i18n";

/** Tells the open pages that a workspace changed, so they reload their blocks and data. */
function announce(workspace: string): void {
  PublishMessage(LANG_REALTIME_TOPIC, REALTIME_CHANGE, {
    payload: { workspace },
  }).catch(() => undefined);
}

function editableWorkspace(workspace: string): string {
  assertEditable();
  return resolveWorkspaceId(workspace);
}

function keyResult(workspace: string, path: string): KeyResult {
  announce(workspace);
  return { row: resolveRow(workspace, path) };
}

function permissionIds() {
  return {
    editTranslations: editTranslationsAction.permissionId,
    manageKeys: manageKeysAction.permissionId,
    manageLanguages: manageLanguagesAction.permissionId,
    createWorkspace: createWorkspaceAction.permissionId,
    renameWorkspace: renameWorkspaceAction.permissionId,
    deleteWorkspace: deleteWorkspaceAction.permissionId,
    editWorkspace: editWorkspaceAction.permissionId,
  };
}

function withPublicUrl(origin: string) {
  return (workspace: WorkspaceSummary) => {
    const publicUrl = publicLocaleUrl(origin, workspace);
    return publicUrl === undefined ? workspace : { ...workspace, publicUrl };
  };
}

@AuthOwnerOnly()
export class TranslationsController extends Controller(
  "/api/lang/translations",
) {
  @Get("/workspaces")
  workspaces(@Context() context: RequestContext) {
    const { editable } = getTranslationConfig();
    const origin = publicOrigin(context);
    return {
      editable,
      publicBaseUrl: `${origin}${PUBLIC_PATH}`,
      permissions: permissionIds(),
      workspaces: listAllWorkspaces().map(withPublicUrl(origin)),
    };
  }

  @Get("/summary")
  summary(@Context() context: RequestContext) {
    const { editable } = getTranslationConfig();
    const origin = publicOrigin(context);
    return {
      editable,
      workspaces: summarizeWorkspaces((workspace) =>
        publicLocaleUrl(origin, workspace),
      ),
    };
  }

  @Get("/kpis")
  kpis(@Parameter("workspace", "query") workspace?: string) {
    return workspaceKpis(resolveWorkspaceId(workspace));
  }

  @Get("/about")
  about(@Parameter("workspace", "query") workspace?: string) {
    return workspaceAbout(resolveWorkspaceId(workspace));
  }

  @Get("/notice")
  notice(
    @Parameter("workspace", "query") workspace?: string,
    @Parameter("page", "query") page?: string,
  ) {
    const query = validate(querySchema.notice, { page });
    return workspaceNotice(resolveWorkspaceId(workspace), query.page);
  }

  @Get("/locale-stats")
  localeStats(
    @Parameter("workspace", "query") workspace?: string,
    @Parameter("locale", "query") locale?: string,
  ) {
    return localeStats(resolveWorkspaceId(workspace), locale ?? "");
  }

  @Get("/languages")
  languages(
    @Parameter("workspace", "query") workspace?: string,
    @Parameter("sortKey", "query") sortKey?: string,
    @Parameter("sortDirection", "query") sortDirection?: string,
  ) {
    const sort = validate(querySchema.languages, { sortKey, sortDirection });
    return listLanguages(resolveWorkspaceId(workspace), sort);
  }

  @Get("/languages/:workspace/:code/removal-confirm")
  languageRemovalConfirm(
    @Context() context: RequestContext,
    @Parameter("workspace", "param") workspace: string,
    @Parameter("code", "param") code: string,
  ) {
    return removalConfirm(
      resolveWorkspaceId(workspace),
      code,
      publicOrigin(context),
    );
  }

  @Get("/languages/:workspace/:code/base-confirm")
  languageBaseConfirm(
    @Parameter("workspace", "param") workspace: string,
    @Parameter("code", "param") code: string,
  ) {
    return baseConfirm(resolveWorkspaceId(workspace), code);
  }

  @Post("/languages/:workspace/:code/base")
  makeBaseLanguage(
    @AuthUserWithPermission(manageLanguagesAction) _user: User,
    @Parameter("workspace", "param") workspace: string,
    @Parameter("code", "param") code: string,
  ): DefaultLocaleResult {
    validate(workspaceSchema.language, { workspace, code });
    const id = editableWorkspace(workspace);
    const defaultLocale = setWorkspaceDefaultLocale(id, code);
    announce(id);
    return { defaultLocale };
  }

  @Delete("/languages/:workspace/:code")
  removeLanguage(
    @AuthUserWithPermission(manageLanguagesAction) _user: User,
    @Parameter("workspace", "param") workspace: string,
    @Parameter("code", "param") code: string,
  ) {
    validate(workspaceSchema.language, { workspace, code });
    const id = editableWorkspace(workspace);
    removeLocale(id, code);
    announce(id);
  }

  @Get("/endpoint")
  endpoint(
    @Context() context: RequestContext,
    @Parameter("workspace", "query") workspace?: string,
  ) {
    return workspaceEndpoint(
      resolveWorkspaceId(workspace),
      publicOrigin(context),
    );
  }

  @Get("/snippet")
  snippet(
    @Context() context: RequestContext,
    @Parameter("workspace", "query") workspace?: string,
    @Parameter("kind", "query") kind?: string,
  ) {
    const query = validate(querySchema.snippet, { kind: kind || undefined });
    return workspaceSnippet(
      resolveWorkspaceId(workspace),
      query.kind,
      publicOrigin(context),
    );
  }

  @Get("/export")
  export(@Parameter("workspace", "query") workspace?: string) {
    return exportWorkspace(resolveWorkspaceId(workspace));
  }

  @Get("/backup")
  backup(@Parameter("workspace", "query") workspace?: string) {
    return backupWorkspace(resolveWorkspaceId(workspace));
  }

  @Get("/flat")
  flat(@Parameter("workspace", "query") workspace?: string) {
    return resolveFlat(resolveWorkspaceId(workspace));
  }

  @Post("/workspace")
  createWorkspace(
    @AuthUserWithPermission(createWorkspaceAction) _user: User,
    @JsonBody() body: unknown,
  ): WorkspaceSummary {
    const { id, locale, ...details } = validate(workspaceSchema.create, body);
    assertEditable();
    const created = createWorkspace(id, locale, details);
    announce(created);
    return getWorkspaceSummary(created);
  }

  @Route("handler", "patch", "/workspace")
  updateWorkspace(
    @AuthUserWithPermission(editWorkspaceAction) _user: User,
    @JsonBody() body: unknown,
  ): WorkspaceSummary {
    const { id, ...details } = validate(workspaceSchema.update, body);
    assertEditable();
    const summary = updateWorkspaceDetails(id, details);
    announce(summary.id);
    return summary;
  }

  @Post("/workspace/rename")
  renameWorkspace(
    @AuthUserWithPermission(renameWorkspaceAction) _user: User,
    @JsonBody() body: unknown,
  ): WorkspaceSummary {
    const { id: previous, newId } = validate(workspaceSchema.rename, body);
    assertEditable();
    const id = renameWorkspace(previous, newId);
    announce(normalizeWorkspaceId(previous));
    announce(id);
    return getWorkspaceSummary(id);
  }

  @Delete("/workspace")
  deleteWorkspace(
    @AuthUserWithPermission(deleteWorkspaceAction) _user: User,
    @JsonBody() body: unknown,
  ) {
    const { id } = validate(workspaceSchema.remove, body);
    assertEditable();
    deleteWorkspace(id);
    announce(normalizeWorkspaceId(id));
  }

  @Post("/import")
  importWorkspace(
    @AuthUserWithPermission(createWorkspaceAction) _user: User,
    @JsonBody() body: unknown,
  ): WorkspaceSummary {
    const backup = validate(workspaceSchema.import, body);
    assertEditable();
    const id = importWorkspace(backup);
    announce(id);
    return getWorkspaceSummary(id);
  }

  @Post("/locale")
  addLocale(
    @AuthUserWithPermission(manageLanguagesAction) _user: User,
    @JsonBody() body: unknown,
  ): AddedLocale {
    const { workspace, ...locale } = validate(workspaceSchema.addLocale, body);
    const id = editableWorkspace(workspace);
    const added = addLocale(id, locale);
    announce(id);
    return added;
  }

  @Post("/key")
  createKey(
    @AuthUserWithPermission(manageKeysAction) _user: User,
    @JsonBody() body: unknown,
  ): KeyResult {
    const input = validate(keySchema.create, body);
    const id = editableWorkspace(input.workspace);
    createKey(keyStoreOf(id), input.path, input.values, input.before);
    return keyResult(id, input.path);
  }

  @Put("/key")
  updateKey(
    @AuthUserWithPermission(editTranslationsAction) _user: User,
    @JsonBody() body: unknown,
  ): KeyResult {
    const input = validate(keySchema.update, body);
    const id = editableWorkspace(input.workspace);
    updateKey(keyStoreOf(id), input.path, input.values, input.expected);
    return keyResult(id, input.path);
  }

  @Delete("/key/override")
  removeOverride(
    @AuthUserWithPermission(editTranslationsAction) _user: User,
    @JsonBody() body: unknown,
  ): KeyResult {
    const input = validate(keySchema.locales, body);
    const id = editableWorkspace(input.workspace);
    removeOverride(keyStoreOf(id), input.path, input.locales);
    return keyResult(id, input.path);
  }

  @Post("/key/reviewed")
  markReviewed(
    @AuthUserWithPermission(editTranslationsAction) _user: User,
    @JsonBody() body: unknown,
  ): KeyResult {
    const input = validate(keySchema.locales, body);
    const id = editableWorkspace(input.workspace);
    markReviewed(reviewStoreOf(id), input.path, input.locales);
    return keyResult(id, input.path);
  }

  @Post("/key/rename")
  renameKey(
    @AuthUserWithPermission(manageKeysAction) _user: User,
    @JsonBody() body: unknown,
  ): KeyResult {
    const input = validate(keySchema.rename, body);
    const id = editableWorkspace(input.workspace);
    const path = renameKey(keyStoreOf(id), input.path, input.newPath);
    return keyResult(id, path);
  }

  @Delete("/key")
  deleteKey(
    @AuthUserWithPermission(manageKeysAction) _user: User,
    @JsonBody() body: unknown,
  ) {
    const input = validate(keySchema.remove, body);
    const id = editableWorkspace(input.workspace);
    deleteKey(keyStoreOf(id), input.path);
    announce(id);
  }
}
