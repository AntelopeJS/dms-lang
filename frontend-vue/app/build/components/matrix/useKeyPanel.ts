import { useDmsRouter, useDmsState } from '#dms/frontend-module'
import type { FlatTranslationRow } from '../../../types/lang'
import KeyEditorDrawer from '../KeyEditorDrawer.vue'

interface PanelRequest {
  key: string
  /** The language to put the cursor in. */
  focusLocale?: string
  /** Text typed in a cell and not saved yet: the panel takes it over. */
  initialDrafts?: Record<string, string>
}

interface PanelOptions {
  /** The keys the panel steps through with previous / next. */
  keys: () => string[]
  editable: () => boolean
  manageKeys: () => boolean
  /** A read-only module key the panel offers to override. */
  onOverride: (key: string) => void
  /** Whether the workspace holds the key, in any of its languages. */
  isKnown?: (key: string) => boolean
  /** A link names a key the workspace does not hold: the panel stays closed. */
  onUnknown?: (key: string) => void
}

const KEY_QUERY = 'key'

type DrawerOverlay = ReturnType<ReturnType<typeof useOverlay>['create']>

/** A key asked of the open panel, until it says which key it shows. */
interface PendingSwitch {
  key: string
  settle: (isShown: boolean) => void
}

/**
 * The key panel of the matrix: one panel at a time (opening another key
 * moves the open panel to it), and the key it shows in the URL (`?key=`), so
 * a link or a refresh opens it again and the browser's Back button closes it.
 * The open panel may refuse another key (one of its fields waits for a
 * choice): `open` tells whether it took the key, so nothing handed over is
 * dropped before it did.
 */
export function useKeyPanel(options: PanelOptions) {
  const overlay = useOverlay()
  const router = useDmsRouter()
  const { route } = useWorkspaceRoute()
  const { isLoaded, flat } = useWorkspaceFlat()
  const { selectedWorkspace } = useI18nWorkspaces()
  /** Module keys being overridden: the panel shows their module text. */
  const seeds = useDmsState<Record<string, FlatTranslationRow>>(
    'dms-lang-override-seeds',
    () => ({}),
  )

  const shownKey = ref('')
  let shownWorkspace = ''
  let drawer: DrawerOverlay | null = null
  let pushedFrom: string | null = null
  let pendingSwitch: PendingSwitch | null = null
  let isDisposed = false

  function linkWithKey(key: string | undefined): string {
    return linkWithQuery(route.path, { ...route.query, [KEY_QUERY]: key })
  }

  function dropSeed(key: string) {
    const { [key]: seed, ...rest } = seeds.value
    if (seed) seeds.value = rest
  }

  function propsFor(request: PanelRequest) {
    const keys = options.keys()
    const index = keys.indexOf(request.key)
    return {
      keys: index < 0 ? [request.key] : keys,
      startIndex: Math.max(index, 0),
      editable: options.editable(),
      manageKeys: options.manageKeys(),
      seed: seeds.value[request.key],
      focusLocale: request.focusLocale,
      initialDrafts: request.initialDrafts,
      onNavigate: (key: string) => onNavigate(key),
      onOverride: options.onOverride,
    }
  }

  function settleSwitch(shown: string | null) {
    const pending = pendingSwitch
    pendingSwitch = null
    pending?.settle(pending.key === shown)
  }

  /** Resolves once the panel shows the key, or stays on its own (false). */
  function show(request: PanelRequest): Promise<boolean> {
    shownWorkspace = selectedWorkspace.value
    settleSwitch(null)
    if (drawer && request.key === shownKey.value) {
      drawer.patch(propsFor(request))
      return Promise.resolve(true)
    }
    if (drawer) {
      const open = drawer
      return new Promise((settle) => {
        pendingSwitch = { key: request.key, settle }
        open.patch(propsFor(request))
      })
    }
    shownKey.value = request.key
    drawer = overlay.create(KeyEditorDrawer, { destroyOnClose: true })
    void drawer.open(propsFor(request)).then(onClosed)
    return Promise.resolve(true)
  }

  /**
   * Opens a key from the page: one history entry for the panel, so Back
   * closes it. False when the open panel kept its own key.
   */
  async function open(request: PanelRequest): Promise<boolean> {
    // The open panel reports the key it shows (onNavigate): the URL follows.
    if (drawer) return show(request)
    void show(request)
    if (route.query[KEY_QUERY] === request.key) return true
    pushedFrom = linkWithKey(undefined)
    await router.push(linkWithKey(request.key))
    return true
  }

  function onNavigate(key: string) {
    shownKey.value = key
    settleSwitch(key)
    if (route.query[KEY_QUERY] !== key) void router.replace(linkWithKey(key))
  }

  function onClosed() {
    drawer = null
    settleSwitch(null)
    if (!isDisposed) dropSeed(shownKey.value)
    shownKey.value = ''
    const from = pushedFrom
    pushedFrom = null
    if (isDisposed || !route.query[KEY_QUERY]) return
    const without = linkWithKey(undefined)
    if (from === without) router.back()
    else void router.replace(without)
  }

  function seed(key: string, texts: FlatTranslationRow['values']) {
    seeds.value = {
      ...seeds.value,
      [key]: { key, values: { ...texts }, inherited: { ...texts } },
    }
  }

  /** Remembers a module key's text before switching to the project files. */
  function seedOverride(row: FlatTranslationRow) {
    seed(row.key, row.values)
  }

  function isOpenable(key: string): boolean {
    if (seeds.value[key] || options.isKnown?.(key) !== false) return true
    options.onUnknown?.(key)
    return false
  }

  watch(
    [() => route.query[KEY_QUERY] ?? '', isLoaded],
    ([key, loaded]) => {
      if (!loaded) return
      if (!key) {
        drawer?.close()
        return
      }
      if (key === shownKey.value || !isOpenable(key)) return
      void show({ key })
    },
    { immediate: true },
  )

  // The panel follows the key to another workspace (a module key overridden
  // in the project files): it reads that workspace's rows and the module text.
  watch([selectedWorkspace, isLoaded], ([workspace, loaded]) => {
    const key = shownKey.value
    if (!loaded || !drawer || !key || shownWorkspace === workspace) return
    if (!isOpenable(key)) {
      drawer.close()
      return
    }
    void show({ key })
  })

  // A module key leaves the project files with its last override: the panel
  // (opened again when the page reloads) keeps showing its module text.
  watch(
    () => flat.value.rows.find((row) => row.key === shownKey.value)?.inherited,
    (inherited) => {
      if (shownKey.value && inherited && Object.keys(inherited).length)
        seed(shownKey.value, inherited)
    },
  )

  // The rights arrive with the workspace list, after a link opened the panel.
  watch([options.editable, options.manageKeys], () =>
    drawer?.patch({
      editable: options.editable(),
      manageKeys: options.manageKeys(),
    }),
  )

  onBeforeUnmount(() => {
    isDisposed = true
    drawer?.close()
  })

  return { open, seedOverride, shownKey }
}
