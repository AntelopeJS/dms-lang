import type { Ref } from 'vue'
import { useDmsRouter, useDmsState } from '#dms/frontend-module'
import type { DrawerRowHeader } from '#dms-ui/app/composables/containers/types'
import type { FlatTranslationRow, KeyPanelHeader } from '../../types/lang'
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

type DrawerOverlay = ReturnType<ReturnType<typeof useDrawer>['open']>
type PanelProps = Record<string, unknown>

interface PendingSwitch {
  key: string
  settle: (isShown: boolean) => void
}

interface PanelState {
  shownWorkspace: string
  drawer: DrawerOverlay | null
  /** The props the open panel's body was last given. */
  props: PanelProps
  pendingSwitch: PendingSwitch | null
  isDisposed: boolean
}

interface PanelContext {
  options: PanelOptions
  drawers: ReturnType<typeof useDrawer>
  router: ReturnType<typeof useDmsRouter>
  route: ReturnType<typeof useWorkspaceRoute>['route']
  seeds: Ref<Record<string, FlatTranslationRow>>
  workspace: Ref<string>
  shownKey: Ref<string>
  state: PanelState
}

const KEY_QUERY = 'key'
const DRAWER_DIRECTION = 'right'
// Every key opens the same drawer, under one id: the DMS keeps the width the
// user drags it to under its `sizeKey`, on this device. One panel is open at
// a time, so the id stays unique.
const DRAWER_ID = 'dms-lang-key-panel'
const POSITION_LABEL = '$dms_lang.drawer.position'

/**
 * The DMS row header for the key the body shows: the key, its place among
 * the matrix's keys, previous / next and J / K. A key opened off the list
 * has no place in it, so no steps.
 */
function rowHeaderOf(header: KeyPanelHeader): DrawerRowHeader {
  if (header.index < 0) return { title: header.key }
  return {
    title: header.key,
    positionLabel: POSITION_LABEL,
    navigation: {
      index: header.index,
      total: header.total,
      hasPrev: header.hasPrevious,
      hasNext: header.hasNext,
      prev: header.previous,
      next: header.next,
    },
  }
}

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

function propsFor(context: PanelContext, request: PanelRequest): PanelProps {
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
    onHeader: (header: KeyPanelHeader) =>
      context.state.drawer?.patch({ rowHeader: rowHeaderOf(header) }),
  }
}

/** Changes some of the open panel's props, keeping the others. */
function patchPanel(context: PanelContext, props: PanelProps) {
  const { state } = context
  state.props = { ...state.props, ...props }
  state.drawer?.patch({ componentOptions: state.props })
}

/** Asks the open panel to save what it can and close (see its `open`). */
function closePanel(context: PanelContext) {
  patchPanel(context, { open: false })
}

function settleSwitch(context: PanelContext, shown: string | null) {
  const pending = context.state.pendingSwitch
  context.state.pendingSwitch = null
  pending?.settle(pending.key === shown)
}

function switchKey(
  context: PanelContext,
  request: PanelRequest,
): Promise<boolean> {
  return new Promise((settle) => {
    context.state.pendingSwitch = { key: request.key, settle }
    patchPanel(context, propsFor(context, request))
  })
}

function show(context: PanelContext, request: PanelRequest): Promise<boolean> {
  const { state } = context
  state.shownWorkspace = context.workspace.value
  settleSwitch(context, null)
  if (state.drawer && request.key === context.shownKey.value) {
    patchPanel(context, propsFor(context, request))
    return Promise.resolve(true)
  }
  if (state.drawer) return switchKey(context, request)
  context.shownKey.value = request.key
  state.props = propsFor(context, request)
  // The DMS row header names the key; the body hands over its place among
  // the keys as it shows one (`onHeader`).
  state.drawer = context.drawers.open({
    direction: DRAWER_DIRECTION,
    containerId: DRAWER_ID,
    sizeKey: DRAWER_ID,
    title: request.key,
    rowHeader: { title: request.key },
    component: KeyEditorDrawer,
    componentOptions: state.props,
  })
  void state.drawer.result.then(() => onClosed(context))
  return Promise.resolve(true)
}

async function open(
  context: PanelContext,
  request: PanelRequest,
): Promise<boolean> {
  if (context.state.drawer) return show(context, request)
  void show(context, request)
  if (context.route.query[KEY_QUERY] === request.key) return true
  await context.router.push(linkWithKey(context, request.key))
  return true
}

function onNavigate(context: PanelContext, key: string) {
  context.shownKey.value = key
  context.state.drawer?.patch({ title: key })
  settleSwitch(context, key)
  if (context.route.query[KEY_QUERY] !== key)
    void context.router.replace(linkWithKey(context, key))
}

function onClosed(context: PanelContext) {
  const { state, route } = context
  state.drawer = null
  state.props = {}
  settleSwitch(context, null)
  if (!state.isDisposed) dropSeed(context, context.shownKey.value)
  context.shownKey.value = ''
  if (state.isDisposed || !route.query[KEY_QUERY]) return
  // Replaced, not left by going Back: a history step back renders the page
  // anew (Inertia restores it from the history), which would fold the
  // matrix's groups and lose its scroll.
  void context.router.replace(linkWithKey(context, undefined))
}

function isOpenable(context: PanelContext, key: string): boolean {
  const { options } = context
  if (context.seeds.value[key] || options.isKnown?.(key) !== false) return true
  options.onUnknown?.(key)
  return false
}

function followQuery(context: PanelContext, key: string) {
  if (!key) return closePanel(context)
  if (key === context.shownKey.value || !isOpenable(context, key)) return
  void show(context, { key })
}

function followWorkspace(context: PanelContext, workspace: string) {
  const { drawer, shownWorkspace } = context.state
  const shownKey = context.shownKey.value
  if (!drawer || !shownKey || shownWorkspace === workspace) return
  if (!isOpenable(context, shownKey)) return closePanel(context)
  void show(context, { key: shownKey })
}

function patchRights(context: PanelContext) {
  const { options } = context
  if (!context.state.drawer) return
  patchPanel(context, {
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
 * J and K step to the next and previous key while it is open (the DMS row
 * header's).
 * The open panel may refuse another key (one of its fields waits for a
 * choice): `open` tells whether it took the key, so nothing handed over is
 * dropped before it did.
 */
export function useKeyPanel(options: PanelOptions) {
  const context: PanelContext = {
    options,
    drawers: useDrawer(),
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
      props: {},
      pendingSwitch: null,
      isDisposed: false,
    },
  }
  watchPanel(context)
  onBeforeUnmount(() => {
    context.state.isDisposed = true
    closePanel(context)
  })
  return {
    open: (request: PanelRequest) => open(context, request),
    seedOverride: (row: FlatTranslationRow) =>
      seed(context, row.key, row.values),
  }
}
