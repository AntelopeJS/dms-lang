import { tryOnScopeDispose, useEventListener } from '@vueuse/core'

/**
 * Defers work to the end of the primary-button press in progress, so a save
 * started by the blur of a mouse-down changes nothing on the page until the
 * click that press makes has landed. Without such a press, the work runs at
 * once; work still waiting when the scope ends runs then.
 */
export function useAfterPress(): (run: () => void) => void {
  let isPressed = false
  let waiting: (() => void)[] = []

  function flush() {
    const runs = waiting
    waiting = []
    for (const run of runs) run()
  }

  function release() {
    isPressed = false
    if (waiting.length) setTimeout(flush)
  }

  const capture = { capture: true, passive: true }
  useEventListener(
    'pointerdown',
    (event) => (isPressed = event.isPrimary && event.button === 0),
    capture,
  )
  useEventListener(['pointerup', 'pointercancel'], release, capture)
  useEventListener('blur', release)
  tryOnScopeDispose(flush)

  return (run) => {
    if (isPressed) waiting.push(run)
    else run()
  }
}
