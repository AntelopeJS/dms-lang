<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { QUEUE_MODES } from '../../../composables/translation/useLanguageQueue'
import type { DraftGroup } from '../../../utils/queueDrafts'
import LocaleTile from '../LocaleTile.vue'
import { useQueue } from '../../composables/useQueueContext'

const SELECTED_ICON = 'i-ph-check'

const { t } = useI18n()
const { formatCount } = useLangFormat()
const { selectedWorkspace } = useI18nWorkspaces()
const { flat } = useWorkspaceFlat()
const { switchLink } = useWorkspaceRoute()
const { fullName, nativeName } = useLocaleNames()
const links = useLangLinks()
const { session, languageName, nameOf } = useQueue()
const { locale, baseLocale, mode, namespace, counts, drafts } = session

const modeItems = computed(() =>
  QUEUE_MODES.map((value) => ({
    label: t(`dms_lang.queue.mode_${value}`, {
      count: formatCount(counts.value[value]),
    }),
    value,
  })),
)

function countLabel(key: string, count: number): string {
  return t(key, { n: formatCount(count) }, count)
}

const remainingLabel = computed(() => {
  const remaining = countLabel(
    'dms_lang.queue.remaining',
    session.pending.value.length,
  )
  const skipped = session.skippedCount.value
  if (!skipped) return remaining
  return `${remaining} · ${countLabel('dms_lang.queue.skipped_count', skipped)}`
})

function draftCountOf(code: string): number {
  const group = drafts.groups.value.find(
    (entry) =>
      entry.workspace === selectedWorkspace.value && entry.locale === code,
  )
  return group?.count ?? 0
}

function languageStatus(code: string): string {
  if (code === baseLocale.value) return t('dms_lang.common.base')
  const missing = flat.value.localeMissing[code] ?? 0
  const status = countLabel('dms_lang.queue.language_missing', missing)
  const count = draftCountOf(code)
  if (!count) return status
  return `${status} · ${countLabel('dms_lang.queue.drafts_count', count)}`
}

const languageItems = computed<DropdownMenuItem[][]>(() => [
  [
    { type: 'label', label: t('dms_lang.queue.switch_language') },
    ...flat.value.locales.map((code) => ({
      label: `${fullName(code)} · ${code}`,
      description: languageStatus(code),
      trailingIcon: code === locale.value ? SELECTED_ICON : undefined,
      to: links.language(code),
    })),
  ],
])

function draftLink(group: DraftGroup) {
  const sameWorkspace = group.workspace === selectedWorkspace.value
  const where = sameWorkspace
    ? nameOf(group.locale)
    : `${group.workspace} · ${nativeName(group.locale)}`
  return {
    id: `${group.workspace}:${group.locale}`,
    label: `${where} (${formatCount(group.count)})`,
    to: sameWorkspace
      ? links.language(group.locale)
      : switchLink(group.workspace, {
          page: 'language',
          query: { locale: group.locale },
        }),
  }
}

/** Links back to the drafts left in other languages and workspaces. */
const draftLinks = computed(() => drafts.elsewhere.value.map(draftLink))
</script>

<template>
  <div class="border-default space-y-3 border-b px-4 py-3">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <LocaleTile :code="locale" :siblings="flat.locales" />
      <div class="grid min-w-0 gap-px">
        <DmsEyebrow :label="$t('dms_lang.queue.title')" size="xs" />
        <span class="text-highlighted truncate text-base font-semibold">
          {{ languageName }}
          <span class="text-dimmed font-mono text-xs font-normal">
            {{ locale }}
          </span>
        </span>
      </div>
      <UDropdownMenu
        :items="languageItems"
        :content="{ align: 'start' }"
        :ui="{ content: 'w-72' }"
      >
        <UButton
          icon="i-ph-caret-up-down"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="$t('dms_lang.queue.switch_language')"
        />
      </UDropdownMenu>
      <span class="text-muted ml-auto font-mono text-xs">
        {{ remainingLabel }}
      </span>
    </div>
    <div
      v-if="draftLinks.length"
      class="text-muted flex flex-wrap items-center gap-1.5 text-xs"
    >
      <UIcon name="i-ph-note-pencil" class="text-warning size-3.5" />
      <span>{{ $t('dms_lang.queue.drafts_elsewhere') }}</span>
      <UButton
        v-for="entry in draftLinks"
        :key="entry.id"
        size="xs"
        color="warning"
        variant="soft"
        :label="entry.label"
        :to="entry.to"
      />
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <DmsMeter
        class="min-w-24 flex-1"
        :value="session.progress.value"
        :max="100"
        format="none"
        size="xs"
        tone="primary"
      />
      <UButton
        v-if="namespace"
        size="xs"
        color="primary"
        variant="soft"
        trailing-icon="i-ph-x"
        class="font-mono"
        :label="namespace"
        :aria-label="$t('dms_lang.queue.scope_clear', { namespace })"
        @click="namespace = ''"
      />
      <DmsSegmented v-model="mode" :items="modeItems" size="xs" />
    </div>
  </div>
</template>
