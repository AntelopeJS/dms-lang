import { defineConfig } from "@antelopejs/interface-core/config";

export default defineConfig({
  name: "playground",
  modules: {
    playground: {
      source: {
        type: "local",
        path: ".",
        installCommand: ["pnpm build"],
      },
    },
    "dms-lang": {
      source: {
        type: "local",
        path: "..",
        watchDir: ["src"],
        installCommand: ["pnpm build"],
      },
      config: {
        editable: true,
      },
    },
    dms: {
      source: {
        type: "package",
        package: "@antelopejs/dms",
        version: ">=0.0.1 <1.0.0",
      },
      config: {
        homepage: "/welcome",
        auth: {
          jwtSecret: "dev",
        },
        meta: {
          title: "AntelopeJS Lang",
          description: "AntelopeJS DMS language playground",
        },
      },
    },
    mongodb: {
      source: {
        type: "package",
        package: "@antelopejs/mongodb",
        version: "1.3.0",
      },
      config: {
        url: "mongodb://localhost:27017",
        database: "playground_dms_lang",
      },
      importOverrides: [],
      disabledExports: [],
    },
    "auth-jwt": {
      source: {
        type: "package",
        package: "@antelopejs/auth-jwt",
        version: "^1.0.1",
      },
      config: {
        secret: "dev",
      },
    },
    "file-storage-local": {
      source: {
        type: "package",
        package: "@antelopejs/file-storage-local",
        version: "^0.1.2",
      },
      config: {
        storagePath: ".antelope/file-storage",
        baseUrl: "http://127.0.0.1:5010",
        defaultVisibility: "private",
      },
    },
    nodemailer: {
      source: {
        type: "package",
        package: "@antelopejs/nodemailer",
        version: "0.0.4",
      },
      config: {
        ethereal: true,
      },
    },
    api: {
      source: {
        type: "package",
        package: "@antelopejs/api",
        version: "1.2.5",
      },
      config: {
        cors: {
          allowedOrigins: [
            "http://localhost:3001",
            "http://127.0.0.1:3001",
            /^https:\/\/[^/]+\.onamp\.dev$/,
            ...(process.env.DMS_CLIENT_BASE_URL
              ? [process.env.DMS_CLIENT_BASE_URL]
              : []),
          ],
        },
        servers: [
          {
            protocol: "http",
            port: "5010",
          },
        ],
      },
    },
  },
});
