import { useActiveElement } from '@vueuse/core'
import { QUEUE_KEYS, shortcutName } from '../../utils/shortcuts'
import { isTypingTarget } from './useCellMoves'

/** What the queue's keys do. */
export interface QueueShortcutActions {
  /** Whether a key is shown: without one, no key is bound. */
  isActive: () => boolean
  saveNext: () => void
  save: () => void
  skip: () => void
  previous: () => void
}

/** The elements the keys depend on: the queue card and its text field. */
export interface QueueShortcutTargets {
  root: () => HTMLElement | null | undefined
  field: () => HTMLElement | null | undefined
}

interface ShortcutBinding {
  usingInput?: boolean
  handler: () => void
}

type ShortcutBindings = Record<string, ShortcutBinding>

const IN_FIELD = true

/** Whether the focus sits where the queue must not take keys: a dialog, a menu, another field. */
function isFocusElsewhere(
  active: Element | null | undefined,
  targets: QueueShortcutTargets,
): boolean {
  if (isFocusInsideOverlay(active)) return true
  return isTypingTarget(active ?? null) && !targets.root()?.contains(active!)
}

function savingBindings(actions: QueueShortcutActions): ShortcutBindings {
  return {
    [shortcutName(QUEUE_KEYS.saveNext)]: {
      usingInput: IN_FIELD,
      handler: actions.saveNext,
    },
    [shortcutName(QUEUE_KEYS.save)]: {
      usingInput: IN_FIELD,
      handler: actions.save,
    },
  }
}

function movingBindings(
  actions: QueueShortcutActions,
  browse: (action: () => void) => () => void,
): ShortcutBindings {
  return {
    [shortcutName(QUEUE_KEYS.skip)]: { handler: browse(actions.skip) },
    [shortcutName(QUEUE_KEYS.previous)]: { handler: browse(actions.previous) },
  }
}

function leavingBindings(field: HTMLElement): ShortcutBindings {
  return {
    [shortcutName(QUEUE_KEYS.leaveField)]: {
      usingInput: IN_FIELD,
      handler: () => field.blur(),
    },
  }
}

/**
 * The keys of the translation queue, bound with `defineShortcuts` and listed
 * in the DMS shortcuts registry: ⌘/Ctrl Enter saves and moves on, ⌘/Ctrl S
 * saves, Escape leaves the text field, then S skips and P goes back. Typing
 * never loses a key: S and P only act outside a text field, and nothing is
 * bound while the focus is in a dialog, a menu or a field of another part of
 * the page. A key reached with S or P leaves the focus where it was, so
 * S and P can go on: `isBrowsing` says so while the queue moves.
 */
export function useQueueShortcuts(
  actions: QueueShortcutActions,
  targets: QueueShortcutTargets,
) {
  const active = useActiveElement()
  let isBrowsing = false
  const browse = (action: () => void) => () => {
    isBrowsing = true
    action()
    void nextTick(() => {
      isBrowsing = false
    })
  }
  const bindings = computed<ShortcutBindings>(() => {
    if (!actions.isActive() || isFocusElsewhere(active.value, targets))
      return {}
    const field = targets.field()
    const isInField = !!field && active.value === field
    return {
      ...savingBindings(actions),
      ...movingBindings(actions, browse),
      ...(isInField ? leavingBindings(field) : {}),
    }
  })
  defineShortcuts(bindings)
  return { isBrowsing: () => isBrowsing }
}
