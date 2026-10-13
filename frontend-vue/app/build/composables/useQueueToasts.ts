import type { QueueStep } from '../../utils/queuePass'

interface ToastContext {
  t: ReturnType<typeof useI18n>['t']
  toast: ReturnType<typeof useToast>
}

/** Long enough to copy a draft whose key was deleted elsewhere. */
const DELETED_DRAFT_MS = 15000

const STEP_TOASTS: Partial<Record<QueueStep, string>> = {
  wrapped: 'dms_lang.queue.wrapped',
  last: 'dms_lang.queue.last_key',
}

async function copyText({ t, toast }: ToastContext, value: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title: t('dms_lang.queue.copied'), color: 'success' })
  } catch {
    toast.add({
      title: t('dms_lang.queue.copy_failed'),
      description: value,
      color: 'warning',
      icon: 'i-ph-copy',
      duration: DELETED_DRAFT_MS,
    })
  }
}

function copyAction(context: ToastContext, draftText: string) {
  return {
    duration: DELETED_DRAFT_MS,
    actions: [
      {
        label: context.t('dms_lang.queue.copy_draft'),
        icon: 'i-ph-copy',
        color: 'neutral' as const,
        variant: 'outline' as const,
        onClick: () => void copyText(context, draftText),
      },
    ],
  }
}

function announceDeleted(context: ToastContext, key: string, draftText = '') {
  const { t, toast } = context
  const hasDraft = !!draftText.trim()
  toast.add({
    title: t('dms_lang.queue.deleted_title', { key }),
    description: t(
      hasDraft
        ? 'dms_lang.queue.deleted_draft'
        : 'dms_lang.queue.deleted_description',
    ),
    color: 'warning',
    icon: 'i-ph-trash',
    ...(hasDraft ? copyAction(context, draftText) : {}),
  })
}

function showStep({ t, toast }: ToastContext, step: QueueStep | undefined) {
  const title = step ? STEP_TOASTS[step] : undefined
  if (!title) return
  toast.add({ title: t(title), color: 'neutral', icon: 'i-ph-arrow-u-up-left' })
}

function warnBlocked({ t, toast }: ToastContext) {
  toast.add({
    title: t('dms_lang.queue.blocked'),
    color: 'error',
    icon: 'i-ph-warning-circle',
  })
}

function warnConflict({ t, toast }: ToastContext, key: string) {
  toast.add({
    title: t('dms_lang.queue.conflict_title', { key }),
    description: t('dms_lang.queue.conflict_description'),
    color: 'warning',
    icon: 'i-ph-warning',
  })
}

/** The toasts of the translation queue: where it moved, a conflict, a deleted key. */
export function useQueueToasts() {
  const context: ToastContext = { t: useI18n().t, toast: useToast() }
  return {
    /** Says the queue went back to the skipped keys, or stays on the last one. */
    showStep: (step: QueueStep | undefined) => showStep(context, step),
    warnConflict: (key: string) => warnConflict(context, key),
    warnBlocked: () => warnBlocked(context),
    notify: (title: string) =>
      context.toast.add({ title, color: 'success', icon: 'i-ph-check' }),
    /** Says a key left the queue because it was deleted elsewhere, offering its draft. */
    announceDeleted: (key: string, draftText?: string) =>
      announceDeleted(context, key, draftText),
  }
}
