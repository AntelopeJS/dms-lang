import {
  createParser,
  type LinkedNode,
  type MessageNode,
  NodeTypes,
  type PluralNode,
} from "@intlify/message-compiler";
import { isNumber } from "./guards";

/** The values a message's placeholders read: `{name}` reads `name`, `{0}` reads `"0"`. */
export type MessageParams = Record<string, string | number | boolean>;

/** A message filled with its parameters. */
export interface RenderedMessage {
  text: string;
  compiles: boolean;
  missingParams: string[];
  linkedKeys: string[];
}

/** The text a linked message `@:key` shows, or `undefined` when the key has none. */
export type LinkedResolver = (key: string) => string | undefined;

const PLURAL_NAMES = ["count", "n"];
const TWO_FORMS = 2;
const MANY_FORM = 2;
const NO_CHOICE = -1;

/**
 * The plural form vue-i18n's default rule picks for `choice`: with two
 * forms, the first for exactly 1 and the second otherwise; with three,
 * `0`, `1`, then many.
 */
function pluralIndex(choice: number, forms: number): number {
  const count = Math.abs(choice);
  if (forms === TWO_FORMS) return count === 1 ? 0 : 1;
  return Math.min(count, MANY_FORM);
}

/** The choice vue-i18n reads: the number `count`, else the number `n`, else -1. */
function pluralChoice(params: MessageParams): number {
  for (const name of PLURAL_NAMES) {
    const value = Object.hasOwn(params, name) ? params[name] : undefined;
    if (isNumber(value)) return value;
  }
  return NO_CHOICE;
}

const MODIFIERS = new Map<string, (text: string) => string>([
  ["upper", (text) => text.toLocaleUpperCase()],
  ["lower", (text) => text.toLocaleLowerCase()],
  ["capitalize", (text) => text.charAt(0).toLocaleUpperCase() + text.slice(1)],
]);

interface Rendering {
  params: MessageParams;
  missing: Set<string>;
  linked: string[];
  resolve?: LinkedResolver;
}

function parameter(rendering: Rendering, name: string): string {
  if (!Object.hasOwn(rendering.params, name)) {
    rendering.missing.add(name);
    return "";
  }
  return String(rendering.params[name]);
}

function linkedText(rendering: Rendering, node: LinkedNode): string {
  const key =
    node.key.type === NodeTypes.Named
      ? parameter(rendering, node.key.key)
      : node.key.type === NodeTypes.List
        ? parameter(rendering, String(node.key.index))
        : (node.key.value ?? "");
  rendering.linked.push(key);
  const text = rendering.resolve?.(key) ?? "";
  const modifier = node.modifier
    ? MODIFIERS.get(node.modifier.value)
    : undefined;
  return modifier ? modifier(text) : text;
}

function renderItems(rendering: Rendering, message: MessageNode): string {
  return message.items
    .map((item) => {
      switch (item.type) {
        case NodeTypes.Text:
        case NodeTypes.Literal:
          return item.value ?? "";
        case NodeTypes.Named:
          return parameter(rendering, item.key);
        case NodeTypes.List:
          return parameter(rendering, String(item.index));
        case NodeTypes.Linked:
          return linkedText(rendering, item);
        default:
          return "";
      }
    })
    .join("");
}

function chooseCase(
  rendering: Rendering,
  body: MessageNode | PluralNode,
): MessageNode | undefined {
  if (body.type === NodeTypes.Message) return body;
  return body.cases[
    pluralIndex(pluralChoice(rendering.params), body.cases.length)
  ];
}

/**
 * Fills a vue-i18n message as vue-i18n shows it: named and list placeholders
 * from `params` (a missing one shows nothing and is listed), literals, the
 * plural form `count` or `n` selects, and linked messages `@:key` through
 * `resolve` (nothing when absent). A message that does not compile renders
 * as an empty text.
 */
export function renderMessage(
  message: string,
  params: MessageParams = {},
  resolve?: LinkedResolver,
): RenderedMessage {
  let compiles = true;
  const ast = createParser({
    location: false,
    onError: () => {
      compiles = false;
    },
  }).parse(message);
  const rendering: Rendering = {
    params,
    missing: new Set(),
    linked: [],
    resolve,
  };
  if (!compiles)
    return { text: "", compiles, missingParams: [], linkedKeys: [] };
  const chosen = chooseCase(rendering, ast.body);
  const text = chosen ? renderItems(rendering, chosen) : "";
  return {
    text,
    compiles,
    missingParams: [...rendering.missing],
    linkedKeys: rendering.linked,
  };
}
