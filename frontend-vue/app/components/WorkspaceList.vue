<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import { useDmsRouter } from '#dms/frontend-module'
import type { WorkspaceStats } from '../types/lang'
import {
  COVERAGE_TEXT_CLASSES,
  coverageTone,
  resolveDefaultLocale,
} from '../utils/translations'
import LocaleTile from '../build/components/LocaleTile.vue'

interface WorkspaceStat {
  id: string
  label: string
  value: string
  tone?: string
}

const KIND_ICONS: Record<WorkspaceStats['kind'], string> = {
  default: 'i-ph-file-code',
  added: 'i-ph-stack',
  modules: 'i-ph-puzzle-piece',
}
const EDITABLE_CONFIG = `"dms-lang": {\n  config: { editable: true },\n}`

const { t } = useI18n()
const { formatCount } = useLangFormat()
const { fallbackLocale } = useI18n()
const { fetchSummary, selectedWorkspace, editable, fetchWorkspaces } =
  useI18nWorkspaces()
const { createWorkspace } = useWorkspaceActions()
const { pageAction, clearPageAction } = useWorkspaceRoute()
const links = useLangLinks()
const router = useDmsRouter()

const summary = ref<WorkspaceStats[]>([])
const isLoaded = ref(false)
const hasError = ref(false)
const isLoading = ref(false)

async function load() {
  isLoading.value = true
  try {
    const response = await fetchSummary(
      resolveDefaultLocale(fallbackLocale.value),
    )
    summary.value = response?.workspaces ?? []
    editable.value = response?.editable ?? false
    hasError.value = false
    isLoaded.value = true
  } catch {
    hasError.value = true
  } finally {
    isLoading.value = false
  }
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

function localeCodes(workspace: WorkspaceStats): string[] {
  const codes = workspace.locales.map((entry) => entry.code)
  return [
    ...codes.filter((code) => code === workspace.baseLocale),
    ...codes.filter((code) => code !== workspace.baseLocale),
  ]
}

async function open(workspace: WorkspaceStats) {
  selectedWorkspace.value = workspace.id
  await router.push(
    workspace.kind === 'modules' ? links.translations() : links.overview(),
  )
}

async function create() {
  const created = await createWorkspace()
  if (!created) return
  await load()
}

usePageHeaderActions(() =>
  editable.value
    ? h(UButton, {
        label: t('dms_lang.workspaces.new'),
        icon: 'i-ph-plus',
        onClick: create,
      })
    : null,
)

watch(
  [pageAction, isLoaded],
  async ([action, loaded]) => {
    if (action !== PAGE_ACTIONS.newWorkspace || !loaded) return
    await clearPageAction()
    if (editable.value) await create()
  },
  { immediate: true },
)

onMounted(() => {
  load()
  fetchWorkspaces()
})
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
        v-for="workspace in summary"
        :key="workspace.id"
        :padded="false"
        :selected="workspace.id === selectedWorkspace"
      >
        <div class="space-y-4 p-4">
          <div class="flex items-start gap-3">
            <DmsIconWell
              :icon="KIND_ICONS[workspace.kind]"
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
                  :tone="workspace.kind === 'modules' ? 'warning' : 'neutral'"
                  size="sm"
                  :icon="
                    workspace.kind === 'modules'
                      ? 'i-ph-lock-simple'
                      : undefined
                  "
                  :label="$t(`dms_lang.workspace_kinds.${workspace.kind}.kind`)"
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
              <p class="text-muted mt-0.5 text-xs">
                {{
                  $t(`dms_lang.workspace_kinds.${workspace.kind}.description`)
                }}
              </p>
            </div>
            <UButton
              v-if="workspace.kind === 'added'"
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
              class="border-default inline-flex items-center gap-1.5 rounded-md border py-0.5 pl-0.5 pr-2 font-mono text-xs"
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
              <DmsStatusPill tone="success" size="sm" label="GET" dot="none" />
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
              :label="
                workspace.id === selectedWorkspace
                  ? $t('dms_lang.workspaces.open')
                  : workspace.kind === 'modules'
                    ? $t('dms_lang.workspaces.browse')
                    : $t('dms_lang.workspaces.switch')
              "
              @click="open(workspace)"
            />
          </div>
        </template>
      </DmsCard>

      <button
        v-if="isLoaded && editable"
        type="button"
        class="border-default text-muted hover:border-primary/50 hover:text-highlighted rounded-(--dms-radius-card) flex min-h-56 flex-col items-center justify-center gap-3 border border-dashed p-6 text-center transition-colors"
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
