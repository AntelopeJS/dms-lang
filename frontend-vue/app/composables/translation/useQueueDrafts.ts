import { effectScope, type Ref } from 'vue'
import { useDmsState } from '#dms/frontend-module'
import type { TranslationValue } from '../../types/lang'
import { savedText } from '../../utils/keySaves'
import {
  draftGroups,
  draftIdOf,
  settledDrafts,
  takeDrafts,
  withDraft,
  withoutDraft,
  type DraftCheck,
  type DraftEntry,
  type DraftGroup,
  type QueueDraft,
  type QueueDrafts,
  type SentDraft,
} from '../../utils/queueDrafts'

const QUEUE_PAGE: LangPage = 'language'

let isClearedOnLeave = false

/**
 * Drops the drafts once the page shows anything else than the Language page
 * (the leave guard asked first). Watched once for the app, outside any page:
 * switching language or workspace remounts the page on the same path and
 * keeps them.
 */
function clearOnLeave(path: () => string, drafts: Ref<QueueDrafts>) {
  if (isClearedOnLeave || import.meta.env.SSR) return
  isClearedOnLeave = true
  effectScope(true).run(() =>
    watch(
      () => langPageOf(path()) === QUEUE_PAGE,
      (isOnPage) => {
        if (!isOnPage) drafts.value = {}
      },
    ),
  )
}

/** The drafts of every workspace and language, kept in the app state. */
function useDraftStore() {
  const { route } = useWorkspaceRoute()
  const drafts = useDmsState<QueueDrafts>('dms-lang-queue-drafts', () => ({}))
  clearOnLeave(() => route.path, drafts)
  return drafts
}

type DraftIdOf = (key: string) => string

/** The writes of the drafts of the language shown, each key's draft by `idOf`. */
function draftWrites(drafts: Ref<QueueDrafts>, idOf: DraftIdOf) {
  const draftOf = (key: string) => drafts.value[idOf(key)]
  const set = (key: string, draft: QueueDraft) => {
    drafts.value = withDraft(drafts.value, idOf(key), draft)
  }
  return {
    /** Keeps a typed text, started on `saved` unless it already was a draft. */
    write(key: string, value: string, saved: TranslationValue | undefined) {
      const draft = draftOf(key)
      set(key, { value, start: draft ? draft.start : savedText(saved) })
    },
    /** Keeps the text, now started on the value saved elsewhere (overwrite it). */
    rebase(key: string, saved: TranslationValue | undefined) {
      const draft = draftOf(key)
      if (draft) set(key, { ...draft, start: savedText(saved) })
    },
    /** Once `sent` is saved: drops the draft, or keeps what was typed meanwhile. */
    settle(key: string, sent: SentDraft) {
      drafts.value = settledDrafts(drafts.value, idOf(key), sent)
    },
    drop(key: string) {
      drafts.value = withoutDraft(drafts.value, idOf(key))
    },
    /** Takes out the drafts `isGone` names, and returns them. */
    take(isGone: DraftCheck): DraftEntry[] {
      const { kept, taken } = takeDrafts(drafts.value, isGone)
      if (taken.length) drafts.value = kept
      return taken
    },
  }
}

/**
 * The drafts of the queue, per workspace, language and key, kept in the app
 * state: switching language or workspace remounts the page, and the drafts
 * left there are still there on the way back. They only go once the page is
 * left (the leave guard asked first) or once saved or discarded.
 */
export function useQueueDrafts(locale: Ref<string>) {
  const { selectedWorkspace } = useI18nWorkspaces()
  const drafts = useDraftStore()
  const idOf = (key: string) =>
    draftIdOf({ workspace: selectedWorkspace.value, locale: locale.value, key })
  const draftOf = (key: string) => drafts.value[idOf(key)]
  const groups = computed(() => draftGroups(drafts.value))
  const isShown = (group: DraftGroup) =>
    group.workspace === selectedWorkspace.value && group.locale === locale.value
  return {
    ...draftWrites(drafts, idOf),
    /** Every draft, wherever it was typed: leaving the page loses them all. */
    count: computed(() => Object.keys(drafts.value).length),
    groups,
    /** The groups of the other workspaces and languages than the one shown. */
    elsewhere: computed(() => groups.value.filter((group) => !isShown(group))),
    has: (key: string) => draftOf(key) !== undefined,
    read: (key: string): string | undefined => draftOf(key)?.value,
    /** The saved value a draft was started on; `undefined` without a draft. */
    startOf: (key: string): string | null | undefined => draftOf(key)?.start,
  }
}

export type QueueDraftStore = ReturnType<typeof useQueueDrafts>
