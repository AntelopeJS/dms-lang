import { baseCompile, CompileErrorCodes } from '@intlify/message-compiler'
import type {
  FlatTranslationRow,
  FlatTranslations,
  LanguageCoverage,
  NamespaceCoverage,
} from '../types/lang'

export type MessagePartKind =
  'text' | 'placeholder' | 'literal' | 'linked' | 'pipe'

/** A piece of a vue-i18n message; `name` is the variable, literal text or linked key. */
export interface MessagePart {
  kind: MessagePartKind
  raw: string
  name: string
  start: number
}

export type MessageSyntaxKind =
  | 'bareAt'
  | 'unclosedBrace'
  | 'strayBrace'
  | 'emptyPlaceholder'
  | 'invalidPlaceholder'
  | 'unclosedLiteral'
  | 'invalidEscape'
  | 'emptyPlural'
  | 'invalidSyntax'

export type MessageIssueKind =
  MessageSyntaxKind | 'missing' | 'extra' | 'plural' | 'spaces'

/** `error`: vue-i18n cannot compile the message; `warning`: it shows, but wrong. */
export type MessageIssueSeverity = 'error' | 'warning'

interface MessageSyntaxError {
  kind: MessageSyntaxKind
  raw: string
  start: number
}

export interface MessageScan {
  parts: MessagePart[]
  errors: MessageSyntaxError[]
}

interface ScanStep {
  part?: MessagePart
  error?: MessageSyntaxError
  end: number
}

/**
 * One problem of a message. `tokens` holds variable names (`missing`,
 * `extra`) or the offending characters (syntax); `count` the number of them,
 * or of plural forms for `plural`, whose base has `expected` forms.
 */
export interface MessageIssue {
  kind: MessageIssueKind
  severity: MessageIssueSeverity
  tokens: string[]
  count: number
  expected?: number
  index: number
}

export type KeyPathConflictKind = 'exists' | 'namespace' | 'leafParent'

export interface KeyPathConflict {
  kind: KeyPathConflictKind
  keys: string[]
}

/** The `t` of vue-i18n: key, named values and the count that picks the plural. */
export type MessageTranslate = (
  key: string,
  named: Record<string, unknown>,
  plural: number,
) => string

const FULL_COVERAGE = 100
export const NAMESPACE_SEPARATOR = '.'
const OPEN_BRACE = '{'
const CLOSE_BRACE = '}'
const QUOTE = "'"
const LINKED_MARK = '@'
export const PLURAL_SEPARATOR = '|'
/** What the scanner reads as a variable, to highlight and rename it. */
const PLACEHOLDER_NAME = /^(?:[A-Za-z_][\w$-]*|\d+)$/
const LITERAL_PATTERN = /\s*'((?:[^'\\\n]|\\.)*)'\s*\}/y
const LITERAL_ESCAPE = /\\u([0-9a-fA-F]{4})|\\(.)/g
const LINKED_PATTERN = /@(?:\.[A-Za-z]+)?:(?:\(([^()\s]+)\)|([\w.$-]+)|(?=\{))/y
const IMPLICIT_PLURAL_NAMES = ['count', 'n']
const LEADING_SPACE = /^\s/
const TRAILING_SPACE = /\s$/
const KEY_PATH_PATTERN = /^[\w-]+(\.[\w-]+)*$/
const MAX_KEY_SEGMENT_LENGTH = 128
const FORBIDDEN_KEY_SEGMENTS = new Set([
  '__proto__',
  'prototype',
  'constructor',
])

/** The i18n key of the sentence that explains each kind of issue. */
export const MESSAGE_ISSUE_LABELS: Record<MessageIssueKind, string> = {
  missing: 'dms_lang.message_issue.missing',
  extra: 'dms_lang.message_issue.extra',
  plural: 'dms_lang.message_issue.plural',
  spaces: 'dms_lang.message_issue.spaces',
  bareAt: 'dms_lang.message_issue.bare_at',
  unclosedBrace: 'dms_lang.message_issue.unclosed_brace',
  strayBrace: 'dms_lang.message_issue.stray_brace',
  emptyPlaceholder: 'dms_lang.message_issue.empty_placeholder',
  invalidPlaceholder: 'dms_lang.message_issue.invalid_placeholder',
  unclosedLiteral: 'dms_lang.message_issue.unclosed_literal',
  invalidEscape: 'dms_lang.message_issue.invalid_escape',
  emptyPlural: 'dms_lang.message_issue.empty_plural',
  invalidSyntax: 'dms_lang.message_issue.invalid_syntax',
}

const SYNTAX_ESCAPES: Partial<Record<MessageIssueKind, string>> = {
  bareAt: "{'@'}",
  unclosedBrace: "{'{'}",
  strayBrace: "{'}'}",
}

export const HIGH_COVERAGE = 90
export const MID_COVERAGE = 60

export const EMPTY_FLAT: FlatTranslations = {
  defaultLocale: '',
  locales: [],
  rows: [],
  localeProgress: {},
  localeMissing: {},
  totalKeys: 0,
  baseMissing: 0,
  incompleteKeys: 0,
}

/** No value, or a text made of spaces only: the server stores neither. */
export function isLocaleValueMissing(value: unknown): boolean {
  if (typeof value === 'string') return value.trim() === ''
  return value === undefined || value === null
}

/**
 * Whether a key has no text in a language, counting the value an installed
 * module gives it in the project files: that one shows on screen too.
 */
export function isRowValueMissing(
  row: FlatTranslationRow,
  locale: string,
): boolean {
  return (
    isLocaleValueMissing(row.values[locale]) &&
    isLocaleValueMissing(row.inherited?.[locale])
  )
}

export function stringValue(value: unknown): string {
  return value === undefined || value === null ? '' : String(value)
}

export function namespaceOf(key: string): string {
  const index = key.indexOf(NAMESPACE_SEPARATOR)
  return index < 0 ? key : key.slice(0, index)
}

function textPart(raw: string, start: number): MessagePart {
  return { kind: 'text', raw, name: raw, start }
}

function syntaxStep(
  kind: MessageSyntaxKind,
  raw: string,
  start: number,
  end = start + raw.length,
): ScanStep {
  return {
    part: textPart(raw, start),
    error: { kind, raw, start },
    end,
  }
}

function unescapeLiteral(content: string): string {
  return content.replace(
    LITERAL_ESCAPE,
    (_match, code?: string, char?: string) =>
      code ? String.fromCharCode(Number.parseInt(code, 16)) : (char ?? ''),
  )
}

function readLiteral(text: string, start: number): ScanStep {
  LITERAL_PATTERN.lastIndex = start + 1
  const match = LITERAL_PATTERN.exec(text)
  if (!match) {
    const close = text.indexOf(CLOSE_BRACE, start)
    const raw = text.slice(start, close < 0 ? text.length : close + 1)
    return syntaxStep('unclosedLiteral', raw, start)
  }
  const end = LITERAL_PATTERN.lastIndex
  const raw = text.slice(start, end)
  return {
    part: { kind: 'literal', raw, name: unescapeLiteral(match[1]), start },
    end,
  }
}

function readPlaceholder(text: string, start: number): ScanStep {
  const close = text.indexOf(CLOSE_BRACE, start + 1)
  const reopen = text.indexOf(OPEN_BRACE, start + 1)
  if (close < 0 || (reopen >= 0 && reopen < close))
    return syntaxStep('unclosedBrace', OPEN_BRACE, start)
  const raw = text.slice(start, close + 1)
  const name = raw.slice(1, -1).trim()
  if (!name) return syntaxStep('emptyPlaceholder', raw, start)
  if (!PLACEHOLDER_NAME.test(name))
    return syntaxStep('invalidPlaceholder', raw, start)
  return { part: { kind: 'placeholder', raw, name, start }, end: close + 1 }
}

function readBrace(text: string, start: number): ScanStep {
  const isLiteral = text
    .slice(start + 1)
    .trimStart()
    .startsWith(QUOTE)
  return isLiteral ? readLiteral(text, start) : readPlaceholder(text, start)
}

function readLinked(text: string, start: number): ScanStep {
  LINKED_PATTERN.lastIndex = start
  const match = LINKED_PATTERN.exec(text)
  if (!match) return syntaxStep('bareAt', LINKED_MARK, start)
  const raw = match[0]
  return {
    part: { kind: 'linked', raw, name: match[1] ?? match[2] ?? '', start },
    end: start + raw.length,
  }
}

function readPipe(_text: string, start: number): ScanStep {
  return {
    part: { kind: 'pipe', raw: PLURAL_SEPARATOR, name: '', start },
    end: start + 1,
  }
}

function readStrayBrace(_text: string, start: number): ScanStep {
  return syntaxStep('strayBrace', CLOSE_BRACE, start)
}

const SPECIAL_READERS: Record<
  string,
  (text: string, start: number) => ScanStep
> = {
  [OPEN_BRACE]: readBrace,
  [CLOSE_BRACE]: readStrayBrace,
  [LINKED_MARK]: readLinked,
  [PLURAL_SEPARATOR]: readPipe,
}

/**
 * Splits a message written in the vue-i18n syntax into text, `{name}`
 * variables, `{'@'}` literals, `@:key` links and `|` plural separators, and
 * marks the bare characters {@link escapeMessage} writes as literals. Joining
 * the parts' `raw` gives the text back. Whether a message compiles is the
 * vue-i18n compiler's call (see {@link checkMessage}).
 */
export function scanMessage(message: unknown): MessageScan {
  const text = stringValue(message)
  const scan: MessageScan = { parts: [], errors: [] }
  let textStart = 0
  let index = 0
  while (index < text.length) {
    const reader = SPECIAL_READERS[text[index]]
    if (!reader) {
      index += 1
      continue
    }
    if (index > textStart)
      scan.parts.push(textPart(text.slice(textStart, index), textStart))
    const step = reader(text, index)
    if (step.part) scan.parts.push(step.part)
    if (step.error) scan.errors.push(step.error)
    index = step.end
    textStart = index
  }
  if (text.length > textStart)
    scan.parts.push(textPart(text.slice(textStart), textStart))
  return scan
}

function namesOf(scan: MessageScan): string[] {
  const names = scan.parts
    .filter((part) => part.kind === 'placeholder')
    .map((part) => part.name)
  return [...new Set(names)]
}

function formCount(scan: MessageScan): number {
  return scan.parts.filter((part) => part.kind === 'pipe').length + 1
}

/** The rule the server applies to a new key path: `checkout.coupon.invalid`. */
export function isValidKeyPath(path: string): boolean {
  if (!KEY_PATH_PATTERN.test(path)) return false
  return path
    .split(NAMESPACE_SEPARATOR)
    .every(
      (segment) =>
        segment.length <= MAX_KEY_SEGMENT_LENGTH &&
        !FORBIDDEN_KEY_SEGMENTS.has(segment),
    )
}

function parentPaths(path: string): string[] {
  const segments = path.split(NAMESPACE_SEPARATOR)
  return segments
    .slice(1)
    .map((_segment, index) =>
      segments.slice(0, index + 1).join(NAMESPACE_SEPARATOR),
    )
}

/**
 * Why a new key path cannot be written next to existing keys: it is one of
 * them (`exists`), it holds some of them (`namespace`, a key cannot also be a
 * namespace) or one of its parents is a key (`leafParent`). `keys` lists the
 * keys in the way.
 */
export function keyPathConflict(
  path: string,
  existingKeys: string[],
): KeyPathConflict | null {
  if (existingKeys.includes(path)) return { kind: 'exists', keys: [path] }
  const children = existingKeys.filter((key) =>
    key.startsWith(`${path}${NAMESPACE_SEPARATOR}`),
  )
  if (children.length) return { kind: 'namespace', keys: children }
  const parents = new Set(parentPaths(path))
  const leaves = existingKeys.filter((key) => parents.has(key))
  if (leaves.length) return { kind: 'leafParent', keys: leaves }
  return null
}

/**
 * The path of what follows a key in its namespace, in the order of the keys:
 * `cart.badge` after `cart.title`, `cart.items` before `cart.items.one`.
 * Undefined when the key comes last: a key put back there is appended.
 */
export function nextSiblingPath(
  keys: string[],
  path: string,
): string | undefined {
  const next = keys[keys.indexOf(path) + 1]
  if (!next || !keys.includes(path)) return undefined
  const segments = path.split(NAMESPACE_SEPARATOR)
  const parent = segments.slice(0, -1)
  const nextSegments = next.split(NAMESPACE_SEPARATOR)
  const isSibling =
    nextSegments.length >= segments.length &&
    parent.every((segment, index) => nextSegments[index] === segment)
  if (!isSibling) return undefined
  return nextSegments.slice(0, segments.length).join(NAMESPACE_SEPARATOR)
}

export function placeholdersOf(text: unknown): string[] {
  return namesOf(scanMessage(text))
}

type CompileErrorName = keyof typeof CompileErrorCodes

/** What each error of the vue-i18n compiler means to a translator; any other is `invalidSyntax`. */
const COMPILE_ERROR_KINDS: Partial<
  Record<CompileErrorName, MessageSyntaxKind>
> = {
  INVALID_TOKEN_IN_PLACEHOLDER: 'invalidPlaceholder',
  UNTERMINATED_SINGLE_QUOTE_IN_PLACEHOLDER: 'unclosedLiteral',
  UNKNOWN_ESCAPE_SEQUENCE: 'invalidEscape',
  INVALID_UNICODE_ESCAPE_SEQUENCE: 'invalidEscape',
  UNBALANCED_CLOSING_BRACE: 'strayBrace',
  UNTERMINATED_CLOSING_BRACE: 'unclosedBrace',
  NOT_ALLOW_NEST_PLACEHOLDER: 'unclosedBrace',
  EMPTY_PLACEHOLDER: 'emptyPlaceholder',
  INVALID_LINKED_FORMAT: 'bareAt',
  UNEXPECTED_EMPTY_LINKED_KEY: 'bareAt',
  UNEXPECTED_EMPTY_LINKED_MODIFIER: 'bareAt',
  MUST_HAVE_MESSAGES_IN_PLURAL: 'emptyPlural',
}

const COMPILE_ERROR_NAMES = new Map<number, CompileErrorName>(
  Object.entries(CompileErrorCodes).map(([name, code]) => [
    code,
    name as CompileErrorName,
  ]),
)

const FIXED_TOKENS: Partial<Record<MessageSyntaxKind, string>> = {
  bareAt: LINKED_MARK,
  unclosedBrace: OPEN_BRACE,
  strayBrace: CLOSE_BRACE,
  emptyPlural: PLURAL_SEPARATOR,
}

interface CompileIssue {
  kind: MessageSyntaxKind
  offset: number
}

function compileErrors(text: string): CompileIssue[] {
  const errors: CompileIssue[] = []
  baseCompile(text, {
    onError: (error) => {
      const name = COMPILE_ERROR_NAMES.get(error.code)
      errors.push({
        kind: (name && COMPILE_ERROR_KINDS[name]) || 'invalidSyntax',
        offset: error.location?.start.offset ?? 0,
      })
    },
  })
  return errors
}

/** The `{…}` around an offset, up to its `}` (or the end of the text). */
function placeholderAt(text: string, offset: number): string {
  const start = Math.max(text.lastIndexOf(OPEN_BRACE, offset), 0)
  const close = text.indexOf(CLOSE_BRACE, offset)
  return text.slice(start, close < 0 ? text.length : close + 1)
}

/** The `}` closing the placeholder an unclosed brace opens, when one does before the next `{`. */
function closingBraceOf(text: string, offset: number): number {
  const close = text.indexOf(CLOSE_BRACE, offset)
  const reopen = text.indexOf(OPEN_BRACE, offset)
  return reopen >= 0 && reopen < close ? -1 : close
}

/**
 * vue-i18n reads `{a b}` as a brace never closed then a stray one: to a
 * translator it is one variable whose name is not valid.
 */
function mergeBrokenPlaceholders(
  text: string,
  errors: CompileIssue[],
): CompileIssue[] {
  const closings = new Set<number>()
  const merged = errors.map((error) => {
    if (error.kind !== 'unclosedBrace') return error
    const close = closingBraceOf(text, error.offset)
    if (close < 0) return error
    closings.add(close)
    return { ...error, kind: 'invalidPlaceholder' as const }
  })
  return merged.filter(
    (error) => error.kind !== 'strayBrace' || !closings.has(error.offset),
  )
}

const PLACEHOLDER_KINDS = new Set<MessageSyntaxKind>([
  'invalidPlaceholder',
  'emptyPlaceholder',
  'unclosedLiteral',
  'invalidEscape',
])

function tokenOf(text: string, issue: CompileIssue): string {
  const fixed = FIXED_TOKENS[issue.kind]
  if (fixed) return fixed
  return PLACEHOLDER_KINDS.has(issue.kind)
    ? placeholderAt(text, issue.offset)
    : text.charAt(issue.offset)
}

/** A generic compile error only counts when nothing more precise explains the text. */
function withoutGeneric(errors: CompileIssue[]): CompileIssue[] {
  const precise = errors.filter((error) => error.kind !== 'invalidSyntax')
  return precise.length ? precise : errors
}

/** The errors the vue-i18n compiler finds in a message, one issue per kind. */
function syntaxIssues(text: string): MessageIssue[] {
  const errors = withoutGeneric(
    mergeBrokenPlaceholders(text, compileErrors(text)),
  ).sort((a, b) => a.offset - b.offset)
  const byKind = new Map<MessageSyntaxKind, CompileIssue[]>()
  for (const error of errors)
    byKind.set(error.kind, [...(byKind.get(error.kind) ?? []), error])
  return [...byKind].map(([kind, found]) => ({
    kind,
    severity: 'error',
    tokens: [...new Set(found.map((error) => tokenOf(text, error)))],
    count: found.length,
    index: found[0].offset,
  }))
}

function tokenIssue(kind: MessageIssueKind, tokens: string[]): MessageIssue[] {
  if (!tokens.length) return []
  return [
    { kind, severity: 'warning', tokens, count: tokens.length, index: -1 },
  ]
}

function pluralIssue(base: MessageScan, value: MessageScan): MessageIssue[] {
  const expected = formCount(base)
  const actual = formCount(value)
  if (expected === actual) return []
  return [
    {
      kind: 'plural',
      severity: 'warning',
      tokens: [],
      count: actual,
      expected,
      index: -1,
    },
  ]
}

function edgeSpaces(text: string): [boolean, boolean] {
  return [LEADING_SPACE.test(text), TRAILING_SPACE.test(text)]
}

/**
 * Spaces or line breaks at the start or the end of a text the base does not
 * have there (any of them when there is no base): they show in the app.
 */
function spacesIssue(base: unknown, value: unknown): MessageIssue[] {
  const [leading, trailing] = edgeSpaces(stringValue(value))
  const [baseLeading, baseTrailing] = edgeSpaces(stringValue(base))
  const count =
    Number(leading && !baseLeading) + Number(trailing && !baseTrailing)
  if (!count) return []
  return [{ kind: 'spaces', severity: 'warning', tokens: [], count, index: -1 }]
}

function comparisonIssues(
  base: MessageScan,
  value: MessageScan,
): MessageIssue[] {
  const baseNames = namesOf(base)
  const valueNames = namesOf(value)
  const implicit = formCount(value) > 1 ? IMPLICIT_PLURAL_NAMES : []
  const known = new Set([...baseNames, ...implicit])
  return [
    ...tokenIssue(
      'missing',
      baseNames.filter((name) => !valueNames.includes(name)),
    ),
    ...tokenIssue(
      'extra',
      valueNames.filter((name) => !known.has(name)),
    ),
    ...pluralIssue(base, value),
  ]
}

/**
 * What is wrong with a translation, read as a vue-i18n message: syntax that
 * does not compile (a bare `@`, an unclosed brace…), base variables it leaves
 * out, variables the base does not have, a different number of plural forms
 * and spaces at its ends the base does not have. Pass an empty base to check
 * the base text itself (syntax and spaces at its ends only). An empty value
 * has no issue: it is missing.
 */
export function checkMessage(base: unknown, value: unknown): MessageIssue[] {
  if (isLocaleValueMissing(value)) return []
  const scan = scanMessage(value)
  const issues = [
    ...syntaxIssues(stringValue(value)),
    ...spacesIssue(base, value),
  ]
  if (isLocaleValueMissing(base)) return issues
  return [...issues, ...comparisonIssues(scanMessage(base), scan)]
}

export function hasBlockingIssue(issues: MessageIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error')
}

/**
 * Whether the text of a language needs another look, as the server tells:
 * it has an issue (the rule of {@link checkMessage}), or it was translated
 * from an older base text. The rule of every "issues" count.
 */
export function needsReview(row: FlatTranslationRow, locale: string): boolean {
  return (
    (row.issues?.includes(locale) ?? false) ||
    (row.outdated?.includes(locale) ?? false)
  )
}

/** The sentence that explains an issue, in the interface language. */
export function messageIssueText(
  issue: MessageIssue,
  t: MessageTranslate,
): string {
  const isNamed = issue.kind === 'missing' || issue.kind === 'extra'
  return t(
    MESSAGE_ISSUE_LABELS[issue.kind],
    {
      tokens: isNamed ? formatTokens(issue.tokens) : issue.tokens.join(' '),
      count: issue.count,
      expected: issue.expected ?? 0,
      fix: SYNTAX_ESCAPES[issue.kind] ?? '',
    },
    issue.count,
  )
}

/** Writes bare `@` and lone braces as vue-i18n literals: `{'@'}`. */
export function escapeMessage(message: unknown): string {
  const scan = scanMessage(message)
  const errorKinds = new Map(
    scan.errors.map((error) => [error.start, error.kind]),
  )
  return scan.parts
    .map((part) => {
      const kind = part.kind === 'text' ? errorKinds.get(part.start) : undefined
      return (kind && SYNTAX_ESCAPES[kind]) || part.raw
    })
    .join('')
}

/** Renames a variable everywhere it appears in a message. */
export function replacePlaceholder(
  message: unknown,
  from: string,
  to: string,
): string {
  return scanMessage(message)
    .parts.map((part) =>
      part.kind === 'placeholder' && part.name === from ? `{${to}}` : part.raw,
    )
    .join('')
}

/**
 * The share of `total` that is translated, in whole percent rounded down, so
 * that one missing text keeps it under 100 (200 of 201 reads 99). Nothing to
 * translate reads 100. The rule the server rounds every coverage with.
 */
export function coveragePercent(translated: number, total: number): number {
  if (total <= 0) return FULL_COVERAGE
  return Math.floor((Math.max(translated, 0) * FULL_COVERAGE) / total)
}

export function coverageTone(
  coverage: number,
): 'success' | 'warning' | 'error' {
  if (coverage >= HIGH_COVERAGE) return 'success'
  if (coverage >= MID_COVERAGE) return 'warning'
  return 'error'
}

export function translatedCount(
  rows: FlatTranslationRow[],
  locale: string,
): number {
  return rows.filter((row) => !isRowValueMissing(row, locale)).length
}

/** The coverage of each language, from the figures the server keeps. */
export function languageCoverage(
  flat: FlatTranslations,
  nameOf: (code: string) => string,
): LanguageCoverage[] {
  return flat.locales.map((code) => {
    const missing = flat.localeMissing[code] ?? 0
    const translated = flat.totalKeys - missing
    return {
      code,
      name: nameOf(code),
      isBase: code === flat.defaultLocale,
      coverage: coveragePercent(translated, flat.totalKeys),
      translated,
      missing,
    }
  })
}

function groupByNamespace(
  rows: FlatTranslationRow[],
): Map<string, FlatTranslationRow[]> {
  const groups = new Map<string, FlatTranslationRow[]>()
  for (const row of rows) {
    const namespace = namespaceOf(row.key)
    const group = groups.get(namespace)
    if (group) group.push(row)
    else groups.set(namespace, [row])
  }
  return groups
}

export function namespaceCoverage(
  rows: FlatTranslationRow[],
  locales: string[],
): NamespaceCoverage[] {
  return [...groupByNamespace(rows)].map(([namespace, group]) => {
    const coverage: Record<string, number> = {}
    const missing: Record<string, number> = {}
    for (const locale of locales) {
      const translated = translatedCount(group, locale)
      coverage[locale] = coveragePercent(translated, group.length)
      missing[locale] = group.length - translated
    }
    return { namespace, keys: group.length, coverage, missing }
  })
}

/** Where a key put back before `before` (a sibling key or namespace) goes: the end when none is there. */
function insertionIndex(rows: FlatTranslationRow[], before?: string): number {
  if (before === undefined) return rows.length
  const index = rows.findIndex(
    (entry) =>
      entry.key === before ||
      entry.key.startsWith(`${before}${NAMESPACE_SEPARATOR}`),
  )
  return index < 0 ? rows.length : index
}

/**
 * The translations with one row put in place: replaced, added (before the
 * `before` sibling, else at the end), or taken out when there is none (the
 * key is gone). The other rows are kept as they are.
 */
export function withRow(
  flat: FlatTranslations,
  key: string,
  row: FlatTranslationRow | undefined,
  before?: string,
): FlatTranslations {
  const index = flat.rows.findIndex((entry) => entry.key === key)
  const rows = [...flat.rows]
  if (row && index >= 0) rows[index] = row
  else if (row) rows.splice(insertionIndex(rows, before), 0, row)
  else if (index >= 0) rows.splice(index, 1)
  return { ...flat, rows }
}

export const COVERAGE_TEXT_CLASSES: Record<
  'success' | 'warning' | 'error',
  string
> = {
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
}

/** Placeholder names written as they appear in a text: `{name} {count}`. */
export function formatTokens(names: string[]): string {
  return names.map((name) => `{${name}}`).join(' ')
}
