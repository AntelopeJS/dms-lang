/** What the translation queue card shows. */
export type QueueView = 'loading' | 'unknown' | 'base' | 'queue'

/** What the queue card is chosen from. */
export interface QueueViewFacts {
  /** The workspace and its translations are both in. */
  isResolved: boolean
  /** The language asked for is one of the workspace. */
  exists: boolean
  isBase: boolean
}

/**
 * The state the queue card shows. It waits for the workspace as well as its
 * translations: until the workspace list is in, nothing says whether its
 * texts can be edited, and an editor shown meanwhile would start read-only.
 */
export function queueViewOf(facts: QueueViewFacts): QueueView {
  if (!facts.isResolved) return 'loading'
  if (!facts.exists) return 'unknown'
  return facts.isBase ? 'base' : 'queue'
}
