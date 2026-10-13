/** Where a key of a pass stands once acted on: saved or skipped. */
export type KeyStatus = 'done' | 'skipped'

/** What advancing the queue did: moved on, went back to skipped keys, stayed on the last key, or ran out of keys. */
export type QueueStep = 'moved' | 'wrapped' | 'last' | 'finished'

/**
 * One pass through the queue: the keys it holds, fixed when it starts (a
 * saved key stays in it, so Previous goes back to it), each one done, skipped
 * or still to do, the key shown and the keys shown before it.
 */
export interface QueuePass {
  order: string[]
  status: Record<string, KeyStatus>
  cursor: number
  history: number[]
  isFinished: boolean
}

/** A pass after a move, and what the move did. */
export interface QueueMove {
  pass: QueuePass
  step: QueueStep
}

/** A pass after a change, and what it did when the change moved the queue. */
export interface QueueChange {
  pass: QueuePass
  step?: QueueStep
}

/** Whether a key still has something to do in its own right: it fits the mode or holds a draft. */
export type KeyIsOpen = (key: string) => boolean

/** A pass with no key. */
export const EMPTY_PASS: QueuePass = {
  order: [],
  status: {},
  cursor: 0,
  history: [],
  isFinished: false,
}

/** Whether a key of the pass is still to do: open, and not saved in this pass. */
export function isPendingKey(
  pass: QueuePass,
  key: string | undefined,
  isOpen: KeyIsOpen,
): boolean {
  if (key === undefined || pass.status[key] === 'done') return false
  return isOpen(key)
}

/** The keys still to do, in the order of the pass. */
export function pendingKeys(pass: QueuePass, isOpen: KeyIsOpen): string[] {
  return pass.order.filter((key) => isPendingKey(pass, key, isOpen))
}

/** The key shown; none once the pass is finished. */
export function currentKey(pass: QueuePass): string | undefined {
  return pass.isFinished ? undefined : pass.order[pass.cursor]
}

/** Starts a pass over `order`, on `key` when it is in it, else on its first key. */
export function startPass(
  order: string[],
  key: string,
  isOpen: KeyIsOpen,
): QueuePass {
  const pass = { ...EMPTY_PASS, order, cursor: Math.max(order.indexOf(key), 0) }
  return { ...pass, isFinished: pendingKeys(pass, isOpen).length === 0 }
}

/** The positions of the keys still to do after `from`, going round to the start. */
export function pendingAfter(
  pass: QueuePass,
  from: number,
  isOpen: KeyIsOpen,
): number[] {
  const size = pass.order.length
  return Array.from(
    { length: Math.max(size - 1, 0) },
    (_, step) => (from + step + 1) % size,
  ).filter((index) => isPendingKey(pass, pass.order[index], isOpen))
}

/** Shows the key at `index`, remembering the one shown for Previous. */
export function goToIndex(pass: QueuePass, index: number): QueuePass {
  const history = pass.isFinished
    ? pass.history
    : [...pass.history, pass.cursor]
  return { ...pass, history, cursor: index, isFinished: false }
}

/**
 * Moves to the next key still to do, going round to the skipped ones; stays
 * when the key shown is the last one to do, and finishes when none is left.
 */
export function advancePass(pass: QueuePass, isOpen: KeyIsOpen): QueueMove {
  const [next] = pendingAfter(pass, pass.cursor, isOpen)
  if (next !== undefined) {
    const step = next < pass.cursor ? 'wrapped' : 'moved'
    return { pass: goToIndex(pass, next), step }
  }
  if (isPendingKey(pass, pass.order[pass.cursor], isOpen))
    return { pass, step: 'last' }
  const history = [...pass.history, pass.cursor]
  return { pass: { ...pass, history, isFinished: true }, step: 'finished' }
}

function marked(pass: QueuePass, key: string, status: KeyStatus): QueuePass {
  return { ...pass, status: { ...pass.status, [key]: status } }
}

/** Skips the key shown (it comes back once the others are done) and moves on. */
export function skipCurrent(pass: QueuePass, isOpen: KeyIsOpen): QueueMove {
  const key = currentKey(pass)
  const isSkippable = key !== undefined && isPendingKey(pass, key, isOpen)
  return advancePass(isSkippable ? marked(pass, key, 'skipped') : pass, isOpen)
}

/** Marks a key saved; moves on when it is the one shown and `shouldAdvance`. */
export function completeKey(
  pass: QueuePass,
  key: string,
  shouldAdvance: boolean,
  isOpen: KeyIsOpen,
): QueueChange {
  const done = marked(pass, key, 'done')
  if (shouldAdvance && currentKey(pass) === key)
    return advancePass(done, isOpen)
  return { pass: done }
}

/** Goes back to the key shown before; the same pass when there is none. */
export function previousKey(pass: QueuePass): QueuePass {
  const index = pass.history.at(-1)
  if (index === undefined) return pass
  return {
    ...pass,
    history: pass.history.slice(0, -1),
    cursor: index,
    isFinished: false,
  }
}
