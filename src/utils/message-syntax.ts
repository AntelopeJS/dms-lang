import { fail } from "./errors";

export type MessageProblem =
  | "unescaped_at"
  | "invalid_placeholder"
  | "unclosed_brace"
  | "unbalanced_brace";

/**
 * A vue-i18n variable: a name (`a-z`, `A-Z` or `_`, then also digits, `$` and `-`), a list
 * index or a quoted literal. The rule `checkMessage` applies in the interface too.
 */
const PLACEHOLDER = String.raw`\{\s*(?:[A-Za-z_][\w$-]*|\d+|'(?:[^'\\\n]|\\.)*')\s*\}`;
const PLACEHOLDER_RE = new RegExp(`^${PLACEHOLDER}`);
const CLOSED_BRACE_RE = /^\{[^{}]*\}/;
const LINKED_RE = new RegExp(
  String.raw`^@(?:\.\w+)?:(?:[\w.-]+|\([\w.-]+\)|${PLACEHOLDER})`,
);

interface Found {
  problem: MessageProblem;
  token: string;
}

interface Step {
  length: number;
  found?: Found;
}

type Reader = (rest: string) => Step;

function readBrace(rest: string): Step {
  const valid = PLACEHOLDER_RE.exec(rest);
  if (valid) return { length: valid[0].length };
  const closed = CLOSED_BRACE_RE.exec(rest);
  if (closed)
    return {
      length: closed[0].length,
      found: { problem: "invalid_placeholder", token: closed[0] },
    };
  return { length: 1, found: { problem: "unclosed_brace", token: "{" } };
}

function readAt(rest: string): Step {
  const linked = LINKED_RE.exec(rest);
  if (linked) return { length: linked[0].length };
  return { length: 1, found: { problem: "unescaped_at", token: "@" } };
}

function readStrayBrace(): Step {
  return { length: 1, found: { problem: "unbalanced_brace", token: "}" } };
}

const READERS: Record<string, Reader> = {
  "{": readBrace,
  "@": readAt,
  "}": readStrayBrace,
};

const PROBLEM_TEXTS: Record<MessageProblem, (tokens: string[]) => string> = {
  unescaped_at: () => "write a literal @ as {'@'}",
  invalid_placeholder: (tokens) =>
    `${tokens.join(" ")}: a variable name uses unaccented letters (a-z, A-Z), digits, "_" and "-", and starts with a letter or "_"`,
  unclosed_brace: () => "a { is not closed (write a literal { as {'{'})",
  unbalanced_brace: () => "a } has no opening { (write a literal } as {'}'})",
};

/** Each problem of a message with the pieces of text that cause it. */
function findProblems(message: string): Map<MessageProblem, string[]> {
  const found = new Map<MessageProblem, string[]>();
  let index = 0;
  while (index < message.length) {
    const reader = READERS[message.charAt(index)];
    if (reader === undefined) {
      index += 1;
      continue;
    }
    const step = reader(message.slice(index));
    index += step.length;
    if (!step.found) continue;
    const tokens = found.get(step.found.problem) ?? [];
    if (!tokens.includes(step.found.token)) tokens.push(step.found.token);
    found.set(step.found.problem, tokens);
  }
  return found;
}

/**
 * The vue-i18n syntax errors of a message: a bare `@` (write `{'@'}`), a placeholder that is
 * not a name / index / quoted literal, an unclosed `{` or a stray `}`. Empty when it compiles.
 */
export function messageProblems(message: string): MessageProblem[] {
  return [...findProblems(message).keys()];
}

/** One readable sentence per problem of a message. */
export function messageProblemDetails(message: string): string[] {
  return [...findProblems(message)].map(([problem, tokens]) =>
    PROBLEM_TEXTS[problem](tokens),
  );
}

/** 400 `invalid_message` when a message would not compile in vue-i18n. */
export function assertMessageSyntax(locale: string, message: string): void {
  const problems = messageProblems(message);
  if (problems.length === 0) return;
  const details = messageProblemDetails(message);
  fail("invalid_message", { locale, problems, details });
}
