import type { Ref } from 'vue'
import { useResizeObserver } from '@vueuse/core'

const SCROLLING = new Set(['auto', 'scroll'])

/** The nearest ancestor that scrolls vertically: a drawer's body. */
export function scrollAreaOf(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement
  while (parent && !SCROLLING.has(getComputedStyle(parent).overflowY))
    parent = parent.parentElement
  return parent
}

/**
 * The height that takes `element` from where it starts down to the bottom of
 * the area it scrolls in, inside that area's padding. Given as its
 * `min-height`, a footer pushed to its end (`mt-auto`) sits on the area's
 * bottom edge under short content, and sticks there (`sticky bottom-0`)
 * while longer content scrolls past it. Measured, as the area's height comes
 * from the container drawing it (a DMS drawer's body), not from a height
 * CSS could inherit.
 */
export function useScrollAreaFill(element: Ref<HTMLElement | null>) {
  const area = shallowRef<HTMLElement | null>(null)
  const height = ref<number>()

  function measure() {
    const target = element.value
    const scroller = area.value
    if (!target || !scroller) return
    const padding = parseFloat(getComputedStyle(scroller).paddingBottom) || 0
    const offset =
      target.getBoundingClientRect().top -
      scroller.getBoundingClientRect().top +
      scroller.scrollTop
    height.value = Math.max(scroller.clientHeight - padding - offset, 0)
  }

  onMounted(() => {
    area.value = element.value ? scrollAreaOf(element.value) : null
    measure()
  })
  useResizeObserver(area, measure)

  return computed(() =>
    height.value === undefined ? undefined : { minHeight: `${height.value}px` },
  )
}
