import { baseCompile, NodeTypes } from "@intlify/message-compiler";
import { isMissing } from "./tree";
import { isNumberOrBoolean, isObject, isString } from "./guards";

/** The variables a plural message may use without its base naming them. */
const IMPLICIT_PLURAL_NAMES = ["count", "n"];
const LEADING_SPACE = /^\s/;
const TRAILING_SPACE = /\s$/;
const SINGLE_FORM = 1;
/** Past this many checked texts, the remembered verdicts are dropped. */
const MAX_REMEMBERED = 50_000;
const PAIR_SEPARATOR = "\u0000";

/** A message as the vue-i18n compiler reads it: whether it compiles, its variables and plural forms. */
interface CompiledMessage {
  compiles: boolean;
  names: Set<string>;
  forms: number;
}

interface AstNode {
  type?: number;
  key?: unknown;
  index?: number;
  cases?: unknown[];
}

const verdicts = new Map<string, boolean>();

function isNode(value: unknown): value is AstNode {
  return typeof value === "object" && value !== null;
}

function nameOf(node: AstNode): string | undefined {
  if (node.type === NodeTypes.Named && isString(node.key)) return node.key;
  if (node.type === NodeTypes.List) return String(node.index);
  return undefined;
}

/** The variables a message uses, linked keys included. */
function collectNames(node: unknown, names: Set<string>): void {
  if (Array.isArray(node)) {
    for (const child of node) collectNames(child, names);
    return;
  }
  if (!isNode(node)) return;
  const name = nameOf(node);
  if (name !== undefined) names.add(name);
  for (const child of Object.values(node))
    if (isObject(child) || child === null) collectNames(child, names);
}

function compile(message: string): CompiledMessage {
  let compiles = true;
  const { ast } = baseCompile(message, {
    onError: () => {
      compiles = false;
    },
  });
  const names = new Set<string>();
  collectNames(ast.body, names);
  const body = ast.body;
  const forms =
    body.type === NodeTypes.Plural ? (body.cases?.length ?? 0) : SINGLE_FORM;
  return { compiles, names, forms };
}

function edgeSpaces(text: string): [boolean, boolean] {
  return [LEADING_SPACE.test(text), TRAILING_SPACE.test(text)];
}

/** Spaces at an end of the text that the base does not have there. */
function hasExtraSpaces(base: string, value: string): boolean {
  const [leading, trailing] = edgeSpaces(value);
  const [baseLeading, baseTrailing] = edgeSpaces(base);
  return (leading && !baseLeading) || (trailing && !baseTrailing);
}

/** Base variables left out, unknown variables, or another number of plural forms. */
function differsFromBase(
  base: CompiledMessage,
  value: CompiledMessage,
): boolean {
  const implicit = value.forms > SINGLE_FORM ? IMPLICIT_PLURAL_NAMES : [];
  const known = new Set([...base.names, ...implicit]);
  return (
    [...base.names].some((name) => !value.names.has(name)) ||
    [...value.names].some((name) => !known.has(name)) ||
    base.forms !== value.forms
  );
}

function textOf(value: unknown): string {
  if (isString(value)) return value;
  return isNumberOrBoolean(value) ? String(value) : "";
}

function checkPair(base: string, value: string): boolean {
  const compiled = compile(value);
  if (!compiled.compiles || hasExtraSpaces(base, value)) return true;
  if (isMissing(base)) return false;
  return differsFromBase(compile(base), compiled);
}

/**
 * Whether a text has an issue, read as a vue-i18n message: it does not
 * compile, it has spaces at an end the base does not have, it leaves out a
 * variable of the base or uses one the base does not have, or it has another
 * number of plural forms. An empty base checks the text alone (the base text
 * itself); an empty text has no issue, it is missing. The rule the frontend
 * applies to the text being typed (`checkMessage`).
 */
export function hasMessageIssue(base: unknown, value: unknown): boolean {
  if (isMissing(value)) return false;
  const pair = `${textOf(base)}${PAIR_SEPARATOR}${textOf(value)}`;
  const known = verdicts.get(pair);
  if (known !== undefined) return known;
  if (verdicts.size >= MAX_REMEMBERED) verdicts.clear();
  const verdict = checkPair(textOf(base), textOf(value));
  verdicts.set(pair, verdict);
  return verdict;
}
