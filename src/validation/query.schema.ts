import * as z from "zod";
import { NOTICE_PAGES } from "../utils/notices";
import { SNIPPET_KINDS } from "../utils/snippets";

/** The constrained queries of the read routes; an unknown value is a 400, never a lookup. */
export const querySchema = {
  snippet: z.object({ kind: z.enum(SNIPPET_KINDS).default(SNIPPET_KINDS[0]) }),
  notice: z.object({ page: z.enum(NOTICE_PAGES).default(NOTICE_PAGES[0]) }),
};
