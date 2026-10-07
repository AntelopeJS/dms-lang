import {
  Controller,
  Delete,
  Get,
  JSONBody,
  Parameter,
  Post,
  Put,
} from "@antelopejs/interface-api";
import { assert } from "@antelopejs/interface-api-util";
import { AuthOwnerOnly } from "@antelopejs/interface-dms/auth";
import type { User } from "@antelopejs/interface-dms/auth/db";
import { AuthUserWithPermission } from "@antelopejs/interface-dms/guards";
import {
  createWorkspaceAction,
  deleteWorkspaceAction,
  editTranslationsAction,
  manageKeysAction,
  manageLanguagesAction,
  renameWorkspaceAction,
} from "../pages/actions";
import { FALLBACK_LOCALE, listAllWorkspaces } from "../utils/catalog";
import { getTranslationConfig } from "../utils/config";
import { exportWorkspace } from "../utils/export";
import { deleteKeyFor, renameKeyFor, upsertKeyFor } from "../utils/mutations";
import {
  ALL_WORKSPACE,
  DEFAULT_WORKSPACE,
  resolveAggregatedFlat,
  resolveFlat,
  resolveTranslationData,
  resolveTranslationsByPath,
} from "../utils/resolve";
import {
  addLocale,
  assertEditable,
  createWorkspace,
  deleteWorkspace,
  removeLocale,
  renameWorkspace,
  setWorkspaceDefaultLocale,
  type WorkspaceLocale,
} from "../utils/workspaces";
import { summarizeWorkspaces } from "../utils/summary";

interface WorkspaceCreateBody {
  id: string;
  locale: WorkspaceLocale;
}

interface WorkspaceRenameBody {
  id: string;
  newId: string;
}

interface WorkspaceDeleteBody {
  id: string;
}

interface LocaleCreateBody {
  workspace: string;
  code: string;
  name?: string;
  flag?: string;
}

interface LocaleDeleteBody {
  workspace: string;
  code: string;
}

interface LocaleDefaultBody {
  workspace: string;
  code: string;
}

interface KeyUpsertBody {
  workspace: string;
  path: string;
  values?: Record<string, unknown>;
  defaultLocale?: string;
}

interface KeyRenameBody {
  workspace: string;
  path: string;
  newPath: string;
}

interface KeyDeleteBody {
  workspace: string;
  path: string;
}

@AuthOwnerOnly()
export class TranslationsController extends Controller(
  "/api/lang/translations",
) {
  @Get("/workspaces")
  workspaces() {
    const { editable } = getTranslationConfig();
    return { editable, workspaces: listAllWorkspaces() };
  }

  @Get("/summary")
  summary(@Parameter("defaultLocale", "query") defaultLocale?: string) {
    const { editable } = getTranslationConfig();
    return {
      editable,
      workspaces: summarizeWorkspaces(defaultLocale || FALLBACK_LOCALE),
    };
  }

  @Get("/export")
  export(@Parameter("workspace", "query") workspace?: string) {
    return exportWorkspace(workspace || DEFAULT_WORKSPACE);
  }

  @Get("/tree")
  tree(
    @Parameter("defaultLocale", "query") defaultLocale?: string,
    @Parameter("workspace", "query") workspace?: string,
  ) {
    const data = resolveTranslationData(
      workspace || DEFAULT_WORKSPACE,
      defaultLocale || FALLBACK_LOCALE,
    );
    return { tree: data.tree, totalKeys: data.totalKeys };
  }

  @Get("/progress")
  progress(
    @Parameter("defaultLocale", "query") defaultLocale?: string,
    @Parameter("workspace", "query") workspace?: string,
  ) {
    const data = resolveTranslationData(
      workspace || DEFAULT_WORKSPACE,
      defaultLocale || FALLBACK_LOCALE,
    );
    return { localeProgress: data.localeProgress, totalKeys: data.totalKeys };
  }

  @Get("/flat")
  flat(
    @Parameter("defaultLocale", "query") defaultLocale?: string,
    @Parameter("workspace", "query") workspace?: string,
  ) {
    const fallbackLocale = defaultLocale || FALLBACK_LOCALE;
    if (workspace === ALL_WORKSPACE) {
      return resolveAggregatedFlat(fallbackLocale);
    }
    return resolveFlat(workspace || DEFAULT_WORKSPACE, fallbackLocale);
  }

  @Get("/by-path")
  byPath(
    @Parameter("path", "query") path?: string,
    @Parameter("workspace", "query") workspace?: string,
  ) {
    assert(path, 400, "Missing required query parameter: path");
    const { translations, inherited } = resolveTranslationsByPath(
      workspace || DEFAULT_WORKSPACE,
      path,
    );
    return { path, translations, inherited };
  }

  @Post("/workspace")
  createWorkspace(
    @AuthUserWithPermission(createWorkspaceAction) _user: User,
    @JSONBody() body: WorkspaceCreateBody,
  ) {
    assertEditable();
    createWorkspace(body.id, body.locale);
  }

  @Post("/workspace/rename")
  renameWorkspace(
    @AuthUserWithPermission(renameWorkspaceAction) _user: User,
    @JSONBody() body: WorkspaceRenameBody,
  ) {
    assertEditable();
    renameWorkspace(body.id, body.newId);
  }

  @Delete("/workspace")
  deleteWorkspace(
    @AuthUserWithPermission(deleteWorkspaceAction) _user: User,
    @JSONBody() body: WorkspaceDeleteBody,
  ) {
    assertEditable();
    deleteWorkspace(body.id);
  }

  @Post("/locale")
  addLocale(
    @AuthUserWithPermission(manageLanguagesAction) _user: User,
    @JSONBody() body: LocaleCreateBody,
  ) {
    assertEditable();
    addLocale(body.workspace, {
      code: body.code,
      name: body.name,
      flag: body.flag,
    });
  }

  @Delete("/locale")
  removeLocale(
    @AuthUserWithPermission(manageLanguagesAction) _user: User,
    @JSONBody() body: LocaleDeleteBody,
  ) {
    assertEditable();
    removeLocale(body.workspace, body.code);
  }

  @Post("/locale/default")
  setDefaultLocale(
    @AuthUserWithPermission(manageLanguagesAction) _user: User,
    @JSONBody() body: LocaleDefaultBody,
  ) {
    assertEditable();
    setWorkspaceDefaultLocale(body.workspace, body.code);
  }

  @Put("/key")
  upsertKey(
    @AuthUserWithPermission(editTranslationsAction) _user: User,
    @JSONBody() body: KeyUpsertBody,
  ) {
    assertEditable();
    upsertKeyFor(
      body.workspace,
      body.path,
      body.values ?? {},
      body.defaultLocale,
    );
  }

  @Post("/key/rename")
  renameKey(
    @AuthUserWithPermission(manageKeysAction) _user: User,
    @JSONBody() body: KeyRenameBody,
  ) {
    assertEditable();
    renameKeyFor(body.workspace, body.path, body.newPath);
  }

  @Delete("/key")
  deleteKey(
    @AuthUserWithPermission(manageKeysAction) _user: User,
    @JSONBody() body: KeyDeleteBody,
  ) {
    assertEditable();
    deleteKeyFor(body.workspace, body.path);
  }
}
