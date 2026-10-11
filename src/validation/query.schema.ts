import * as z from "zod";
import { NOTICE_PAGES } from "../utils/notices";
import { SNIPPET_KINDS } from "../utils/snippets";

const SORTED_COLUMNS = ["name", "coverage"] as const;
const SORT_DIRECTIONS = ["asc", "desc"] as const;

/** The constrained queries of the read routes; an unknown value is a 400, never a lookup. */
export const querySchema = {
  snippet: z.object({ kind: z.enum(SNIPPET_KINDS).default(SNIPPET_KINDS[0]) }),
  languages: z.object({
    sortKey: z.enum(SORTED_COLUMNS).optional(),
    sortDirection: z.enum(SORT_DIRECTIONS).optional(),
  }),
  notice: z.object({ page: z.enum(NOTICE_PAGES).default(NOTICE_PAGES[0]) }),
};

export type SortDirection = (typeof SORT_DIRECTIONS)[number];
export type SortedColumn = (typeof SORTED_COLUMNS)[number];
export type LanguageSort = z.infer<typeof querySchema.languages>;
