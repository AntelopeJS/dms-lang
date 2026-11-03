interface MutationError {
  data?: unknown
}

interface ErrorBody {
  code?: unknown
}

interface MutationToastOptions {
  fallbackKey?: string
  params?: Record<string, string | number | boolean>
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
  const { presentError, resolveError } = useApiErrorPresenter()
  const fallbackKey = 'error.500.description'

  /** The server's message, translated; the generic server error otherwise. */
  function errorMessage(error: unknown): string {
    return resolveError(error, { fallbackKey })?.message ?? ''
  }

  function reportFailure(error: unknown, options: MutationToastOptions = {}) {
    const actions = options.retry
      ? [{ labelKey: 'dms_lang.actions.retry', onSelect: options.retry }]
      : undefined
    presentError(error, {
      fallbackKey: options.fallbackKey ?? fallbackKey,
      params: options.params,
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
