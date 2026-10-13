/** A text typed in the queue and not saved yet. */
export interface QueueDraft {
  value: string
  /**
   * The saved value it was started on (`null`: no text), sent as the value
   * expected by the server: a change made elsewhere meanwhile is a conflict.
   */
  start: string | null
}

/** The drafts of the queue, by draft id. */
export type QueueDrafts = Record<string, QueueDraft>

/** Where a draft was typed: a key of a language of a workspace. */
export interface DraftId {
  workspace: string
  locale: string
  key: string
}

/** A draft taken out, with where it was typed. */
export interface DraftEntry extends DraftId {
  value: string
}

/** Drafts of one workspace and language, for the links back to them. */
export interface DraftGroup {
  workspace: string
  locale: string
  count: number
}

/** Whether a draft must go: its key, language or workspace no longer exists. */
export type DraftCheck = (id: DraftId) => boolean

/** Drafts split between the ones kept and the ones taken out. */
export interface DraftSplit {
  kept: QueueDrafts
  taken: DraftEntry[]
}

/** A line break: neither a workspace id, a language code nor a key holds one. */
export const DRAFT_SEPARATOR = '\n'

export function draftIdOf(id: DraftId): string {
  return [id.workspace, id.locale, id.key].join(DRAFT_SEPARATOR)
}

export function parseDraftId(id: string): DraftId {
  const [workspace = '', locale = '', ...key] = id.split(DRAFT_SEPARATOR)
  return { workspace, locale, key: key.join(DRAFT_SEPARATOR) }
}

/** The drafts without one. */
export function withoutDraft(drafts: QueueDrafts, id: string): QueueDrafts {
  const { [id]: _dropped, ...rest } = drafts
  return rest
}

/** The drafts with one set; a text back to the one it started on is no draft. */
export function withDraft(
  drafts: QueueDrafts,
  id: string,
  draft: QueueDraft,
): QueueDrafts {
  const rest = withoutDraft(drafts, id)
  return draft.value === (draft.start ?? '') ? rest : { ...rest, [id]: draft }
}

/** A text sent for a draft: as it was typed, and as the server stores it. */
export interface SentDraft {
  typed: string
  stored: string | null
}

/**
 * The drafts once a draft was saved: gone when it is still the text typed
 * when it was sent, else kept (typed during the save) and started on the
 * text the server now stores.
 */
export function settledDrafts(
  drafts: QueueDrafts,
  id: string,
  sent: SentDraft,
): QueueDrafts {
  const draft = drafts[id]
  if (!draft || draft.value === sent.typed) return withoutDraft(drafts, id)
  return withDraft(drafts, id, { value: draft.value, start: sent.stored })
}

/** The drafts, grouped per workspace and language. */
export function draftGroups(drafts: QueueDrafts): DraftGroup[] {
  const found = new Map<string, DraftGroup>()
  for (const id of Object.keys(drafts)) {
    const { workspace, locale } = parseDraftId(id)
    const name = [workspace, locale].join(DRAFT_SEPARATOR)
    const group = found.get(name) ?? { workspace, locale, count: 0 }
    found.set(name, { ...group, count: group.count + 1 })
  }
  return [...found.values()]
}

/** Takes out the drafts `isGone` names. */
export function takeDrafts(
  drafts: QueueDrafts,
  isGone: DraftCheck,
): DraftSplit {
  const split: DraftSplit = { kept: {}, taken: [] }
  for (const [id, draft] of Object.entries(drafts)) {
    const parsed = parseDraftId(id)
    if (isGone(parsed)) split.taken.push({ ...parsed, value: draft.value })
    else split.kept[id] = draft
  }
  return split
}
