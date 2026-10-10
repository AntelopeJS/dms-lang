interface MutationError {
  data?: { statusMessage?: string; message?: string }
  statusMessage?: string
}

interface MutationToastOptions {
  title?: string
  retry?: () => void
}

/** Runs a write and reports a failure in a toast naming what failed. */
export const useMutationToast = () => {
  const { t } = useI18n()
  const toast = useToast()

  function errorMessage(error: unknown): string {
    const failure = error as MutationError
    return (
      failure?.data?.statusMessage ??
      failure?.data?.message ??
      failure?.statusMessage ??
      t('dms_lang.errors.save_failed')
    )
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

  return { tryMutate, reportFailure }
}
