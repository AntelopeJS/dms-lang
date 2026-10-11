import * as z from "zod";
import { errorMessage } from "../utils/errors";
import { WORKSPACE_TYPES } from "../utils/workspaces";

/** Longest workspace description. */
const DESCRIPTION_MAX_LENGTH = 500;
const NO_TYPE = "";

const id = z.string().trim().min(1);
const code = z.string({ message: errorMessage("invalid_locale") }).min(1);

const localeEntry = z.object({
  code,
  name: z.string().optional(),
  flag: z.string().optional(),
});

/** `null` or an empty type clears it, like an empty description. */
const details = {
  description: z.string().max(DESCRIPTION_MAX_LENGTH).nullish(),
  type: z.enum(WORKSPACE_TYPES).or(z.literal(NO_TYPE)).nullish(),
};

/** The workspace routes: create, describe, rename, delete, import and its languages. */
export const workspaceSchema = {
  create: z.object({ id, locale: localeEntry, ...details }),
  update: z.object({ id, ...details }),
  rename: z.object({ id, newId: id }),
  remove: z.object({ id }),
  import: z.object({
    id,
    messages: z.record(z.unknown(), {
      message: errorMessage("invalid_value"),
    }),
    locales: z.array(localeEntry).optional(),
    defaultLocale: z.string().optional(),
    ...details,
  }),
  addLocale: localeEntry.extend({ workspace: id }),
  language: z.object({ workspace: id, code }),
};

export type ImportInput = z.infer<typeof workspaceSchema.import>;
