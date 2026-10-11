import * as z from "zod";
import { errorMessage } from "../utils/errors";

const INVALID_VALUE = errorMessage("invalid_value");

const workspace = z.string().trim().min(1);
const keyPath = z.string().min(1);

/** Texts by locale: a string is written, `null` (or an empty text) removes the value. */
const localeTexts = z.record(z.string({ message: INVALID_VALUE }).nullable(), {
  message: INVALID_VALUE,
});

const localeCodes = z.array(z.string());

/** The key routes: the workspace and the path of the key, then what each write needs. */
export const keySchema = {
  create: z.object({
    workspace,
    path: keyPath,
    values: localeTexts,
    before: z.string().nullish(),
  }),
  update: z.object({
    workspace,
    path: keyPath,
    values: localeTexts.default({}),
    expected: localeTexts.optional(),
  }),
  rename: z.object({ workspace, path: keyPath, newPath: keyPath }),
  remove: z.object({ workspace, path: keyPath }),
  locales: z.object({
    workspace,
    path: keyPath,
    locales: localeCodes.optional(),
  }),
};

export type LocaleTextsInput = z.infer<typeof localeTexts>;
export type CreateKeyInput = z.infer<typeof keySchema.create>;
export type UpdateKeyInput = z.infer<typeof keySchema.update>;
