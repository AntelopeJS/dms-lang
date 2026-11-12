import { nextTick, type Ref } from 'vue'

/** Finds and focuses the text field of a language inside the key panel body. */
export function useFieldFocus(body: Readonly<Ref<HTMLElement | null>>) {
  function fieldInput(code: string): HTMLTextAreaElement | null {
    return (
      body.value?.querySelector<HTMLTextAreaElement>(
        `[data-locale="${code}"] textarea`,
      ) ?? null
    )
  }

  async function focusField(code?: string, caret?: number) {
    if (!code) return
    await nextTick()
    const input = fieldInput(code)
    if (!input) return
    input.scrollIntoView({ block: 'nearest' })
    input.focus()
    if (caret !== undefined) input.setSelectionRange(caret, caret)
  }

  return { fieldInput, focusField }
}
