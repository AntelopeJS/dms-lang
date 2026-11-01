import path from "node:path";
import { defineConfig } from "@antelopejs/interface-core/config";

const preferredApiPort = process.env.PORT ?? "5010";
const dmsClientUrl = process.env.DMS_CLIENT_BASE_URL;
const editableMode = process.env.DMS_LANG_EDITABLE;
const workspacesDir = path.join(
  process.env.HOME ?? ".",
  "dms-lang-workspaces",
);

/** `DMS_LANG_EDITABLE=default` leaves the option out, to run the module's own default. */
interface LangConfig {
  editable?: boolean;
  workspacesDir: string;
}
const langConfig: LangConfig = { workspacesDir };
if (editableMode !== "default") langConfig.editable = editableMode !== "false";

/**
 * The repository's playground with the ports, origins, secrets and mail
 * `dms-control` sets for a run. The playground module and the module under
 * verification are the checkout's own builds.
 */
export default defineConfig({
  name: "verify-dms-lang",
  modules: {
    app: {
      source: { type: "local", path: "." },
    },
    "dms-lang": {
      source: { type: "local", path: "../../../.." },
      config: langConfig,
    },
    dms: {
      source: {
        type: "package",
        package: "@antelopejs/dms",
        version: ">=0.11.0 <1.0.0",
      },
      config: {
        homepage: "/modules",
        meta: { title: "AntelopeJS Lang", description: "Lang verification" },
        auth: {
          jwtSecret: process.env.DMS_JWT_SECRET ?? "dev",
          signInCountry: { database: false },
        },
        htmlRender: {
          serviceSecret: process.env.DMS_HTML_RENDER_SECRET ?? "dev",
          renderEndpoint: dmsClientUrl && `${dmsClientUrl}/api/html/render`,
        },
        apiBaseUrl: "${@api.API_PUBLIC_BASE_URL}",
        clientBaseUrl: dmsClientUrl,
        frontend: { bootstrapSecret: process.env.DMS_BOOTSTRAP_SECRET },
        docsPreview: true,
      },
    },
    mongodb: {
      source: {
        type: "package",
        package: "@antelopejs/mongodb",
        version: "^1.5.0",
      },
      config: {
        url: process.env.MONGO_URL ?? "mongodb://localhost:27017",
        database: process.env.MONGO_DATABASE ?? "verify_dms_lang",
      },
      importOverrides: [],
      disabledExports: [],
    },
    "auth-jwt": {
      source: {
        type: "package",
        package: "@antelopejs/auth-jwt",
        version: "^1.0.3",
      },
      config: { secret: process.env.AUTH_JWT_SECRET ?? "dev" },
    },
    "file-storage-local": {
      source: {
        type: "package",
        package: "@antelopejs/file-storage-local",
        version: ">=0.1.9 <1.0.0",
      },
      config: {
        storagePath: ".antelope/file-storage",
        baseUrl: "${@api.API_PUBLIC_BASE_URL}",
        defaultVisibility: "private",
      },
    },
    nodemailer: {
      source: {
        type: "package",
        package: "@antelopejs/nodemailer",
        version: ">=0.0.6 <1.0.0",
      },
      config: {
        host: "127.0.0.1",
        port: Number(process.env.DMS_SMTP_PORT ?? "9"),
      },
    },
    api: {
      source: {
        type: "package",
        package: "@antelopejs/api",
        version: "^1.5.0",
      },
      config: {
        servers: [{ protocol: "http", port: preferredApiPort }],
        publicBaseUrl: dmsClientUrl,
        cors: {
          allowedOrigins: [dmsClientUrl ?? "http://localhost:3001"],
        },
      },
    },
  },
});
