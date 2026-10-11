import type { TranslationValue } from '../types/lang'

/** The text a save expects to replace (`null`: no text); `undefined` sends no check. */
export type ExpectedText = string | null | undefined

/** Where a text being saved stands, as `DmsSaveStatus` shows it. */
export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** What a write left behind for the next write of the same text. */
export interface WriteLink {
  /** The text it sent (`null`: no text). */
  sent: string | null
  /** The text it expected to replace. */
  expected: ExpectedText
  /** Whether the server stored it. */
  isLanded: boolean
}

const SAVE_ID_SEPARATOR = '\u0000'

/** One language of one key of one workspace: a text saved on its own. */
export function saveIdOf(workspace: string, key: string, code: string): string {
  return [workspace, key, code].join(SAVE_ID_SEPARATOR)
}

/** The prefix every save id of a key starts with. */
export function saveIdPrefix(workspace: string, key: string): string {
  return saveIdOf(workspace, key, '')
}

/** A stored value as the server compares it: a text, else no text (`null`). */
export function savedText(value: TranslationValue): string | null {
  return typeof value === 'string' && !isLocaleValueMissing(value)
    ? value
    : null
}

/** What a typed text stores: a text made of spaces only is no text. */
export function storedText(text: string): string | null {
  return text.trim() === '' ? null : text
}

/**
 * What a write expects once the write before it did not land: a text the
 * server never stored cannot be expected, the one that write expected can.
 */
export function carriedExpected(
  expected: ExpectedText,
  previous: WriteLink | undefined,
): ExpectedText {
  if (!previous || previous.isLanded || expected !== previous.sent)
    return expected
  return previous.expected
}

/** A text queued behind the earlier writes of the same text. */
export interface QueuedText {
  id: string
  text: string
  expected: ExpectedText
}

interface SentTexts<T> {
  outcome: T
  expected: ExpectedText[]
}

/**
 * Runs a write once every earlier write of its texts settled, each text
 * expecting what the write before it carried over (`carriedExpected`), and
 * leaves the link the next write of each text starts from.
 */
export function queueTexts<T>(
  links: Map<string, Promise<WriteLink>>,
  texts: QueuedText[],
  send: (expected: ExpectedText[]) => Promise<T>,
  isLanded: (outcome: T) => boolean,
): Promise<T> {
  const run = Promise.all(texts.map((entry) => links.get(entry.id))).then(
    async (earlier): Promise<SentTexts<T>> => {
      const expected = texts.map((entry, index) =>
        carriedExpected(entry.expected, earlier[index]),
      )
      return { expected, outcome: await send(expected) }
    },
  )
  texts.forEach((entry, index) =>
    links.set(
      entry.id,
      run.then((sent) => ({
        sent: storedText(entry.text),
        expected: sent.expected[index],
        isLanded: isLanded(sent.outcome),
      })),
    ),
  )
  return run.then((sent) => sent.outcome)
}

/** A record with one entry set, or removed when `value` is `undefined`. */
export function withEntry<T>(
  record: Record<string, T>,
  id: string,
  value: T | undefined,
): Record<string, T> {
  const { [id]: _previous, ...rest } = record
  return value === undefined ? rest : { ...rest, [id]: value }
}
