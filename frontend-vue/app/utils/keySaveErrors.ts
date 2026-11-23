import type { TranslationValue } from '../types/lang'
import { serverErrorCode } from '../composables/translation/useMutationToast.ts'

/** Why a key write was refused: changed elsewhere, deleted, a message that does not compile, or anything else. */
export type KeySaveFailureKind = 'conflict' | 'deleted' | 'invalid' | 'other'

export interface KeySaveFailure {
  kind: KeySaveFailureKind
  /** On a conflict, each language's text as the server now stores it. */
  current: Record<string, TranslationValue>
  /** On a refused message, one sentence per problem. */
  details: string[]
}

interface KeySaveErrorBody {
  current?: Record<string, TranslationValue>
  details?: string[]
}

/** A failed request as the server answers it: its body, when it has one. */
export interface KeySaveError {
  data?: object | string | null
}

/** Whether a failure carries a body the server may have answered. */
export function isKeySaveError(error: unknown): error is KeySaveError {
  if (typeof error !== 'object' || error === null) return false
  if (!('data' in error)) return true
  const { data } = error
  return (
    data === undefined ||
    data === null ||
    typeof data === 'string' ||
    typeof data === 'object'
  )
}

function isText(value: unknown): value is string {
  return typeof value === 'string'
}

function isTranslationValue(value: unknown): value is TranslationValue {
  return (
    value === null ||
    value === undefined ||
    isText(value) ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  )
}

function isTranslationRecord(
  value: unknown,
): value is Record<string, TranslationValue> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.values(value).every(isTranslationValue)
  )
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isText)
}

function isBodyObject(value: KeySaveError['data']): value is object {
  return typeof value === 'object' && value !== null
}

/** Translates an i18n key with its parameters, as `t` does. */
export type ApiMessageTranslate = Parameters<typeof resolveApiMessage>[0]

const FAILURE_KINDS = new Map<string, KeySaveFailureKind>([
  ['conflict', 'conflict'],
  ['key_not_found', 'deleted'],
  ['invalid_message', 'invalid'],
])

function bodyOf(error: KeySaveError | undefined): KeySaveErrorBody {
  const data = error?.data
  const body: KeySaveErrorBody = {}
  if (!isBodyObject(data)) return body
  if ('current' in data && isTranslationRecord(data.current))
    body.current = data.current
  if ('details' in data && isStringList(data.details))
    body.details = data.details
  return body
}

function kindOf(code: string): KeySaveFailureKind {
  return FAILURE_KINDS.get(code) ?? 'other'
}

/**
 * Reads a refused key write: the one place the module reads the server's
 * error body for a key. Its details (`$dms_lang.errors.message_syntax.*`
 * keys) come back translated.
 */
export function keySaveFailure(
  error: KeySaveError | undefined,
  translate: ApiMessageTranslate,
): KeySaveFailure {
  const body = bodyOf(error)
  return {
    kind: kindOf(serverErrorCode(error)),
    current: body.current ?? {},
    details: (body.details ?? []).map((detail) =>
      resolveApiMessage(translate, detail),
    ),
  }
}
