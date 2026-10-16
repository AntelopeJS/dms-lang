<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import type { WorkspaceKind, WorkspaceStats } from '../types/lang'
import { COVERAGE_TEXT_CLASSES, coverageTone } from '../utils/translations'
import {
  PUBLIC_URL_METHOD,
  matchesWorkspace,
  sortWorkspaces,
} from '../utils/workspaces'
import type { WorkspaceSort } from '../utils/workspaces'
import LocaleTile from '../build/components/LocaleTile.vue'
import { useWorkspaceSummary } from '../composables/translation/useI18nWorkspaces'

interface WorkspaceStat {
  id: string
  label: string
  value: string
  tone?: string
}

interface WorkspacePill {
  tone: 'neutral' | 'warning'
  icon?: string
  label: string
}

const EDITABLE_CONFIG = `"dms-lang": {\n  config: { editable: true },\n}`
/** Below this many workspaces, searching and sorting them is noise. */
const TOOLBAR_THRESHOLD = 4
/** The sort picked last, a user preference the server render reads too. */
const SORT_PREFERENCE = 'dms-lang.workspaceSort'
const DEFAULT_SORT: WorkspaceSort = 'kind'
const OPEN_LABELS: Record<WorkspaceKind, string> = {
  default: 'dms_lang.workspaces.switch',
  added: 'dms_lang.workspaces.switch',
  modules: 'dms_lang.workspaces.browse',
}
const SORT_LABELS: Record<WorkspaceSort, string> = {
  kind: 'dms_lang.workspaces.sort_kind',
  name: 'dms_lang.workspaces.sort_name',
  coverage: 'dms_lang.workspaces.sort_coverage',
}

const { t } = useI18n()
const { formatCount } = useLangFormat()
const { selectedWorkspace, editable } = useI18nWorkspaces()
const { createWorkspace, importWorkspace } = useWorkspaceActions()
const { typeIcon, typeLabel, kindIcon } = useWorkspaceTypes()
const { pageAction, clearPageAction, selectWorkspace } = useWorkspaceRoute()
const { allows } = useWorkspaceContext()
const links = useLangLinks()
const { getPreference, setPreference } = usePreferences()

const canCreate = computed(() => editable.value && allows('createWorkspace'))

// The workspaces' figures, read with the page.
const summaryRead = useWorkspaceSummary()
const summary = computed<WorkspaceStats[]>(
  () => summaryRead.data.value?.workspaces ?? [],
)
const isLoaded = computed(() => summaryRead.data.value !== null)
const isLoading = computed(() => summaryRead.pending.value)
// A failure kept while it is tried again still shows the skeleton.
const hasError = computed(
  () => summaryRead.error.value != null && !isLoading.value,
)
const search = ref('')
const sort = computed<WorkspaceSort>({
  get: () => {
    const stored = getPreference<unknown>(SORT_PREFERENCE)
    return isWorkspaceSort(stored) ? stored : DEFAULT_SORT
  },
  set: (value) => setPreference(SORT_PREFERENCE, value),
})

const sortItems = computed(() =>
  (Object.keys(SORT_LABELS) as WorkspaceSort[]).map((value) => ({
    value,
    label: t(SORT_LABELS[value]),
  })),
)
const hasToolbar = computed(
  () => isLoaded.value && summary.value.length >= TOOLBAR_THRESHOLD,
)
const shown = computed(() =>
  sortWorkspaces(
    summary.value.filter((workspace) =>
      matchesWorkspace(workspace, search.value, labelsOf(workspace)),
    ),
    sort.value,
  ),
)

function isWorkspaceSort(value: unknown): value is WorkspaceSort {
  return typeof value === 'string' && Object.hasOwn(SORT_LABELS, value)
}

function load() {
  void summaryRead.refresh()
}

function statsOf(workspace: WorkspaceStats): WorkspaceStat[] {
  const last =
    workspace.kind === 'added'
      ? {
          id: 'missing',
          label: t('dms_lang.workspaces.stat_missing'),
          value: formatCount(workspace.missing),
          tone: workspace.missing ? 'text-warning' : undefined,
        }
      : {
          id: 'overrides',
          label: t(
            `dms_lang.workspaces.stat_${workspace.kind === 'modules' ? 'overridden' : 'overrides'}`,
          ),
          value: formatCount(workspace.overrides),
        }
  return [
    {
      id: 'languages',
      label: t('dms_lang.workspaces.stat_languages'),
      value: formatCount(workspace.locales.length),
    },
    {
      id: 'keys',
      label: t('dms_lang.workspaces.stat_keys'),
      value: formatCount(workspace.totalKeys),
    },
    {
      id: 'coverage',
      label: t('dms_lang.workspaces.stat_coverage'),
      value: `${formatCount(workspace.coverage)}%`,
    },
    last,
  ]
}

function kindPill(workspace: WorkspaceStats): WorkspacePill {
  if (workspace.type) {
    return {
      tone: 'neutral',
      icon: typeIcon(workspace.type),
      label: typeLabel(workspace.type),
    }
  }
  const isModules = workspace.kind === 'modules'
  return {
    tone: isModules ? 'warning' : 'neutral',
    icon: isModules ? 'i-ph-lock-simple' : undefined,
    label: t(`dms_lang.workspace_kinds.${workspace.kind}.kind`),
  }
}

function labelsOf(workspace: WorkspaceStats): string[] {
  return [
    kindPill(workspace).label,
    t(`dms_lang.workspace_kinds.${workspace.kind}.label`, {
      name: workspace.id,
    }),
  ]
}

function localeCodes(workspace: WorkspaceStats): string[] {
  const codes = workspace.locales.map((entry) => entry.code)
  return [
    ...codes.filter((code) => code === workspace.baseLocale),
    ...codes.filter((code) => code !== workspace.baseLocale),
  ]
}

/** What opening a workspace does: open the one shown, browse the modules, switch to another. */
function openLabel(workspace: WorkspaceStats): string {
  if (workspace.id === selectedWorkspace.value)
    return t('dms_lang.workspaces.open')
  return t(OPEN_LABELS[workspace.kind])
}

async function open(workspace: WorkspaceStats) {
  await selectWorkspace(workspace.id, {
    page: workspace.kind === 'modules' ? 'translations' : 'overview',
  })
}

function create() {
  return createWorkspace()
}

usePageHeaderActions(() =>
  canCreate.value
    ? h(UButton, {
        label: t('dms_lang.workspace_import.open'),
        icon: 'i-ph-upload-simple',
        color: 'neutral',
        variant: 'outline',
        onClick: importWorkspace,
      })
    : null,
  { order: -1 },
)

watch(
  [pageAction, isLoaded],
  async ([action, loaded]) => {
    if (action !== PAGE_ACTIONS.newWorkspace || !loaded) return
    await clearPageAction()
    if (canCreate.value) await create()
  },
  { immediate: true },
)

</script>

<template>
  <div class="space-y-4">
    <DmsBanner
      v-if="isLoaded && !editable"
      tone="info"
      icon="i-ph-lock-simple"
      :title="$t('dms_lang.workspaces.read_only_title')"
      :description="$t('dms_lang.workspaces.read_only_description')"
    >
      <template #actions>
        <DmsCopyButton :value="EDITABLE_CONFIG" />
      </template>
    </DmsBanner>

    <DmsEmptyState
      v-if="hasError && !isLoaded"
      variant="error"
      size="lg"
      hatched
      :title="$t('dms_lang.workspaces.load_error')"
      :description="$t('dms_lang.errors.load_description')"
      :actions="[
        {
          label: $t('dms_lang.actions.retry'),
          icon: 'i-ph-arrow-clockwise',
          color: 'neutral',
          variant: 'outline',
          loading: isLoading,
          onClick: () => load(),
        },
      ]"
    />

    <div v-if="hasToolbar" class="flex flex-wrap items-center gap-2">
      <UInput
        v-model="search"
        icon="i-ph-magnifying-glass"
        size="sm"
        class="min-w-48 flex-1"
        :placeholder="$t('dms_lang.workspaces.search')"
        :aria-label="$t('dms_lang.workspaces.search')"
      />
      <USelect
        v-model="sort"
        :items="sortItems"
        size="sm"
        class="w-56"
        icon="i-ph-sort-ascending"
        :aria-label="$t('dms_lang.workspaces.sort')"
      />
    </div>

    <DmsEmptyState
      v-if="isLoaded && summary.length && !shown.length"
      variant="no-result"
      size="lg"
      hatched
      icon="i-ph-magnifying-glass"
      :title="$t('dms_lang.workspaces.no_match', { search: search.trim() })"
      :actions="[
        {
          label: $t('dms_lang.workspaces.clear_search'),
          icon: 'i-ph-x',
          color: 'neutral',
          variant: 'outline',
          onClick: () => (search = ''),
        },
      ]"
    />

    <div class="grid gap-4 lg:grid-cols-2">
      <template v-if="!isLoaded && !hasError">
        <DmsCard v-for="index in 4" :key="index" padded>
          <div class="space-y-4">
            <USkeleton class="h-6 w-1/2" />
            <USkeleton class="h-10 w-full" />
            <USkeleton class="h-6 w-2/3" />
          </div>
        </DmsCard>
      </template>

      <DmsCard
        v-for="workspace in shown"
        :key="workspace.id"
        :padded="false"
        :selected="workspace.id === selectedWorkspace"
      >
        <div class="space-y-4 p-4">
          <div class="flex items-start gap-3">
            <DmsIconWell
              :icon="kindIcon(workspace.kind)"
              :tone="workspace.kind === 'modules' ? 'warning' : 'primary'"
              size="lg"
            />
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-highlighted truncate text-base font-semibold">
                  {{
                    $t(`dms_lang.workspace_kinds.${workspace.kind}.label`, {
                      name: workspace.id,
                    })
                  }}
                </h3>
                <DmsStatusPill
                  dot="none"
                  size="sm"
                  v-bind="kindPill(workspace)"
                />
                <DmsStatusPill
                  dot="none"
                  v-if="workspace.id === selectedWorkspace"
                  tone="primary"
                  size="sm"
                  icon="i-ph-check"
                  :label="$t('dms_lang.workspaces.current')"
                />
              </div>
              <p class="text-muted mt-0.5 line-clamp-2 text-xs">
                {{
                  workspace.description ||
                  $t(`dms_lang.workspace_kinds.${workspace.kind}.description`)
                }}
              </p>
            </div>
            <UButton
              size="sm"
              color="neutral"
              variant="outline"
              icon="i-ph-gear-six"
              :label="$t('dms_lang.workspaces.settings')"
              :to="links.workspaceSettings(workspace.id)"
            />
          </div>

          <dl class="grid grid-cols-4 gap-3">
            <div v-for="stat in statsOf(workspace)" :key="stat.id">
              <DmsEyebrow as="dt" :label="stat.label" size="xs" />
              <dd
                class="text-highlighted font-mono text-lg font-semibold"
                :class="stat.tone"
              >
                {{ stat.value }}
              </dd>
            </div>
          </dl>

          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="code in localeCodes(workspace)"
              :key="code"
              class="border-default inline-flex items-center gap-1.5 rounded-md border py-0.5 pr-2 pl-0.5 font-mono text-xs"
            >
              <LocaleTile
                :code="code"
                size="sm"
                :is-base="code === workspace.baseLocale"
              />
              {{ code }}
              <span v-if="code === workspace.baseLocale" class="text-dimmed">
                {{ $t('dms_lang.common.base') }}
              </span>
              <span
                v-else
                :class="
                  COVERAGE_TEXT_CLASSES[
                    coverageTone(workspace.localeProgress[code] ?? 0)
                  ]
                "
              >
                {{ Math.round(workspace.localeProgress[code] ?? 0) }}%
              </span>
            </span>
          </div>
        </div>

        <template #footer>
          <div class="flex items-center gap-2.5">
            <template v-if="workspace.kind === 'added'">
              <DmsStatusPill
                tone="success"
                size="sm"
                :label="PUBLIC_URL_METHOD"
                dot="none"
              />
              <code
                class="text-muted min-w-0 flex-1 truncate font-mono text-xs"
              >
                {{ links.publicLocaleUrl(workspace.id) }}
              </code>
              <DmsCopyButton :value="links.publicLocaleUrl(workspace.id)" />
            </template>
            <p
              v-else
              class="text-dimmed flex min-w-0 flex-1 items-center gap-1.5 text-xs"
            >
              <UIcon
                :name="
                  workspace.kind === 'modules' ? 'i-ph-info' : 'i-ph-folder'
                "
                class="size-3.5 shrink-0"
              />
              <span class="truncate">
                {{ $t(`dms_lang.workspace_kinds.${workspace.kind}.source`) }}
              </span>
            </p>
            <UButton
              size="sm"
              color="neutral"
              variant="ghost"
              trailing-icon="i-ph-arrow-right"
              :label="openLabel(workspace)"
              @click="open(workspace)"
            />
          </div>
        </template>
      </DmsCard>

      <button
        v-if="isLoaded && canCreate"
        type="button"
        class="border-default text-muted hover:border-primary/50 hover:text-highlighted flex min-h-56 flex-col items-center justify-center gap-3 rounded-(--dms-radius-card) border border-dashed p-6 text-center transition-colors"
        @click="create"
      >
        <DmsIconWell icon="i-ph-plus" tone="primary" size="lg" />
        <span class="text-highlighted text-sm font-semibold">
          {{ $t('dms_lang.workspaces.new') }}
        </span>
        <span class="max-w-xs text-xs">
          {{ $t('dms_lang.workspaces.new_hint') }}
        </span>
      </button>
    </div>
  </div>
</template>
