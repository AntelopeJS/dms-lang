/** A text of a served dialog: an i18n key with `$`, else a literal with `{param}` fill-ins. */
type ServedText = string

const KEY_PREFIX = '$'
const PARAM_PATTERN = /{(\w+)}/g

interface ServedImpact {
  icon: string
  label: ServedText
  count?: number | string
}

interface ServedDownload {
  type: 'download'
  url: string
  filename?: string
}

interface ServedSecondaryAction {
  label: ServedText
  icon?: string
  target: ServedDownload
}

/** A confirmation dialog as a `confirm: { from }` route serves it (interface-dms `ConfirmDialogSerialized`). */
export interface ServedDialog {
  title: ServedText
  description?: ServedText
  params?: Record<string, unknown>
  color?: 'primary' | 'warning' | 'error' | 'neutral'
  icon?: string
  confirmLabel?: ServedText
  cancelLabel?: ServedText
  confirmText?: string
  impact?: ServedImpact[]
  secondaryAction?: ServedSecondaryAction
}

type ConfirmRun = () => Promise<unknown>

type Params = Record<string, unknown>

/** What resolving a served dialog and running its download needs from the DMS. */
interface ServedContext {
  t: ReturnType<typeof useI18n>['t']
  authFetch: ReturnType<typeof useAuthFetch>['$authFetch']
}

function fillLiteral(text: string, params: Params): string {
  return text.replace(PARAM_PATTERN, (match, name: string) =>
    params[name] === undefined ? match : String(params[name]),
  )
}

function resolveText(
  { t }: ServedContext,
  value: ServedText,
  params: Params,
): string {
  if (!value.startsWith(KEY_PREFIX)) return fillLiteral(value, params)
  const key = value.slice(KEY_PREFIX.length)
  const { count } = params
  return typeof count === 'number' ? t(key, params, count) : t(key, params)
}

/** Fetches a served download with the user's session and saves it. */
async function download(
  context: ServedContext,
  target: ServedDownload,
  params: Params,
): Promise<void> {
  const url = interpolateUrl(target.url, params)
  const response = await context.authFetch.raw<Blob, 'blob'>(url, {
    responseType: 'blob',
  })
  const objectUrl = URL.createObjectURL(response._data ?? new Blob([]))
  try {
    downloadFile(objectUrl, interpolateRowText(target.filename ?? '', params))
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function secondaryOf(
  context: ServedContext,
  dialog: ServedDialog,
  params: Params,
) {
  const action = dialog.secondaryAction
  if (!action) return undefined
  return {
    label: resolveText(context, action.label, params),
    icon: action.icon,
    run: () => download(context, action.target, params),
  }
}

/** A served dialog with its texts resolved, ready for `useConfirm()`. */
function confirmOptionsOf(context: ServedContext, dialog: ServedDialog) {
  const params = dialog.params ?? {}
  const text = (value?: ServedText) =>
    value === undefined ? undefined : resolveText(context, value, params)
  return {
    title: text(dialog.title) ?? '',
    description: text(dialog.description),
    color: dialog.color,
    icon: dialog.icon,
    confirmLabel: text(dialog.confirmLabel),
    cancelLabel: text(dialog.cancelLabel),
    confirmText: dialog.confirmText,
    impact: dialog.impact?.map((entry) => ({
      ...entry,
      label: text(entry.label) ?? '',
    })),
    secondaryAction: secondaryOf(context, dialog, params),
  }
}

/**
 * Reads the dialog a route serves, once an action asks: a dialog reads
 * what it shows when it opens. `null` once the read failed, said in a toast.
 */
function useServedDialog() {
  const url = ref<string | null>(null)
  const read = useApiData<ServedDialog>(url, {
    immediate: false,
    server: false,
    refreshOnPageRefresh: false,
  })
  const { reportFailure } = useMutationToast()

  return async (from: string): Promise<ServedDialog | null> => {
    url.value = from
    await read.execute({ dedupe: 'defer' })
    if (read.error.value) {
      reportFailure(read.error.value)
      return null
    }
    return read.data.value
  }
}

/**
 * Asks with the dialog the server words for an action (the one a table row
 * action asks with, through `confirm: { from }`), so the action asks the
 * same question wherever it starts: its texts, its impact, the code to type
 * and its download. Resolves whether the user confirmed and `run` succeeded.
 */
export function useServedConfirm() {
  const context: ServedContext = {
    t: useI18n().t,
    authFetch: useAuthFetch().$authFetch,
  }
  const { confirm } = useConfirm()
  const loadDialog = useServedDialog()

  return async (url: string, run: ConfirmRun): Promise<boolean> => {
    const dialog = await loadDialog(url)
    if (!dialog) return false
    return confirm({
      ...confirmOptionsOf(context, dialog),
      onConfirm: async () => {
        await run()
      },
    })
  }
}
