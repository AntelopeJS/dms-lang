import { expect } from "chai";
import type { JsonObject } from "../utils/json";
import { field, lang, send, visitor } from "./helpers/api";
import { seed, useOwner, useWorkspaceStorage } from "./helpers/api-suite";
import { listenTo } from "./helpers/realtime";
import type { RealtimeMessage } from "@antelopejs/interface-dms/realtime";
import { isString } from "../utils/guards";

const REQUEST_TIMEOUT_MS = 20_000;
const TOPIC = "dms-lang.translations";

/** The key paths a message of the topic names. */
function keysOf(message: RealtimeMessage): string[] {
  const keys = message.payload?.keys;
  return Array.isArray(keys) ? keys.filter(isString) : [];
}

describe("[integration] who may call the HTTP API", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  const storage = useWorkspaceStorage(true);

  it("anonymous-callers-are-refused: answers 401 to a visitor, changes nothing, and leaves the public files open", async () => {
    const id = "guarded";
    await seed(id, { keys: { "a.b": { en: "Hello" } } });
    const calls: [string, string, string, JsonObject?][] = [
      ["list the workspaces", "GET", "/workspaces"],
      ["read the keys", "GET", `/flat?workspace=${id}`],
      ["download a backup", "GET", `/backup?workspace=${id}`],
      [
        "create a workspace",
        "POST",
        "/workspace",
        { id: "other", locale: { code: "en" } },
      ],
      [
        "write a text",
        "PUT",
        "/key",
        { workspace: id, path: "a.b", values: { en: "Hacked" } },
      ],
      ["delete the workspace", "DELETE", "/workspace", { id }],
    ];
    for (const [label, method, path, body] of calls)
      expect((await visitor(method, path, body)).status, label).to.equal(401);
    const publicRead = await send(`/i18n/${id}/en.json`);
    expect([publicRead.status, publicRead.body]).to.deep.equal([
      200,
      { a: { b: "Hello" } },
    ]);
    const owner = await lang("GET", `/flat?workspace=${id}`);
    expect(field(owner.body, "rows")).to.deep.equal([
      { key: "a.b", values: { en: "Hello" } },
    ]);
    expect(storage.files(id)).to.deep.equal([".workspace.json", "en.json"]);
  });

  it("permissions-follow-the-page-tree: names the permission id of each write, following the page tree", async () => {
    const listed = await lang("GET", "/workspaces");
    const permissions = field(listed.body, "permissions");
    expect(permissions).to.deep.equal({
      editTranslations:
        "modules.lang.translate.translations.scoped.matrix.edit",
      manageKeys: "modules.lang.translate.translations.scoped.matrix.keys",
      manageLanguages:
        "modules.lang.manage.workspace.scoped.content.main.main.general.languages",
      createWorkspace: "modules.lang.manage.workspaces.list.create",
      renameWorkspace:
        "modules.lang.manage.workspace.scoped.content.main.main.danger.rename",
      deleteWorkspace:
        "modules.lang.manage.workspace.scoped.content.main.main.danger.delete",
      editWorkspace:
        "modules.lang.manage.workspace.scoped.content.main.main.general.edit",
    });
  });
});

describe("[integration] a module that does not set editable", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  useOwner();

  it("read-only-by-default: starts read-only: lists editable false and refuses a write with 403", async () => {
    const listed = await lang("GET", "/workspaces");
    const created = await lang("POST", "/workspace", {
      id: "never",
      locale: { code: "en" },
    });
    expect(field(listed.body, "editable")).to.equal(false);
    expect([created.status, field(created.body, "code")]).to.deep.equal([
      403,
      "read_only",
    ]);
  });
});

describe("[integration] what the module publishes on its realtime topic", function () {
  this.timeout(REQUEST_TIMEOUT_MS);
  useWorkspaceStorage(true);

  it("a-subscriber-hears-the-topic-by-its-name: lets a module that subscribes to dms-lang.translations hear the key a write changed", async () => {
    await seed("topic", {
      locales: ["en", "fr"],
      keys: { "a.one": { en: "One" } },
    });
    const listener = listenTo(TOPIC);
    try {
      await lang("PUT", "/key", {
        workspace: "topic",
        path: "a.one",
        values: { fr: "Un" },
      });
      const saved = await listener.hear(
        (message) => message.payload?.workspace === "topic",
      );
      expect(saved.topic).to.equal(TOPIC);
      expect(saved.type).to.equal("changed");
      expect(keysOf(saved)).to.deep.equal(["a.one"]);
      await lang("POST", "/key", {
        workspace: "topic",
        path: "a.two",
        values: { en: "Two" },
      });
      const created = await listener.hear((message) =>
        keysOf(message).includes("a.two"),
      );
      expect(created.payload?.workspace).to.equal("topic");
    } finally {
      listener.stop();
    }
  });
});
