import type { Ref } from 'vue'
import { useDmsRouter, useDmsState } from '#dms/frontend-module'
import type { FlatTranslationRow } from '../../types/lang'
import KeyEditorDrawer from '../components/KeyEditorDrawer.vue'
import type { CellHold } from './useCellSaves'

export interface PanelRequest {
  key: string
  /** The language to put the cursor in. */
  focusLocale?: string
  /** Text typed in a cell and not saved yet: the panel takes it over. */
  initialDrafts?: Record<string, string>
}

export interface PanelOptions {
  /** The keys the panel steps through with previous / next. */
  keys: () => string[]
  editable: () => boolean
  manageKeys: () => boolean
  /** Whether the panel offers to override a read-only module key. */
  canOverride: () => boolean
  /** A read-only module key the panel offers to override. */
  onOverride: (key: string) => void
  /** Texts the panel could not save as it closed: they wait in their cells. */
  onKeep: (holds: CellHold[]) => void
  /** Whether the workspace holds the key, in any of its languages. */
  isKnown?: (key: string) => boolean
  /** A link names a key the workspace does not hold: the panel stays closed. */
  onUnknown?: (key: string) => void
}

type DrawerOverlay = ReturnType<ReturnType<typeof useOverlay>['create']>

interface PendingSwitch {
  key: string
  settle: (isShown: boolean) => void
}

interface PanelState {
  shownWorkspace: string
  drawer: DrawerOverlay | null
  pushedFrom: string | null
  pendingSwitch: PendingSwitch | null
  isDisposed: boolean
}

interface PanelContext {
  options: PanelOptions
  overlay: ReturnType<typeof useOverlay>
  router: ReturnType<typeof useDmsRouter>
  route: ReturnType<typeof useWorkspaceRoute>['route']
  seeds: Ref<Record<string, FlatTranslationRow>>
  workspace: Ref<string>
  shownKey: Ref<string>
  state: PanelState
}

const KEY_QUERY = 'key'

function linkWithKey(context: PanelContext, key: string | undefined): string {
  const { route } = context
  return linkWithQuery(route.path, { ...route.query, [KEY_QUERY]: key })
}

function seed(
  context: PanelContext,
  key: string,
  texts: FlatTranslationRow['values'],
) {
  context.seeds.value = {
    ...context.seeds.value,
    [key]: { key, values: { ...texts }, inherited: { ...texts } },
  }
}

function dropSeed(context: PanelContext, key: string) {
  const { [key]: dropped, ...rest } = context.seeds.value
  if (dropped) context.seeds.value = rest
}

function propsFor(context: PanelContext, request: PanelRequest) {
  const { options } = context
  const keys = options.keys()
  const index = keys.indexOf(request.key)
  return {
    keys: index < 0 ? [request.key] : keys,
    startIndex: Math.max(index, 0),
    workspace: context.workspace.value,
    editable: options.editable(),
    manageKeys: options.manageKeys(),
    canOverride: options.canOverride(),
    seed: context.seeds.value[request.key],
    focusLocale: request.focusLocale,
    initialDrafts: request.initialDrafts,
    onNavigate: (key: string) => onNavigate(context, key),
    onOverride: options.onOverride,
    onKeep: options.onKeep,
  }
}

function settleSwitch(context: PanelContext, shown: string | null) {
  const pending = context.state.pendingSwitch
  context.state.pendingSwitch = null
  pending?.settle(pending.key === shown)
}

function switchKey(
  context: PanelContext,
  drawer: DrawerOverlay,
  request: PanelRequest,
): Promise<boolean> {
  return new Promise((settle) => {
    context.state.pendingSwitch = { key: request.key, settle }
    drawer.patch(propsFor(context, request))
  })
}

function show(context: PanelContext, request: PanelRequest): Promise<boolean> {
  const { state } = context
  state.shownWorkspace = context.workspace.value
  settleSwitch(context, null)
  if (state.drawer && request.key === context.shownKey.value) {
    state.drawer.patch(propsFor(context, request))
    return Promise.resolve(true)
  }
  if (state.drawer) return switchKey(context, state.drawer, request)
  context.shownKey.value = request.key
  state.drawer = context.overlay.create(KeyEditorDrawer, {
    destroyOnClose: true,
  })
  void state.drawer
    .open(propsFor(context, request))
    .then(() => onClosed(context))
  return Promise.resolve(true)
}

async function open(
  context: PanelContext,
  request: PanelRequest,
): Promise<boolean> {
  if (context.state.drawer) return show(context, request)
  void show(context, request)
  if (context.route.query[KEY_QUERY] === request.key) return true
  context.state.pushedFrom = linkWithKey(context, undefined)
  await context.router.push(linkWithKey(context, request.key))
  return true
}

function onNavigate(context: PanelContext, key: string) {
  context.shownKey.value = key
  settleSwitch(context, key)
  if (context.route.query[KEY_QUERY] !== key)
    void context.router.replace(linkWithKey(context, key))
}

function nextRoute(context: PanelContext): Promise<void> {
  return new Promise((resolve) => {
    const stop = watch(
      () => context.route.fullPath,
      () => {
        stop()
        resolve()
      },
    )
  })
}

async function leaveKeyEntry(context: PanelContext, from: string | null) {
  const without = linkWithKey(context, undefined)
  if (from === null) return context.router.replace(without)
  const isBack = nextRoute(context)
  context.router.back()
  await isBack
  if (linkWithKey(context, undefined) !== without)
    await context.router.replace(without)
}

function onClosed(context: PanelContext) {
  const { state, route } = context
  state.drawer = null
  settleSwitch(context, null)
  if (!state.isDisposed) dropSeed(context, context.shownKey.value)
  context.shownKey.value = ''
  const from = state.pushedFrom
  state.pushedFrom = null
  if (state.isDisposed || !route.query[KEY_QUERY]) return
  void leaveKeyEntry(context, from)
}

function isOpenable(context: PanelContext, key: string): boolean {
  const { options } = context
  if (context.seeds.value[key] || options.isKnown?.(key) !== false) return true
  options.onUnknown?.(key)
  return false
}

function followQuery(context: PanelContext, key: string) {
  if (!key) return context.state.drawer?.close()
  if (key === context.shownKey.value || !isOpenable(context, key)) return
  void show(context, { key })
}

function followWorkspace(context: PanelContext, workspace: string) {
  const { drawer, shownWorkspace } = context.state
  const shownKey = context.shownKey.value
  if (!drawer || !shownKey || shownWorkspace === workspace) return
  if (!isOpenable(context, shownKey)) return drawer.close()
  void show(context, { key: shownKey })
}

function patchRights(context: PanelContext) {
  const { options } = context
  context.state.drawer?.patch({
    editable: options.editable(),
    manageKeys: options.manageKeys(),
    canOverride: options.canOverride(),
  })
}

function watchPanel(context: PanelContext) {
  const { isLoaded, flat } = useWorkspaceFlat()
  const { options, route } = context
  watch(
    [() => route.query[KEY_QUERY] ?? '', isLoaded],
    ([key, loaded]) => loaded && followQuery(context, key),
    { immediate: true },
  )
  watch(
    [context.workspace, isLoaded],
    ([workspace, loaded]) => loaded && followWorkspace(context, workspace),
  )
  watch(
    () =>
      flat.value.rows.find((row) => row.key === context.shownKey.value)
        ?.inherited,
    (inherited) => {
      if (context.shownKey.value && inherited && Object.keys(inherited).length)
        seed(context, context.shownKey.value, inherited)
    },
  )
  watch([options.editable, options.manageKeys, options.canOverride], () =>
    patchRights(context),
  )
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
  const context: PanelContext = {
    options,
    overlay: useOverlay(),
    router: useDmsRouter(),
    route: useWorkspaceRoute().route,
    seeds: useDmsState<Record<string, FlatTranslationRow>>(
      'dms-lang-override-seeds',
      () => ({}),
    ),
    workspace: useI18nWorkspaces().selectedWorkspace,
    shownKey: ref(''),
    state: {
      shownWorkspace: '',
      drawer: null,
      pushedFrom: null,
      pendingSwitch: null,
      isDisposed: false,
    },
  }
  watchPanel(context)
  onBeforeUnmount(() => {
    context.state.isDisposed = true
    context.state.drawer?.close()
  })
  return {
    open: (request: PanelRequest) => open(context, request),
    seedOverride: (row: FlatTranslationRow) =>
      seed(context, row.key, row.values),
  }
}
