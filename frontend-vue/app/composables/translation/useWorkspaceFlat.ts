import { useDmsState } from '#dms/frontend-module'
import type { FlatTranslations } from '../../types/lang'
import {
  EMPTY_FLAT,
  cloneFlat,
  refreshCounts,
  resolveDefaultLocale,
} from '../../utils/translations'

const FLAT_ENDPOINT = '/api/lang/translations/flat'

function useFlatStore() {
  return {
    entries: useDmsState<Record<string, FlatTranslations>>(
      'dms-lang-flat',
      () => ({}),
    ),
    pending: useDmsState<Record<string, boolean>>(
      'dms-lang-flat-pending',
      () => ({}),
    ),
    failed: useDmsState<Record<string, boolean>>(
      'dms-lang-flat-failed',
      () => ({}),
    ),
  }
}

const requests = new Map<string, Promise<void>>()

/**
 * The flat translations of the selected workspace, shared by every component
 * of the page: one request per workspace however many sections read it, and
 * the values a save changed patched in place so every section follows.
 */
export const useWorkspaceFlat = () => {
  const { $authFetch } = useAuthFetch()
  const { fallbackLocale } = useI18n()
  const { selectedWorkspace } = useI18nWorkspaces()
  const store = useFlatStore()

  const baseLocale = computed(() => resolveDefaultLocale(fallbackLocale.value))
  const flat = computed(
    () => store.entries.value[selectedWorkspace.value] ?? EMPTY_FLAT,
  )
  const isLoading = computed(
    () => store.pending.value[selectedWorkspace.value] === true,
  )
  const hasError = computed(
    () => store.failed.value[selectedWorkspace.value] === true,
  )
  const isLoaded = computed(
    () => store.entries.value[selectedWorkspace.value] !== undefined,
  )

  async function request(workspace: string): Promise<void> {
    store.pending.value = { ...store.pending.value, [workspace]: true }
    try {
      const response = await $authFetch<Partial<FlatTranslations>>(
        FLAT_ENDPOINT,
        { query: { workspace, defaultLocale: baseLocale.value } },
      )
      store.entries.value = {
        ...store.entries.value,
        [workspace]: { ...EMPTY_FLAT, ...response },
      }
      store.failed.value = { ...store.failed.value, [workspace]: false }
    } catch {
      store.failed.value = { ...store.failed.value, [workspace]: true }
    } finally {
      store.pending.value = { ...store.pending.value, [workspace]: false }
      requests.delete(workspace)
    }
  }

  function load(force = false): Promise<void> {
    const workspace = selectedWorkspace.value
    if (!workspace) return Promise.resolve()
    const running = requests.get(workspace)
    if (running) return running
    if (!force && store.entries.value[workspace]) return Promise.resolve()
    const next = request(workspace)
    requests.set(workspace, next)
    return next
  }

  function update(workspace: string, change: (flat: FlatTranslations) => void) {
    const current = store.entries.value[workspace]
    if (!current) return
    const next = cloneFlat(current)
    change(next)
    store.entries.value = {
      ...store.entries.value,
      [workspace]: refreshCounts(next),
    }
  }

  onMounted(() => load())
  watch(selectedWorkspace, () => load())

  return {
    flat,
    baseLocale,
    isLoading,
    isLoaded,
    hasError,
    load,
    reload: () => load(true),
    update,
  }
}
