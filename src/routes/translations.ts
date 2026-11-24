import {
  Controller,
  Delete,
  Get,
  Parameter,
  Post,
  Put,
  Route,
  type QueryValue,
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
import {
  createKeyService,
  deleteKeyService,
  type KeyWrite,
  markReviewedService,
  removeOverrideService,
  renameKeyService,
  updateKeyService,
} from "../services/keys";
import {
  addLanguageService,
  createWorkspaceService,
  deleteWorkspaceService,
  importWorkspaceService,
  removeLanguageService,
  renameWorkspaceService,
  setBaseLanguageService,
  updateWorkspaceService,
} from "../services/workspaces";
import type { UserWriter } from "../services/writer";
import { RealtimeSession } from "../utils/announce";
import { localeStats, workspaceAbout, workspaceKpis } from "../utils/blocks";
import { JsonBody } from "../utils/body";
import { queryText } from "../utils/query";
import {
  findWorkspace,
  listAllWorkspaces,
  resolveWorkspaceId,
} from "../utils/catalog";
import { getTranslationConfig } from "../utils/config";
import { LANG_API, PUBLIC_PATH } from "../utils/constants";
import {
  backupWorkspace,
  exportLanguage,
  exportWorkspace,
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
import { namespaceCoverage } from "../utils/namespaces";
import {
  type FlatCounts,
  flatCounts,
  type FlatRow,
  resolveFlat,
  resolveRow,
} from "../utils/resolve";
import { countTranslated, summarizeWorkspaces } from "../utils/summary";
import {
  type AddedLocale,
  getWorkspaceSummary,
  type WorkspaceSummary,
} from "../utils/workspaces";
import { keySchema } from "../validation/key.schema";
import { querySchema } from "../validation/query.schema";
import { validated } from "../validation/validate";
import { workspaceSchema } from "../validation/workspace.schema";

/** A key as the workspace now holds it (none once it is gone), with the figures it changed. */
interface KeyResult {
  row?: FlatRow;
  counts: FlatCounts;
}

interface DefaultLocaleResult {
  defaultLocale: string;
}

/** A dashboard user writing from the tab of `session`. */
function userWriter(actor: User, session: string | undefined): UserWriter {
  return { kind: "user", actor, session };
}

function rowResult(workspace: string, path: string): KeyResult {
  return { row: resolveRow(workspace, path), counts: flatCounts(workspace) };
}

/** The row of the key a write left, as it is now. */
function keyResult(write: KeyWrite): KeyResult {
  return rowResult(write.workspace, write.key);
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
  translatedStrings: number;
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
    const flat = resolveFlat(workspace.id);
    const entry: ListedWorkspace = {
      ...workspace,
      totalKeys: flat.totalKeys,
      baseMissing: flat.baseMissing,
      translatedStrings: countTranslated(flat),
    };
    const publicUrl = publicLocaleUrl(origin, workspace);
    if (publicUrl !== undefined) entry.publicUrl = publicUrl;
    return entry;
  };
}

@AuthOwnerOnly()
export class TranslationsController extends Controller(LANG_API) {
  @Get("/workspaces")
  async workspaces() {
    const { editable } = getTranslationConfig();
    const origin = await publicOrigin();
    return {
      editable,
      publicBaseUrl: `${origin}${PUBLIC_PATH}`,
      permissions: permissionIds(),
      workspaces: listAllWorkspaces().map(listed(origin)),
    };
  }

  @Get("/summary")
  async summary() {
    const { editable } = getTranslationConfig();
    const origin = await publicOrigin();
    return {
      editable,
      workspaces: summarizeWorkspaces((workspace) =>
        publicLocaleUrl(origin, workspace),
      ),
    };
  }

  @Get("/kpis")
  kpis(@Parameter("workspace", "query") workspace?: QueryValue) {
    return workspaceKpis(resolveWorkspaceId(queryText(workspace)));
  }

  @Get("/about")
  about(@Parameter("workspace", "query") workspace?: QueryValue) {
    return workspaceAbout(resolveWorkspaceId(queryText(workspace)));
  }

  @Get("/notice")
  notice(
    @Parameter("workspace", "query") workspace?: QueryValue,
    @Parameter("page", "query") page?: QueryValue,
  ) {
    const query = validated(
      querySchema.notice.safeParse({ page: queryText(page) }),
    );
    return workspaceNotice(
      resolveWorkspaceId(queryText(workspace)),
      query.page,
    );
  }

  @Get("/locale-stats")
  localeStats(
    @Parameter("workspace", "query") workspace?: QueryValue,
    @Parameter("locale", "query") locale?: QueryValue,
  ) {
    return localeStats(
      resolveWorkspaceId(queryText(workspace)),
      queryText(locale) ?? "",
    );
  }

  @Get("/languages")
  languages(@Parameter("workspace", "query") workspace?: QueryValue) {
    return listLanguages(resolveWorkspaceId(queryText(workspace)));
  }

  @Get("/languages/:workspace/:code/removal-confirm")
  async languageRemovalConfirm(
    @Parameter("workspace", "param") workspace: string,
    @Parameter("code", "param") code: string,
  ) {
    return removalConfirm(
      resolveWorkspaceId(workspace),
      code,
      await publicOrigin(),
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
    validated(workspaceSchema.language.safeParse({ workspace, code }));
    const { baseLocale } = setBaseLanguageService(
      { workspace, code },
      userWriter(actor, session),
    );
    return { defaultLocale: baseLocale };
  }

  @Delete("/languages/:workspace/:code")
  removeLanguage(
    @AuthUserWithPermission(manageLanguagesAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @Parameter("workspace", "param") workspace: string,
    @Parameter("code", "param") code: string,
  ) {
    validated(workspaceSchema.language.safeParse({ workspace, code }));
    removeLanguageService({ workspace, code }, userWriter(actor, session));
  }

  @Get("/endpoint")
  async endpoint(@Parameter("workspace", "query") workspace?: QueryValue) {
    return workspaceEndpoint(
      resolveWorkspaceId(queryText(workspace)),
      await publicOrigin(),
    );
  }

  @Get("/snippet")
  async snippet(
    @Parameter("workspace", "query") workspace?: QueryValue,
    @Parameter("kind", "query") kind?: QueryValue,
  ) {
    const query = validated(
      querySchema.snippet.safeParse({ kind: queryText(kind) || undefined }),
    );
    return workspaceSnippet(
      resolveWorkspaceId(queryText(workspace)),
      query.kind,
      await publicOrigin(),
    );
  }

  @Get("/export")
  export(
    @Parameter("workspace", "query") workspace?: QueryValue,
    @Parameter("locale", "query") locale?: QueryValue,
  ) {
    const id = resolveWorkspaceId(queryText(workspace));
    const language = queryText(locale);
    return language ? exportLanguage(id, language) : exportWorkspace(id);
  }

  @Get("/backup")
  backup(@Parameter("workspace", "query") workspace?: QueryValue) {
    return backupWorkspace(resolveWorkspaceId(queryText(workspace)));
  }

  @Get("/flat")
  flat(@Parameter("workspace", "query") workspace?: QueryValue) {
    return resolveFlat(resolveWorkspaceId(queryText(workspace)));
  }

  @Get("/row")
  row(
    @Parameter("workspace", "query") workspace?: QueryValue,
    @Parameter("key", "query") key?: QueryValue,
  ): KeyResult {
    return rowResult(
      resolveWorkspaceId(queryText(workspace)),
      queryText(key) ?? "",
    );
  }

  @Get("/namespaces")
  namespaces(@Parameter("workspace", "query") workspace?: QueryValue) {
    return namespaceCoverage(resolveWorkspaceId(queryText(workspace)));
  }

  @Get("/workspace")
  workspace(
    @Parameter("workspace", "query") workspace?: QueryValue,
  ): WorkspaceSummary {
    return findWorkspace(queryText(workspace));
  }

  @Post("/workspace")
  createWorkspace(
    @AuthUserWithPermission(createWorkspaceAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): WorkspaceSummary {
    const { id, locale, ...details } = validated(
      workspaceSchema.create.safeParse(body),
    );
    const { workspace } = createWorkspaceService(
      { id, locale, details },
      userWriter(actor, session),
    );
    return getWorkspaceSummary(workspace);
  }

  @Route("handler", "patch", "/workspace")
  updateWorkspace(
    @AuthUserWithPermission(editWorkspaceAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): WorkspaceSummary {
    const { id, ...details } = validated(
      workspaceSchema.update.safeParse(body),
    );
    return updateWorkspaceService({ id, details }, userWriter(actor, session));
  }

  @Post("/workspace/rename")
  renameWorkspace(
    @AuthUserWithPermission(renameWorkspaceAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): WorkspaceSummary {
    const { id, newId } = validated(workspaceSchema.rename.safeParse(body));
    const { workspace } = renameWorkspaceService(
      { id, newId },
      userWriter(actor, session),
    );
    return getWorkspaceSummary(workspace);
  }

  @Delete("/workspace")
  deleteWorkspace(
    @AuthUserWithPermission(deleteWorkspaceAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ) {
    const { id } = validated(workspaceSchema.remove.safeParse(body));
    deleteWorkspaceService({ id }, userWriter(actor, session));
  }

  @Post("/import")
  importWorkspace(
    @AuthUserWithPermission(createWorkspaceAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): WorkspaceSummary {
    const backup = validated(workspaceSchema.import.safeParse(body));
    const { id } = importWorkspaceService(backup, userWriter(actor, session));
    return getWorkspaceSummary(id);
  }

  @Post("/locale")
  addLocale(
    @AuthUserWithPermission(manageLanguagesAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): AddedLocale {
    const { workspace, ...locale } = validated(
      workspaceSchema.addLocale.safeParse(body),
    );
    const { code, sameLanguage } = addLanguageService(
      { workspace, locale },
      userWriter(actor, session),
    );
    return { code, sameLanguage };
  }

  @Post("/key")
  createKey(
    @AuthUserWithPermission(manageKeysAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): KeyResult {
    const input = validated(keySchema.create.safeParse(body));
    return keyResult(createKeyService(input, userWriter(actor, session)));
  }

  @Put("/key")
  updateKey(
    @AuthUserWithPermission(editTranslationsAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): KeyResult {
    const input = validated(keySchema.update.safeParse(body));
    return keyResult(updateKeyService(input, userWriter(actor, session)));
  }

  @Delete("/key/override")
  removeOverride(
    @AuthUserWithPermission(editTranslationsAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): KeyResult {
    const input = validated(keySchema.locales.safeParse(body));
    return keyResult(removeOverrideService(input, userWriter(actor, session)));
  }

  @Post("/key/reviewed")
  markReviewed(
    @AuthUserWithPermission(editTranslationsAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): KeyResult {
    const input = validated(keySchema.locales.safeParse(body));
    return keyResult(markReviewedService(input, userWriter(actor, session)));
  }

  @Post("/key/rename")
  renameKey(
    @AuthUserWithPermission(manageKeysAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): KeyResult {
    const input = validated(keySchema.rename.safeParse(body));
    return keyResult(renameKeyService(input, userWriter(actor, session)));
  }

  @Delete("/key")
  deleteKey(
    @AuthUserWithPermission(manageKeysAction) actor: User,
    @RealtimeSession() session: string | undefined,
    @JsonBody() body: unknown,
  ): KeyResult {
    const input = validated(keySchema.remove.safeParse(body));
    return keyResult(deleteKeyService(input, userWriter(actor, session)));
  }
}
