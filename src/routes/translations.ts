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
import {
  createWorkspaceAction,
  deleteWorkspaceAction,
  editTranslationsAction,
  editWorkspaceAction,
  manageKeysAction,
  manageLanguagesAction,
  renameWorkspaceAction,
} from "../pages/actions";
import { announce, RealtimeSession } from "../utils/announce";
import { localeStats, workspaceAbout, workspaceKpis } from "../utils/blocks";
import { JsonBody } from "../utils/body";
import {
  findWorkspace,
  listAllWorkspaces,
  resolveWorkspaceId,
} from "../utils/catalog";
import { getTranslationConfig } from "../utils/config";
import { LANG_API, PUBLIC_PATH } from "../utils/constants";
import {
  backupWorkspace,
  exportWorkspace,
  importWorkspace,
} from "../utils/export";
import { baseConfirm, removalConfirm } from "../utils/dialogs";
import { workspaceNotice } from "../utils/notices";
import {
  publicLocaleUrl,
  publicOrigin,
  workspaceEndpoint,
} from "../utils/public-url";
import { workspaceSnippet } from "../utils/snippets";
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
import { namespaceCoverage } from "../utils/namespaces";
import {
  type FlatCounts,
  flatCounts,
  type FlatRow,
  resolveFlat,
  resolveRow,
} from "../utils/resolve";
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

/** A key as the workspace now holds it (none once it is gone), with the figures it changed. */
interface KeyResult {
  row?: FlatRow;
  counts: FlatCounts;
}

interface DefaultLocaleResult {
  defaultLocale: string;
}

/** Who writes, from which tab: what a change is announced with. */
interface Writer {
  actor: User;
  session?: string;
}

function editableWorkspace(workspace: string): string {
  assertEditable();
  return resolveWorkspaceId(workspace);
}

function rowResult(workspace: string, path: string): KeyResult {
  return { row: resolveRow(workspace, path), counts: flatCounts(workspace) };
}

/** Announces the keys a write changed, then answers the row of `path` as it is now. */
function keyResult(
  writer: Writer,
  workspace: string,
  keys: string[],
  path = keys[0] ?? "",
): KeyResult {
  announce({ ...writer, workspace, keys });
  return rowResult(workspace, path);
}

/** The permission of each write, for the frontend to show only what the user may do. */
interface PermissionIds {
  editTranslations: string | undefined;
  manageKeys: string | undefined;
  manageLanguages: string | undefined;
  createWorkspace: string | undefined;
  renameWorkspace: string | undefined;
  deleteWorkspace: string | undefined;
  editWorkspace: string | undefined;
}

/** A workspace as /workspaces lists it: its size, and its public URL template when it is served. */
interface ListedWorkspace extends WorkspaceSummary {
  publicUrl?: string;
  totalKeys: number;
  baseMissing: number;
}

function permissionIds(): PermissionIds {
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

function listed(
  origin: string,
): (workspace: WorkspaceSummary) => ListedWorkspace {
  return (workspace) => {
    const { totalKeys, baseMissing } = resolveFlat(workspace.id);
    const entry: ListedWorkspace = { ...workspace, totalKeys, baseMissing };
    const publicUrl = publicLocaleUrl(origin, workspace);
    if (publicUrl !== undefined) entry.publicUrl = publicUrl;
    return entry;
  };
}

@AuthOwnerOnly()
export class TranslationsController extends Controller(LANG_API) {
  @Get("/workspaces")
  async workspaces(@Context() context: RequestContext) {
    const { editable } = getTranslationConfig();
    const origin = await publicOrigin(context);
    return {
      editable,
      publicBaseUrl: `${origin}${PUBLIC_PATH}`,
      permissions: permissionIds(),
      workspaces: listAllWorkspaces().map(listed(origin)),
    };
  }

  @Get("/summary")
  async summary(@Context() context: RequestContext) {
    const { editable } = getTranslationConfig();
    const origin = await publicOrigin(context);
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
  languages(@Parameter("workspace", "query") workspace?: string) {
    return listLanguages(resolveWorkspaceId(workspace));
  }

  @Get("/languages/:workspace/:code/removal-confirm")
  async languageRemovalConfirm(
    @Context() context: RequestContext,
    @Parameter("workspace", "param") workspace: string,
    @Parameter("code", "param") code: string,
  ) {
    return removalConfirm(
      resolveWorkspaceId(workspace),
      code,
      await publicOrigin(context),
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
    @AuthUserWithPermission(manageLanguagesAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @Parameter("workspace", "param") workspace: string,
    @Parameter("code", "param") code: string,
  ): DefaultLocaleResult {
    validate(workspaceSchema.language, { workspace, code });
    const id = editableWorkspace(workspace);
    const defaultLocale = setWorkspaceDefaultLocale(id, code);
    announce({ actor, session, workspace: id });
    return { defaultLocale };
  }

  @Delete("/languages/:workspace/:code")
  removeLanguage(
    @AuthUserWithPermission(manageLanguagesAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @Parameter("workspace", "param") workspace: string,
    @Parameter("code", "param") code: string,
  ) {
    validate(workspaceSchema.language, { workspace, code });
    const id = editableWorkspace(workspace);
    removeLocale(id, code);
    announce({ actor, session, workspace: id });
  }

  @Get("/endpoint")
  async endpoint(
    @Context() context: RequestContext,
    @Parameter("workspace", "query") workspace?: string,
  ) {
    return workspaceEndpoint(
      resolveWorkspaceId(workspace),
      await publicOrigin(context),
    );
  }

  @Get("/snippet")
  async snippet(
    @Context() context: RequestContext,
    @Parameter("workspace", "query") workspace?: string,
    @Parameter("kind", "query") kind?: string,
  ) {
    const query = validate(querySchema.snippet, { kind: kind || undefined });
    return workspaceSnippet(
      resolveWorkspaceId(workspace),
      query.kind,
      await publicOrigin(context),
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

  @Get("/row")
  row(
    @Parameter("workspace", "query") workspace?: string,
    @Parameter("key", "query") key?: string,
  ): KeyResult {
    return rowResult(resolveWorkspaceId(workspace), key ?? "");
  }

  @Get("/namespaces")
  namespaces(@Parameter("workspace", "query") workspace?: string) {
    return namespaceCoverage(resolveWorkspaceId(workspace));
  }

  @Get("/workspace")
  workspace(
    @Parameter("workspace", "query") workspace?: string,
  ): WorkspaceSummary {
    return findWorkspace(workspace);
  }

  @Post("/workspace")
  createWorkspace(
    @AuthUserWithPermission(createWorkspaceAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): WorkspaceSummary {
    const { id, locale, ...details } = validate(workspaceSchema.create, body);
    assertEditable();
    const created = createWorkspace(id, locale, details);
    announce({ actor, session, workspace: created });
    return getWorkspaceSummary(created);
  }

  @Route("handler", "patch", "/workspace")
  updateWorkspace(
    @AuthUserWithPermission(editWorkspaceAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): WorkspaceSummary {
    const { id, ...details } = validate(workspaceSchema.update, body);
    assertEditable();
    const summary = updateWorkspaceDetails(id, details);
    announce({ actor, session, workspace: summary.id });
    return summary;
  }

  @Post("/workspace/rename")
  renameWorkspace(
    @AuthUserWithPermission(renameWorkspaceAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): WorkspaceSummary {
    const { id: previous, newId } = validate(workspaceSchema.rename, body);
    assertEditable();
    const id = renameWorkspace(previous, newId);
    announce({ actor, session, workspace: normalizeWorkspaceId(previous) });
    announce({ actor, session, workspace: id });
    return getWorkspaceSummary(id);
  }

  @Delete("/workspace")
  deleteWorkspace(
    @AuthUserWithPermission(deleteWorkspaceAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ) {
    const { id } = validate(workspaceSchema.remove, body);
    assertEditable();
    deleteWorkspace(id);
    announce({ actor, session, workspace: normalizeWorkspaceId(id) });
  }

  @Post("/import")
  importWorkspace(
    @AuthUserWithPermission(createWorkspaceAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): WorkspaceSummary {
    const backup = validate(workspaceSchema.import, body);
    assertEditable();
    const id = importWorkspace(backup);
    announce({ actor, session, workspace: id });
    return getWorkspaceSummary(id);
  }

  @Post("/locale")
  addLocale(
    @AuthUserWithPermission(manageLanguagesAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): AddedLocale {
    const { workspace, ...locale } = validate(workspaceSchema.addLocale, body);
    const id = editableWorkspace(workspace);
    const added = addLocale(id, locale);
    announce({ actor, session, workspace: id });
    return added;
  }

  @Post("/key")
  createKey(
    @AuthUserWithPermission(manageKeysAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): KeyResult {
    const input = validate(keySchema.create, body);
    const id = editableWorkspace(input.workspace);
    createKey(keyStoreOf(id), input.path, input.values, input.before);
    return keyResult({ actor, session }, id, [input.path]);
  }

  @Put("/key")
  updateKey(
    @AuthUserWithPermission(editTranslationsAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): KeyResult {
    const input = validate(keySchema.update, body);
    const id = editableWorkspace(input.workspace);
    updateKey(keyStoreOf(id), input.path, input.values, input.expected);
    return keyResult({ actor, session }, id, [input.path]);
  }

  @Delete("/key/override")
  removeOverride(
    @AuthUserWithPermission(editTranslationsAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): KeyResult {
    const input = validate(keySchema.locales, body);
    const id = editableWorkspace(input.workspace);
    removeOverride(keyStoreOf(id), input.path, input.locales);
    return keyResult({ actor, session }, id, [input.path]);
  }

  @Post("/key/reviewed")
  markReviewed(
    @AuthUserWithPermission(editTranslationsAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): KeyResult {
    const input = validate(keySchema.locales, body);
    const id = editableWorkspace(input.workspace);
    markReviewed(reviewStoreOf(id), input.path, input.locales);
    return keyResult({ actor, session }, id, [input.path]);
  }

  @Post("/key/rename")
  renameKey(
    @AuthUserWithPermission(manageKeysAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): KeyResult {
    const input = validate(keySchema.rename, body);
    const id = editableWorkspace(input.workspace);
    const path = renameKey(keyStoreOf(id), input.path, input.newPath);
    return keyResult({ actor, session }, id, [input.path, path], path);
  }

  @Delete("/key")
  deleteKey(
    @AuthUserWithPermission(manageKeysAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): KeyResult {
    const input = validate(keySchema.remove, body);
    const id = editableWorkspace(input.workspace);
    deleteKey(keyStoreOf(id), input.path);
    return keyResult({ actor, session }, id, [input.path]);
  }
}
