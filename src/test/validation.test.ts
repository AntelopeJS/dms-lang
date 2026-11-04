import { expect } from "chai";
import { HTTPResult } from "@antelopejs/interface-api";
import { keySchema } from "../validation/key.schema";
import { querySchema } from "../validation/query.schema";
import { validate } from "../validation/validate";
import { workspaceSchema } from "../validation/workspace.schema";
import { expectError } from "./errors";

const KEY = { workspace: "shop", path: "a.b" };

describe("[unit] route inputs are validated at the entry", () => {
  it("accepts only texts and null as the values of a key", () => {
    for (const values of [{ en: { nested: "o" } }, { en: 42 }, { fr: true }]) {
      const body = expectError(
        () => validate(keySchema.create, { ...KEY, values }),
        400,
        "invalid_body",
      );
      expect(body.message).to.equal("$dms_lang.errors.invalid_value");
      expect(body).to.have.nested.property("issues[0].path[0]", "values");
    }
    expect(
      validate(keySchema.create, { ...KEY, values: { en: "x", fr: null } }),
    ).to.deep.include({ values: { en: "x", fr: null } });
  });

  it("answers the zod issues with a generic key when zod worded them", () => {
    const body = expectError(
      () => validate(keySchema.create, { ...KEY, values: {}, before: 42 }),
      400,
      "invalid_body",
    );
    expect(body.message).to.equal("$dms_lang.errors.invalid_body");
    expect(body).to.have.deep.nested.property("issues[0].path", ["before"]);
  });

  it("answers zod's issues, a union's included, in the bytes the DMS reads", () => {
    let body: string | undefined;
    try {
      validate(workspaceSchema.update, { id: "shop", type: 5 });
    } catch (error) {
      if (error instanceof HTTPResult) body = error.getBody();
    }
    expect(body).to.equal(
      '{"issues":[{"code":"invalid_union","unionErrors":[{"issues":[{"expected":"\'dms\' | \'website\' | \'mobile\' | \'other\'","received":"number","code":"invalid_type","path":["type"],"message":"Expected \'dms\' | \'website\' | \'mobile\' | \'other\', received number"}],"name":"ZodError"},{"issues":[{"received":5,"code":"invalid_literal","expected":"","path":["type"],"message":"Invalid literal value, expected \\"\\""}],"name":"ZodError"}],"path":["type"],"message":"Invalid input"}],"message":"$dms_lang.errors.invalid_body","code":"invalid_body"}',
    );
  });

  it("refuses an unknown snippet or page instead of looking it up", () => {
    for (const kind of ["__proto__", "constructor", "php"])
      expectError(
        () => validate(querySchema.snippet, { kind }),
        400,
        "invalid_body",
      );
    expect(validate(querySchema.snippet, {}).kind).to.equal("vue");
    expect(validate(querySchema.notice, {}).page).to.equal("overview");
  });

  it("refuses a backup of another format or of a newer version", () => {
    const backup = { id: "copy", messages: { en: {} } };
    const refusal = (stamp: { format?: string; version?: number | string }) =>
      expectError(
        () => validate(workspaceSchema.import, { ...backup, ...stamp }),
        400,
        "invalid_body",
      ).message;
    expect(refusal({ version: 2 })).to.equal("$dms_lang.errors.newer_backup");
    expect(refusal({ format: "other" })).to.equal(
      "$dms_lang.errors.invalid_backup",
    );
    expect(refusal({ version: "1" })).to.equal(
      "$dms_lang.errors.invalid_backup",
    );
    expect(
      validate(workspaceSchema.import, {
        ...backup,
        format: "dms-lang.workspace",
        version: 1,
      }),
    ).to.deep.include({ id: "copy" });
  });

  it("bounds the description and the type of a workspace", () => {
    expectError(
      () =>
        validate(workspaceSchema.update, {
          id: "shop",
          description: "x".repeat(501),
        }),
      400,
      "invalid_body",
    );
    expectError(
      () => validate(workspaceSchema.update, { id: "shop", type: "game" }),
      400,
      "invalid_body",
    );
    expect(
      validate(workspaceSchema.update, { id: "shop", description: null }),
    ).to.deep.equal({ id: "shop", description: null });
  });
});
