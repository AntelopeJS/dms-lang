<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { WorkspaceSummary } from '../types/lang'
import LocaleTile from '../build/components/LocaleTile.vue'

const KIND_ICONS: Record<WorkspaceSummary['kind'], string> = {
  default: 'i-ph-file-code',
  added: 'i-ph-stack',
  modules: 'i-ph-puzzle-piece',
}

const { t } = useI18n()
const { formatCount } = useLangFormat()
const { workspaces, editable, isLoaded } = useI18nWorkspaces()
const { current, isEditable, isModules, isAdded } = useWorkspaceContext()
const { flat } = useWorkspaceFlat()
const { switchLink } = useWorkspaceRoute()
const links = useLangLinks()

function workspaceLabel(workspace: WorkspaceSummary | null): string {
  if (!workspace) return ''
  return t(`dms_lang.workspace_kinds.${workspace.kind}.label`, {
    name: workspace.id,
  })
}

function trailingIconOf(workspace: WorkspaceSummary): string | undefined {
  if (workspace.id === current.value?.id) return 'i-ph-check'
  return workspace.editable ? undefined : 'i-ph-lock-simple'
}

function workspaceDetail(workspace: WorkspaceSummary): string {
  const count = workspace.locales.length
  return t(
    'dms_lang.scope.menu_detail',
    { kind: t(`dms_lang.workspace_kinds.${workspace.kind}.kind`), count },
    count,
  )
}

const menuItems = computed<DropdownMenuItem[][]>(() => [
  [
    { type: 'label', label: t('dms_lang.scope.switch') },
    ...workspaces.value.map((workspace) => ({
      label: workspaceLabel(workspace),
      description: workspaceDetail(workspace),
      icon: KIND_ICONS[workspace.kind],
      trailingIcon: trailingIconOf(workspace),
      to: switchLink(workspace.id),
    })),
  ],
  [
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
  ],
])

const hint = computed(() => {
  if (isAdded.value) {
    return t('dms_lang.scope.hint_added', {
      url: links.publicLocaleUrl(current.value?.id ?? ''),
    })
  }
  return t(`dms_lang.workspace_kinds.${current.value?.kind ?? 'default'}.hint`)
})

const showReadOnlyServer = computed(
  () => isLoaded.value && !editable.value && !isModules.value,
)
</script>

<template>
  <div class="space-y-3">
    <div
      class="dms-card flex flex-wrap items-center gap-x-3.5 gap-y-2.5 py-2 pl-2 pr-3.5"
    >
      <UDropdownMenu
        :items="menuItems"
        :content="{ align: 'start' }"
        :ui="{ content: 'w-80' }"
      >
        <button
          type="button"
          class="hover:bg-elevated/60 hover:border-default flex h-11 items-center gap-2.5 rounded-md border border-transparent pl-1.5 pr-2.5 text-left transition-colors"
          :aria-label="$t('dms_lang.scope.switch')"
        >
          <DmsIconWell
            :icon="current ? KIND_ICONS[current.kind] : 'i-ph-stack'"
            :tone="isEditable ? 'primary' : 'warning'"
            size="sm"
          />
          <span class="grid gap-px">
            <DmsEyebrow :label="$t('dms_lang.scope.workspace')" size="xs" />
            <USkeleton v-if="!current" class="h-4 w-24" />
            <span
              v-else
              class="text-highlighted text-sm font-semibold leading-tight"
            >
              {{ workspaceLabel(current) }}
            </span>
          </span>
          <UIcon name="i-ph-caret-up-down" class="text-dimmed ml-1 size-4" />
        </button>
      </UDropdownMenu>

      <span class="bg-border hidden h-7 w-px sm:block" />

      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
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
            {{ formatCount(flat.locales.length) }}
          </b>
          {{ $t('dms_lang.scope.languages', flat.locales.length) }}
        </span>
        <span class="text-muted">
          <b class="text-highlighted font-mono font-semibold">
            {{ formatCount(flat.totalKeys) }}
          </b>
          {{ $t('dms_lang.scope.keys', flat.totalKeys) }}
        </span>
        <span
          v-if="flat.defaultLocale"
          class="text-muted inline-flex items-center gap-1.5"
        >
          {{ $t('dms_lang.scope.base') }}
          <LocaleTile :code="flat.defaultLocale" size="sm" />
          <span class="font-mono text-xs">{{ flat.defaultLocale }}</span>
        </span>
      </div>

      <p
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
  </div>
</template>
