import type { TranslationValue } from '../types/lang'

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

interface KeySaveError {
  data?: KeySaveErrorBody | string | null
}

/** Translates an i18n key with its parameters, as `t` does. */
export type ApiMessageTranslate = (
  key: string,
  params: Record<string, unknown>,
) => string

const FAILURE_KINDS: Record<string, KeySaveFailureKind> = {
  conflict: 'conflict',
  key_not_found: 'deleted',
  invalid_message: 'invalid',
}

function bodyOf(error: unknown): KeySaveErrorBody {
  const data = (error as KeySaveError | undefined)?.data
  return typeof data === 'object' && data !== null ? data : {}
}

function kindOf(code: string): KeySaveFailureKind {
  return Object.hasOwn(FAILURE_KINDS, code) ? FAILURE_KINDS[code] : 'other'
}

/**
 * Reads a refused key write: the one place the module reads the server's
 * error body for a key. Its details (`$dms_lang.errors.message_syntax.*`
 * keys) come back translated.
 */
export function keySaveFailure(
  error: unknown,
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
