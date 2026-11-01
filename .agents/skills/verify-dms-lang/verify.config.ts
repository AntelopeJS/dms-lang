/** A kind of one-way door. */
export type DoorKind = "data" | "format" | "contract" | "outbound" | "exposure" | "publish";

/** Path rules for one door kind: globs, declared funnel modules, and the journeys, as `feature/journey`, that contain it. */
export interface DoorRule {
  globs: string[];
  funnels: string[];
  containments: string[];
  why: string;
}

/** The repo-owned layer of the verification skill, read by `dms-control`. */
export interface VerifyConfig {
  playground: string;
  prepare: string[][];
  userFacing: string[];
  notUserFacing: string[];
  smoke: string;
  smokeJourney: string;
  doors: Record<DoorKind, DoorRule | null>;
  formal: never[];
}

const SKILL = ".agents/skills/verify-dms-lang";

const config: VerifyConfig = {
  playground: `${SKILL}/playground`,
  prepare: [
    ["pnpm", "install", "--frozen-lockfile", "--prefer-offline", "--ignore-scripts"],
    ["pnpm", "run", "build"],
    ["npm", "install", "--no-save", "--no-package-lock", "--no-audit", "--no-fund", "--prefix", SKILL, "playwright-core@1.56.1"],
    ["ln", "-sfn", "../../../../playground/node_modules", `${SKILL}/playground/node_modules`],
  ],
  userFacing: ["src/**", "frontend-vue/**", "skills/**", "package.json"],
  notUserFacing: [
    "src/test/**",
    "frontend-vue/.*",
    "frontend-vue/eslint.config.mjs",
    "frontend-vue/.vscode/**",
  ],
  smoke: "smoke",
  smokeJourney: "onboard, sign in, publish one translated message, read it back from the public URL",
  doors: {
    data: {
      globs: [
        "src/utils/workspaces.ts",
        "src/utils/keys.ts",
        "src/utils/key-stores.ts",
        "src/utils/write-target.ts",
        "src/utils/tree.ts",
      ],
      funnels: [],
      containments: ["workspaces/delete-removes-everything"],
      why: "these write and delete the translation files of a workspace or of the project, which a revert of the code does not bring back",
    },
    format: {
      globs: [
        "src/utils/export.ts",
        "src/utils/json.ts",
        "src/utils/review.ts",
        "src/utils/workspaces.ts",
        "src/utils/locale-discovery.ts",
        "src/utils/locale-codes.ts",
      ],
      funnels: [],
      containments: ["workspaces/stored-files-stay-readable"],
      why: "the stored `<locale>.json` files, the workspace manifest and the backup file are read back by the next version, by other apps and by people who kept a backup",
    },
    contract: {
      globs: [
        "package.json",
        "src/routes/**",
        "src/utils/constants.ts",
        "src/pages/actions.ts",
        "src/pages/page-actions.ts",
        "src/validation/**",
        "frontend-vue/package.json",
      ],
      funnels: [],
      containments: [],
      why: "other apps and the dashboard call these HTTP routes, the config keys `editable` and `workspacesDir`, the permission ids and the `engines` range of the renderer",
    },
    outbound: null,
    exposure: {
      globs: ["src/routes/publicLocales.ts", "src/utils/guards.ts", "src/pages/workspace-guard.ts", "src/utils/public-url.ts"],
      funnels: [],
      containments: [],
      why: "the public files answer without credentials to any origin, and the owner-only guards decide who can read or write the translations",
    },
    publish: {
      globs: ["package.json", ".release-it.json", "changelogen.config.json", ".github/workflows/release.yml"],
      funnels: [],
      containments: [],
      why: "the package name, its files and the release workflow claim @antelopejs/dms-lang in the npm registry",
    },
  },
  formal: [],
};

export default config;
