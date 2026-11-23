interface MutationToastOptions {
  fallbackKey?: string
  params?: Record<string, string | number | boolean>
  retry?: () => void
}

/** A value a failed request threw. */
export type RequestFailure = {} | null | undefined

interface FailureBody {
  data?: { code?: string }
}

function isFailureBody(value: RequestFailure): value is FailureBody {
  if (typeof value !== 'object' || value === null) return false
  if (!('data' in value)) return true
  const { data } = value
  if (typeof data !== 'object' || data === null) return false
  return !('code' in data) || typeof data.code === 'string'
}

/** The error code the server gave a failed request (`key_exists`, …). */
export function serverErrorCode(error: RequestFailure): string {
  return isFailureBody(error) ? (error.data?.code ?? '') : ''
}

/**
 * Runs a write and reports a failure in a toast, worded by the DMS from the
 * `$dms_lang.errors.*` key the server answers, with a Retry action.
 */
export const useMutationToast = () => {
  const presenter = useApiErrorPresenter()
  const fallbackKey = 'error.500.description'

  function errorMessage(error: RequestFailure): string {
    return presenter.resolveError(error, { fallbackKey })?.message ?? ''
  }

  function reportFailure(
    error: RequestFailure,
    options: MutationToastOptions = {},
  ) {
    const actions = options.retry
      ? [{ labelKey: 'dms_lang.actions.retry', onSelect: options.retry }]
      : undefined
    presenter.presentError(error, {
      fallbackKey: options.fallbackKey ?? fallbackKey,
      params: options.params,
      actions,
    })
  }

  async function tryMutate<Result>(
    fn: () => Promise<Result>,
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
