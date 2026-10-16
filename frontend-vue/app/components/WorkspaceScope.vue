<script setup lang="ts">
import { useLangChanges } from '../composables/translation/useWorkspaceFlat'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { WorkspaceSummary } from '../types/lang'
import LocaleTile from '../build/components/LocaleTile.vue'

/** Marks the workspace shown in the menu. */
const CURRENT_ICON = 'i-ph-check'
/** From this many workspaces on, the menu gets a filter field. */
const MENU_FILTER_THRESHOLD = 7
const MENU_FILTER_FIELDS = ['label', 'description', 'workspaceId', 'summary']

const { t } = useI18n()
const { formatCount } = useLangFormat()
const { workspaces, editable, isLoaded, whenLoaded } = useI18nWorkspaces()
const {
  current,
  isEditable,
  isModules,
  isAdded,
  isUnknown,
  isResolved,
} = useWorkspaceContext()
useLangChanges()
const {
  switchLink,
  queryWorkspace,
  pageAction,
  clearPageAction,
  currentPage,
} = useWorkspaceRoute()

/** What the bar says about the workspace shown, from the workspace list. */
const scope = computed(() => ({
  locales: current.value?.locales ?? [],
  totalKeys: current.value?.totalKeys ?? 0,
  baseMissing: current.value?.baseMissing ?? 0,
  defaultLocale: current.value?.defaultLocale ?? '',
}))
const links = useLangLinks()
const { nativeName } = useLocaleNames()
const { addLanguage } = useLanguageActions()
const { typeIcon, typeLabel, kindIcon } = useWorkspaceTypes()

function workspaceLabel(workspace: WorkspaceSummary | null): string {
  if (!workspace) return ''
  return t(`dms_lang.workspace_kinds.${workspace.kind}.label`, {
    name: workspace.id,
  })
}

function trailingIconOf(workspace: WorkspaceSummary): string | undefined {
  if (workspace.id === current.value?.id) return CURRENT_ICON
  return workspace.editable ? undefined : 'i-ph-lock-simple'
}

/** What the workspace serves (its type), else its kind, and its languages. */
function workspaceDetail(workspace: WorkspaceSummary): string {
  const count = workspace.locales.length
  const kind = workspace.type
    ? typeLabel(workspace.type)
    : t(`dms_lang.workspace_kinds.${workspace.kind}.kind`)
  return t('dms_lang.scope.menu_detail', { kind, count }, count)
}

const switchItems = computed<DropdownMenuItem[]>(() => [
  { type: 'label', label: t('dms_lang.scope.switch') },
  ...workspaces.value.map((workspace) => ({
    label: workspaceLabel(workspace),
    description: workspaceDetail(workspace),
    icon: workspace.type ? typeIcon(workspace.type) : kindIcon(workspace.kind),
    slot: 'workspace' as const,
    trailingIcon: trailingIconOf(workspace),
    to: switchLink(workspace.id),
    workspaceId: workspace.id,
    summary: workspace.description ?? '',
  })),
])

const menuFilter = computed(() =>
  workspaces.value.length >= MENU_FILTER_THRESHOLD
    ? { placeholder: t('dms_lang.scope.filter') }
    : false,
)

const manageItems = computed<DropdownMenuItem[]>(() => [
  ...(current.value && currentPage.value !== 'workspace'
    ? [
        {
          label: t('dms_lang.scope.settings', {
            name: workspaceLabel(current.value),
          }),
          icon: 'i-ph-sliders-horizontal',
          to: links.workspaceSettings(),
        },
      ]
    : []),
  {
    label: t('dms_lang.scope.manage'),
    icon: 'i-ph-gear-six',
    to: links.workspaces(),
  },
  ...(editable.value
    ? [
        {
          label: t('dms_lang.workspaces.new'),
          icon: 'i-ph-plus',
          to: links.workspaces({
            [PAGE_ACTION_QUERY]: PAGE_ACTIONS.newWorkspace,
          }),
        },
      ]
    : []),
])

const menuItems = computed(() => [switchItems.value, manageItems.value])

const hint = computed(() => {
  if (isAdded.value) {
    return t('dms_lang.scope.hint_added', {
      url: links.publicLocaleUrl(current.value?.id ?? ''),
    })
  }
  return current.value
    ? t(`dms_lang.workspace_kinds.${current.value.kind}.hint`)
    : ''
})

const showReadOnlyServer = computed(
  () => isLoaded.value && !editable.value && !isModules.value,
)

const baseMissingLink = computed(() => links.translations({ filter: 'issues' }))

const addKeyLink = computed(() =>
  links.translations({ [PAGE_ACTION_QUERY]: PAGE_ACTIONS.addKey }),
)

const hasNoKey = useFirstRun()
const isFirstRun = computed(
  () => currentPage.value === 'overview' && hasNoKey.value,
)
const firstRunSteps = computed(() => [
  {
    id: 'created',
    label: t('dms_lang.first_run.created', {
      base: nativeName(scope.value.defaultLocale),
    }),
    state: 'ok' as const,
  },
  {
    id: 'keys',
    label: t('dms_lang.first_run.keys'),
    state: 'pending' as const,
  },
  {
    id: 'languages',
    label: t('dms_lang.first_run.languages'),
    state:
      scope.value.locales.length > 1 ? ('ok' as const) : ('pending' as const),
  },
])
const firstRunActions = computed(() => [
  {
    label: t('dms_lang.first_run.add_key'),
    icon: 'i-ph-plus',
    to: addKeyLink.value,
  },
  {
    label: t('dms_lang.first_run.add_language'),
    color: 'neutral' as const,
    variant: 'outline' as const,
    onClick: () => void addLanguage(),
  },
])

if (import.meta.env.SSR && !queryWorkspace.value && !pageAction.value) {
  await whenLoaded()
}
useWorkspaceFill()

watch(
  [pageAction, isResolved],
  async ([action, resolved]) => {
    if (action !== PAGE_ACTIONS.addLanguage || !resolved) return
    await clearPageAction()
    await addLanguage()
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="!isUnknown" class="space-y-3">
    <div
      class="dms-card flex flex-wrap items-center gap-x-3.5 gap-y-2.5 py-2 pr-3.5 pl-2"
    >
      <UDropdownMenu
        :items="menuItems"
        :filter="menuFilter"
        :filter-fields="MENU_FILTER_FIELDS"
        :content="{ align: 'start' }"
        :ui="{ content: 'w-80' }"
      >
        <template #workspace-description="{ item }">
          <span
            v-if="item.summary"
            class="text-muted block truncate"
            :title="item.summary"
          >
            {{ item.summary }}
          </span>
          <span class="block truncate">{{ item.description }}</span>
        </template>
        <template #workspace-trailing="{ item }">
          <UIcon
            v-if="item.trailingIcon"
            :name="item.trailingIcon"
            class="size-4 shrink-0"
            :class="
              item.trailingIcon === CURRENT_ICON
                ? 'text-primary'
                : 'text-dimmed'
            "
          />
        </template>
        <button
          type="button"
          class="hover:bg-elevated/60 hover:border-default flex h-11 items-center gap-2.5 rounded-md border border-transparent pr-2.5 pl-1.5 text-left transition-colors"
          :aria-label="$t('dms_lang.scope.switch')"
        >
          <DmsIconWell
            :icon="current ? kindIcon(current.kind) : 'i-ph-stack'"
            :tone="!current ? 'neutral' : isEditable ? 'primary' : 'warning'"
            size="sm"
          />
          <span class="grid gap-px">
            <DmsEyebrow :label="$t('dms_lang.scope.workspace')" size="xs" />
            <USkeleton v-if="!current" class="h-4 w-24" />
            <span
              v-else
              class="text-highlighted text-sm leading-tight font-semibold"
            >
              {{ workspaceLabel(current) }}
            </span>
          </span>
          <UIcon name="i-ph-caret-up-down" class="text-dimmed ml-1 size-4" />
        </button>
      </UDropdownMenu>

      <span class="bg-border hidden h-7 w-px sm:block" />

      <div
        v-if="!isResolved"
        class="flex flex-wrap items-center gap-x-4 gap-y-1"
        aria-busy="true"
      >
        <USkeleton class="h-5 w-20 rounded-full" />
        <USkeleton class="h-4 w-24" />
        <USkeleton class="h-4 w-16" />
      </div>

      <div v-else class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <DmsStatusPill
          dot="none"
          :tone="isEditable ? 'success' : 'warning'"
          :icon="isEditable ? 'i-ph-pencil-simple' : 'i-ph-lock-simple'"
          :label="
            isEditable
              ? $t('dms_lang.scope.editable')
              : $t('dms_lang.scope.read_only')
          "
          size="sm"
        />
        <span class="text-muted">
          <b class="text-highlighted font-mono font-semibold">
            {{ formatCount(scope.locales.length) }}
          </b>
          {{ $t('dms_lang.scope.languages', scope.locales.length) }}
        </span>
        <span class="text-muted">
          <b class="text-highlighted font-mono font-semibold">
            {{ formatCount(scope.totalKeys) }}
          </b>
          {{ $t('dms_lang.scope.keys', scope.totalKeys) }}
        </span>
        <ULink
          v-if="scope.baseMissing"
          :to="baseMissingLink"
          class="text-warning inline-flex items-center gap-1 hover:underline"
        >
          <UIcon name="i-ph-warning" class="size-4" />
          {{
            $t(
              'dms_lang.scope.base_missing',
              { n: formatCount(scope.baseMissing) },
              scope.baseMissing,
            )
          }}
        </ULink>
        <span
          v-if="scope.defaultLocale"
          class="text-muted inline-flex items-center gap-1.5"
        >
          {{ $t('dms_lang.scope.base') }}
          <LocaleTile :code="scope.defaultLocale" size="sm" />
          <span class="font-mono text-xs">{{ scope.defaultLocale }}</span>
        </span>
      </div>

      <USkeleton v-if="!current" class="ml-auto h-3 w-40" />
      <p
        v-else
        class="text-dimmed ml-auto min-w-0 truncate font-mono text-xs"
        :title="hint"
      >
        {{ hint }}
      </p>
    </div>

    <DmsBanner
      v-if="showReadOnlyServer"
      tone="warning"
      size="sm"
      icon="i-ph-lock-simple"
      :title="$t('dms_lang.scope.server_read_only_title')"
      :description="$t('dms_lang.scope.server_read_only_description')"
    />

    <DmsCard v-if="isFirstRun" :padded="false">
      <DmsEmptyState
        icon="i-ph-rocket-launch"
        tone="primary"
        size="lg"
        :title="$t('dms_lang.first_run.title', { name: current?.id })"
        :description="$t('dms_lang.first_run.description')"
        :actions="firstRunActions"
      >
        <template #content>
          <DmsCheckList size="sm" :items="firstRunSteps" />
        </template>
      </DmsEmptyState>
    </DmsCard>
  </div>
</template>

