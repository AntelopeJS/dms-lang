interface ErrorBody {
  message?: string
  statusMessage?: string
  code?: string
}

interface MutationError {
  data?: ErrorBody | string
  status?: number
  statusCode?: number
}

interface MutationToastOptions {
  title?: string
  retry?: () => void
}

const CONFLICT_STATUS = 409
const HTML_BODY = /^\s*</

const STATUS_MESSAGES: Record<number, string> = {
  400: 'dms_lang.errors.status.bad_request',
  403: 'dms_lang.errors.status.forbidden',
  404: 'dms_lang.errors.status.not_found',
  409: 'dms_lang.errors.status.conflict',
  413: 'dms_lang.errors.status.too_large',
}

function statusOf(error: unknown): number | undefined {
  const failure = error as MutationError | undefined
  return failure?.status ?? failure?.statusCode
}

/** The message the server wrote for a failed request, if it wrote one. */
export function serverMessage(error: unknown): string {
  const data = (error as MutationError | undefined)?.data
  if (typeof data === 'string') return HTML_BODY.test(data) ? '' : data.trim()
  return (data?.message ?? data?.statusMessage ?? '').trim()
}

/** The translation key of the sentence for a failed request's status, if any. */
export function statusMessageKey(error: unknown): string | undefined {
  const status = statusOf(error)
  return status === undefined ? undefined : STATUS_MESSAGES[status]
}

/** Whether a write was refused because the value changed since it was read. */
export function isConflict(error: unknown): boolean {
  return statusOf(error) === CONFLICT_STATUS
}

/** The error code the server gave a failed request (`key_exists`, …). */
export function serverErrorCode(error: unknown): string {
  const data = (error as MutationError | undefined)?.data
  return typeof data === 'object' ? (data?.code ?? '') : ''
}

/** Runs a write and reports a failure in a toast naming what failed. */
export const useMutationToast = () => {
  const { t } = useI18n()
  const toast = useToast()

  /** The server's own words first, then a sentence for the status. */
  function errorMessage(error: unknown): string {
    const fromServer = serverMessage(error)
    if (fromServer) return fromServer
    return t(statusMessageKey(error) ?? 'dms_lang.errors.save_failed')
  }

  function reportFailure(error: unknown, options: MutationToastOptions = {}) {
    const actions = options.retry
      ? [{ label: t('dms_lang.actions.retry'), onClick: options.retry }]
      : undefined
    toast.add({
      title: options.title ?? errorMessage(error),
      description: options.title ? errorMessage(error) : undefined,
      color: 'error',
      icon: 'i-ph-warning-circle',
      actions,
    })
  }

  async function tryMutate(
    fn: () => Promise<unknown>,
    options?: MutationToastOptions,
  ): Promise<boolean> {
    try {
      await fn()
      return true
    } catch (error) {
      reportFailure(error, options)
      return false
    }
  }

  return { tryMutate, reportFailure, errorMessage, isConflict, serverErrorCode }
}
