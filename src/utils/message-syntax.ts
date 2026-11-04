import { baseCompile, CompileErrorCodes } from "@intlify/message-compiler";
import { fail } from "./errors";

const DETAIL_PREFIX = "$dms_lang.errors.message_syntax";

/** The name of each error of the vue-i18n compiler, lower-cased: `unbalanced_closing_brace`. */
const PROBLEM_NAMES = new Map<number, string>(
  Object.entries(CompileErrorCodes).map(([name, code]) => [
    code,
    name.toLowerCase(),
  ]),
);

/** One error vue-i18n finds in a message, where it starts. */
export type MessageIssue = {
  problem: string;
  offset: number;
};

/**
 * The errors the vue-i18n compiler finds in a message, the first of each
 * kind: exactly what would keep it from showing. Empty when it compiles.
 */
export function messageIssues(message: string): MessageIssue[] {
  const issues = new Map<string, MessageIssue>();
  baseCompile(message, {
    onError: (error) => {
      const problem = PROBLEM_NAMES.get(error.code) ?? String(error.code);
      if (issues.has(problem)) return;
      issues.set(problem, {
        problem,
        offset: error.location?.start.offset ?? 0,
      });
    },
  });
  return [...issues.values()];
}

/**
 * 400 `invalid_message` when a message would not compile in vue-i18n:
 * `problems` names each error, `details` its `$dms_lang.errors.message_syntax.*`
 * sentence and `issues` where it starts.
 */
export function assertMessageSyntax(locale: string, message: string): void {
  const issues = messageIssues(message);
  if (issues.length === 0) return;
  fail("invalid_message", {
    locale,
    problems: issues.map((issue) => issue.problem),
    details: issues.map((issue) => `${DETAIL_PREFIX}.${issue.problem}`),
    issues,
  });
}
