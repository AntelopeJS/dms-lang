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
import { getTranslationConfig } from "../utils/config";
import { deleteKeyFor, renameKeyFor, upsertKeyFor } from "../utils/mutations";
import { getLocaleCodes } from "../utils/registry";
import {
  ALL_WORKSPACE,
  DEFAULT_WORKSPACE,
  MODULES_WORKSPACE,
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
  listWorkspaces,
  removeLocale,
  renameWorkspace,
  setWorkspaceDefaultLocale,
  type WorkspaceLocale,
  type WorkspaceSummary,
} from "../utils/workspaces";

const FALLBACK_LOCALE = "en";

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
    const workspaces: WorkspaceSummary[] = [
      {
        id: DEFAULT_WORKSPACE,
        kind: "default",
        editable,
        defaultLocale: "",
        locales: getLocaleCodes("own").map((code) => ({ code })),
      },
      ...listWorkspaces(),
      {
        id: MODULES_WORKSPACE,
        kind: "modules",
        editable: false,
        defaultLocale: "",
        locales: getLocaleCodes("external").map((code) => ({ code })),
      },
    ];
    return { editable, workspaces };
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
  createWorkspace(@JSONBody() body: WorkspaceCreateBody) {
    assertEditable();
    createWorkspace(body.id, body.locale);
  }

  @Post("/workspace/rename")
  renameWorkspace(@JSONBody() body: WorkspaceRenameBody) {
    assertEditable();
    renameWorkspace(body.id, body.newId);
  }

  @Delete("/workspace")
  deleteWorkspace(@JSONBody() body: WorkspaceDeleteBody) {
    assertEditable();
    deleteWorkspace(body.id);
  }

  @Post("/locale")
  addLocale(@JSONBody() body: LocaleCreateBody) {
    assertEditable();
    addLocale(body.workspace, {
      code: body.code,
      name: body.name,
      flag: body.flag,
    });
  }

  @Delete("/locale")
  removeLocale(@JSONBody() body: LocaleDeleteBody) {
    assertEditable();
    removeLocale(body.workspace, body.code);
  }

  @Post("/locale/default")
  setDefaultLocale(@JSONBody() body: LocaleDefaultBody) {
    assertEditable();
    setWorkspaceDefaultLocale(body.workspace, body.code);
  }

  @Put("/key")
  upsertKey(@JSONBody() body: KeyUpsertBody) {
    assertEditable();
    upsertKeyFor(
      body.workspace,
      body.path,
      body.values ?? {},
      body.defaultLocale,
    );
  }

  @Post("/key/rename")
  renameKey(@JSONBody() body: KeyRenameBody) {
    assertEditable();
    renameKeyFor(body.workspace, body.path, body.newPath);
  }

  @Delete("/key")
  deleteKey(@JSONBody() body: KeyDeleteBody) {
    assertEditable();
    deleteKeyFor(body.workspace, body.path);
  }
}
