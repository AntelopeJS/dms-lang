import { expect } from "chai";
import { keySchema } from "../validation/key.schema";
import { querySchema } from "../validation/query.schema";
import { validate } from "../validation/validate";
import { workspaceSchema } from "../validation/workspace.schema";
import { expectError } from "./errors";

interface Issue {
  path: (string | number)[];
}

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
      expect((body.issues as Issue[])[0]?.path[0]).to.equal("values");
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
    expect((body.issues as Issue[])[0]?.path).to.deep.equal(["before"]);
  });

  it("refuses an unknown snippet, sort or page instead of looking it up", () => {
    for (const kind of ["__proto__", "constructor", "php"])
      expectError(
        () => validate(querySchema.snippet, { kind }),
        400,
        "invalid_body",
      );
    expect(validate(querySchema.snippet, {}).kind).to.equal("vue");
    expectError(
      () => validate(querySchema.languages, { sortKey: "__proto__" }),
      400,
      "invalid_body",
    );
    expect(validate(querySchema.notice, {}).page).to.equal("overview");
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
