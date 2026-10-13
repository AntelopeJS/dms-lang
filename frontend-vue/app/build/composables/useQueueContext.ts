import type { ComputedRef, InjectionKey } from 'vue'
import type { QueueSession } from '../../composables/translation/useQueueSession'
import type { QueueEditing } from './useQueueEditing'
import type { QueueSave } from './useQueueSave'

/** What the parts of the translation queue share: its pass, its draft and its save. */
export interface QueueContext {
  session: QueueSession
  editing: QueueEditing
  save: QueueSave
  /** The name of the language shown, with its region when another language here shares it. */
  languageName: ComputedRef<string>
  /** A language name, with its region when another language here shares it. */
  nameOf: (code: string) => string
  /** Skips the key shown, saying when the queue went round. */
  skip: () => void
}

const QUEUE_CONTEXT: InjectionKey<QueueContext> = Symbol('dms-lang-queue')

/** Shares the queue with the parts the queue card renders. */
export function provideQueue(context: QueueContext): void {
  provide(QUEUE_CONTEXT, context)
}

/** The queue of the card a part is rendered in. */
export function useQueue(): QueueContext {
  const context = inject(QUEUE_CONTEXT)
  if (!context) throw new Error('A queue part renders inside TranslationQueue')
  return context
}
