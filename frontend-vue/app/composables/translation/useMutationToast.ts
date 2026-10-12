interface MutationError {
  data?: unknown
}

interface ErrorBody {
  code?: unknown
}

interface MutationToastOptions {
  title?: string
  retry?: () => void
}

/** The error code the server gave a failed request (`key_exists`, …). */
export function serverErrorCode(error: unknown): string {
  const data = (error as MutationError | undefined)?.data
  if (typeof data !== 'object' || data === null) return ''
  const { code } = data as ErrorBody
  return typeof code === 'string' ? code : ''
}

/**
 * Runs a write and reports a failure in a toast, worded by the DMS from the
 * `$dms_lang.errors.*` key the server answers, with a Retry action.
 */
export const useMutationToast = () => {
  const { t } = useI18n()
  const toast = useToast()
  const translate = (key: string, params: Record<string, unknown>) =>
    t(key, params)

  /** The server's message, translated; the generic server error otherwise. */
  function errorMessage(error: unknown): string {
    return resolveApiMessage(translate, resolveApiErrorMessage(error))
  }

  function reportFailure(error: unknown, options: MutationToastOptions = {}) {
    const actions = options.retry
      ? [{ label: t('dms_lang.actions.retry'), onClick: options.retry }]
      : undefined
    toast.add({
      title: options.title ?? t(resolveApiErrorTitle(error)),
      description: errorMessage(error),
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

  return { tryMutate, reportFailure, errorMessage, serverErrorCode }
}
