import { check } from "./errors";
import { validateKeyPath } from "./json";
import { findLocale, languageOf } from "./locale-codes";
import { type MessageParams, renderMessage } from "./render-message";
import { type KeyTexts, lookupTexts } from "./resolve";

const MAX_LINK_DEPTH = 8;

export interface TranslateRequest {
  workspace: string;
  key: string;
  locale: string;
  fallbackLocale: string;
  fallback: boolean;
  params: MessageParams;
}

export interface Translation {
  text: string;
  template: string;
  found: boolean;
  locale: string;
  usedFallback: boolean;
  missingParams: string[];
}

interface Served {
  locale: string;
  template: string;
}

function candidates(request: TranslateRequest, base: string): string[] {
  const own = [request.locale, languageOf(request.locale)];
  if (!request.fallback) return own;
  const fallback = request.fallbackLocale
    ? [request.fallbackLocale, languageOf(request.fallbackLocale)]
    : [];
  return [...own, ...fallback, base];
}

function serve(texts: KeyTexts, request: TranslateRequest): Served | undefined {
  for (const code of candidates(request, texts.baseLocale)) {
    const locale = findLocale(Object.keys(texts.texts), code);
    if (locale !== undefined)
      return { locale, template: texts.texts[locale] ?? "" };
  }
  return undefined;
}

function textsOf(workspace: string, key: string): KeyTexts {
  validateKeyPath(key);
  const texts = lookupTexts(workspace, key);
  check(!texts.isNamespace, "not_a_key", { path: key });
  return texts;
}

/**
 * The text of a key in a language with its parameters filled: the language,
 * then its language subtag, then (with `fallback`) the fallback language and
 * its subtag, then the base language. Linked messages `@:key` are resolved
 * through the same chain; a cycle or a chain deeper than 8 fails.
 */
export function translate(request: TranslateRequest): Translation {
  const served = serve(textsOf(request.workspace, request.key), request);
  if (served === undefined)
    return {
      text: "",
      template: "",
      found: false,
      locale: "",
      usedFallback: false,
      missingParams: [],
    };
  const chain: string[] = [request.key];
  const resolve = (key: string): string | undefined => {
    if (chain.includes(key))
      throw new Error(
        `Lang: linked messages loop through ${[...chain, key].join(" -> ")} (linked_cycle)`,
      );
    if (chain.length > MAX_LINK_DEPTH)
      throw new Error(
        `Lang: linked messages nest deeper than ${MAX_LINK_DEPTH} from "${request.key}" (linked_depth)`,
      );
    const linked = serve(textsOf(request.workspace, key), request);
    if (linked === undefined) return undefined;
    chain.push(key);
    const rendered = renderMessage(linked.template, request.params, resolve);
    chain.pop();
    return rendered.text;
  };
  const rendered = renderMessage(served.template, request.params, resolve);
  check(rendered.compiles, "invalid_message", {
    path: request.key,
    locale: served.locale,
  });
  const asked = [request.locale, languageOf(request.locale)];
  return {
    text: rendered.text,
    template: served.template,
    found: true,
    locale: served.locale,
    usedFallback: findLocale(asked, served.locale) === undefined,
    missingParams: rendered.missingParams,
  };
}
