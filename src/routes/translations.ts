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
import { JsonObjectBody, requireString } from "../utils/body";
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
  type SnippetKind,
  workspaceEndpoint,
  workspaceNotice,
  workspaceSnippet,
} from "../utils/integration";
import { listLanguages } from "../utils/languages";
import {
  createKeyFor,
  deleteKeyFor,
  removeOverrideFor,
  renameKeyFor,
  updateKeyFor,
} from "../utils/mutations";
import {
  ALL_WORKSPACE,
  type FlatRow,
  resolveAggregatedFlat,
  resolveFlat,
  resolveRow,
  resolveTranslationData,
  resolveTranslationsByPath,
} from "../utils/resolve";
import { markReviewedFor } from "../utils/review";
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
  type WorkspaceDetails,
  type WorkspaceSummary,
} from "../utils/workspaces";

type Body = Record<string, unknown>;

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

function editableWorkspace(workspace: unknown): string {
  assertEditable();
  return resolveWorkspaceId(requireString(workspace, "workspace"));
}

function keyResult(workspace: string, path: unknown): KeyResult {
  announce(workspace);
  return { row: resolveRow(workspace, String(path)) };
}

function workspaceDetails(body: Body): WorkspaceDetails {
  const details: WorkspaceDetails = {};
  if ("description" in body) details.description = body.description as string;
  if ("type" in body) details.type = body.type as WorkspaceDetails["type"];
  return details;
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
    const publicUrl = publicLocaleUrl(origin, workspace.id);
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
    return workspaceNotice(resolveWorkspaceId(workspace), page ?? "");
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
    return listLanguages(resolveWorkspaceId(workspace), {
      key: sortKey,
      direction: sortDirection,
    });
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
    return workspaceSnippet(
      resolveWorkspaceId(workspace),
      (kind || "i18next") as SnippetKind,
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

  @Get("/tree")
  tree(@Parameter("workspace", "query") workspace?: string) {
    const data = resolveTranslationData(resolveWorkspaceId(workspace));
    return { tree: data.tree, totalKeys: data.totalKeys };
  }

  @Get("/progress")
  progress(@Parameter("workspace", "query") workspace?: string) {
    const data = resolveTranslationData(resolveWorkspaceId(workspace));
    return { localeProgress: data.localeProgress, totalKeys: data.totalKeys };
  }

  @Get("/flat")
  flat(@Parameter("workspace", "query") workspace?: string) {
    if (normalizeWorkspaceId(workspace) === ALL_WORKSPACE) {
      return resolveAggregatedFlat();
    }
    return resolveFlat(resolveWorkspaceId(workspace));
  }

  @Get("/by-path")
  byPath(
    @Parameter("path", "query") path?: string,
    @Parameter("workspace", "query") workspace?: string,
  ) {
    const key = requireString(path, "path");
    const { translations, inherited } = resolveTranslationsByPath(
      resolveWorkspaceId(workspace),
      key,
    );
    return { path: key, translations, inherited };
  }

  @Post("/workspace")
  createWorkspace(
    @AuthUserWithPermission(createWorkspaceAction) _user: User,
    @JsonObjectBody() body: Body,
  ): WorkspaceSummary {
    assertEditable();
    const id = createWorkspace(body.id, body.locale, workspaceDetails(body));
    announce(id);
    return getWorkspaceSummary(id);
  }

  @Route("handler", "patch", "/workspace")
  updateWorkspace(
    @AuthUserWithPermission(editWorkspaceAction) _user: User,
    @JsonObjectBody() body: Body,
  ): WorkspaceSummary {
    assertEditable();
    const summary = updateWorkspaceDetails(
      requireString(body.id, "id"),
      workspaceDetails(body),
    );
    announce(summary.id);
    return summary;
  }

  @Post("/workspace/rename")
  renameWorkspace(
    @AuthUserWithPermission(renameWorkspaceAction) _user: User,
    @JsonObjectBody() body: Body,
  ): WorkspaceSummary {
    assertEditable();
    const previous = requireString(body.id, "id");
    const id = renameWorkspace(previous, body.newId);
    // Pages still open on the old id learn that it is gone.
    announce(normalizeWorkspaceId(previous));
    announce(id);
    return getWorkspaceSummary(id);
  }

  @Delete("/workspace")
  deleteWorkspace(
    @AuthUserWithPermission(deleteWorkspaceAction) _user: User,
    @JsonObjectBody() body: Body,
  ) {
    assertEditable();
    const id = requireString(body.id, "id");
    deleteWorkspace(id);
    announce(normalizeWorkspaceId(id));
  }

  @Post("/import")
  importWorkspace(
    @AuthUserWithPermission(createWorkspaceAction) _user: User,
    @JsonObjectBody() body: Body,
  ): WorkspaceSummary {
    assertEditable();
    const id = importWorkspace(body);
    announce(id);
    return getWorkspaceSummary(id);
  }

  @Post("/locale")
  addLocale(
    @AuthUserWithPermission(manageLanguagesAction) _user: User,
    @JsonObjectBody() body: Body,
  ): AddedLocale {
    const id = editableWorkspace(body.workspace);
    const added = addLocale(id, {
      code: body.code,
      name: body.name,
      flag: body.flag,
    });
    announce(id);
    return added;
  }

  @Delete("/locale")
  removeLocale(
    @AuthUserWithPermission(manageLanguagesAction) _user: User,
    @JsonObjectBody() body: Body,
  ) {
    const id = editableWorkspace(body.workspace);
    removeLocale(id, body.code);
    announce(id);
  }

  @Post("/locale/default")
  setDefaultLocale(
    @AuthUserWithPermission(manageLanguagesAction) _user: User,
    @JsonObjectBody() body: Body,
  ): DefaultLocaleResult {
    const id = editableWorkspace(body.workspace);
    const defaultLocale = setWorkspaceDefaultLocale(id, body.code);
    announce(id);
    return { defaultLocale };
  }

  @Post("/key")
  createKey(
    @AuthUserWithPermission(manageKeysAction) _user: User,
    @JsonObjectBody() body: Body,
  ): KeyResult {
    const id = editableWorkspace(body.workspace);
    createKeyFor(id, body.path, body.values, body.before);
    return keyResult(id, body.path);
  }

  @Put("/key")
  updateKey(
    @AuthUserWithPermission(editTranslationsAction) _user: User,
    @JsonObjectBody() body: Body,
  ): KeyResult {
    const id = editableWorkspace(body.workspace);
    updateKeyFor(id, body.path, body.values, body.expected);
    return keyResult(id, body.path);
  }

  @Delete("/key/override")
  removeOverride(
    @AuthUserWithPermission(editTranslationsAction) _user: User,
    @JsonObjectBody() body: Body,
  ): KeyResult {
    const id = editableWorkspace(body.workspace);
    removeOverrideFor(id, body.path, body.locales);
    return keyResult(id, body.path);
  }

  @Post("/key/reviewed")
  markReviewed(
    @AuthUserWithPermission(editTranslationsAction) _user: User,
    @JsonObjectBody() body: Body,
  ): KeyResult {
    const id = editableWorkspace(body.workspace);
    markReviewedFor(id, body.path, body.locales);
    return keyResult(id, body.path);
  }

  @Post("/key/rename")
  renameKey(
    @AuthUserWithPermission(manageKeysAction) _user: User,
    @JsonObjectBody() body: Body,
  ): KeyResult {
    const id = editableWorkspace(body.workspace);
    const path = renameKeyFor(id, body.path, body.newPath);
    return keyResult(id, path);
  }

  @Delete("/key")
  deleteKey(
    @AuthUserWithPermission(manageKeysAction) _user: User,
    @JsonObjectBody() body: Body,
  ) {
    const id = editableWorkspace(body.workspace);
    deleteKeyFor(id, body.path);
    announce(id);
  }
}
