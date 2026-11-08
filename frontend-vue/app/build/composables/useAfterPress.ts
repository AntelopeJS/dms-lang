import { tryOnScopeDispose, useEventListener } from '@vueuse/core'

/** How long a touch or pen tap may take to make its click. */
const TAP_CLICK_TIMEOUT_MS = 1000

/**
 * Defers work to the click of the primary-button press in progress, so a save
 * started by the blur that press causes changes nothing on the page until
 * that click has landed. A touch tap blurs after its `pointerup`, so the
 * press lasts until the click, a `pointercancel`, the window's blur or, for
 * a tap that makes no click, {@link TAP_CLICK_TIMEOUT_MS}. Without such a
 * press, the work runs at once; work still waiting when the scope ends runs
 * then.
 */
export function useAfterPress(): (run: () => void) => void {
  let isPressed = false
  let waiting: (() => void)[] = []
  let tapTimer: ReturnType<typeof setTimeout> | undefined

  function flush() {
    const runs = waiting
    waiting = []
    for (const run of runs) run()
  }

  function release() {
    clearTimeout(tapTimer)
    isPressed = false
    if (waiting.length) setTimeout(flush)
  }

  function onPointerUp(event: PointerEvent) {
    if (!isPressed) return
    if (event.pointerType === 'mouse') release()
    else tapTimer = setTimeout(release, TAP_CLICK_TIMEOUT_MS)
  }

  const capture = { capture: true, passive: true }
  useEventListener(
    'pointerdown',
    (event) => {
      clearTimeout(tapTimer)
      isPressed = event.isPrimary && event.button === 0
    },
    capture,
  )
  useEventListener('pointerup', onPointerUp, capture)
  useEventListener(['click', 'pointercancel'], release, capture)
  useEventListener('blur', release)
  tryOnScopeDispose(() => {
    clearTimeout(tapTimer)
    flush()
  })

  return (run) => {
    if (isPressed) waiting.push(run)
    else run()
  }
}
