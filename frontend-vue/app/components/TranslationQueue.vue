<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import { useDmsRouter } from '#dms/frontend-module'
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue'
import type { FlatTranslationRow } from '../types/lang'
import {
  coveragePercent,
  formatTokens,
  missingPlaceholders,
  placeholdersOf,
  stringValue,
} from '../utils/translations'
import LocaleTile from '../build/components/LocaleTile.vue'
import PlaceholderText from '../build/components/PlaceholderText.vue'

const UP_NEXT = 4
const CONTEXT_LANGUAGES = 2
const JSON_INDENT = 2

const { t } = useI18n()
const { formatCount } = useLangFormat()
const { selectedWorkspace, upsertKey, exportWorkspace } = useI18nWorkspaces()
const { flat, isLoaded, update } = useWorkspaceFlat()
const { canEditValues, canManage } = useWorkspaceContext()
const { nativeName } = useLocaleNames()
const { reportFailure } = useMutationToast()
const { removeLanguage, makeBase } = useLanguageActions()
const { downloadFile } = useWorkspaceActions()
const links = useLangLinks()
const router = useDmsRouter()
const { locale, baseLocale, isBase, exists, mode, namespace, queue, counts } =
  useLanguageQueue()

const position = ref(0)
const draft = ref('')
const isSaving = ref(false)

const current = computed<FlatTranslationRow | undefined>(
  () => queue.value[position.value],
)
const baseText = computed(() =>
  stringValue(current.value?.values[baseLocale.value]),
)
const issues = computed(() => missingPlaceholders(baseText.value, draft.value))
const tokens = computed(() => placeholdersOf(baseText.value))
const upNext = computed(() =>
  queue.value.slice(position.value + 1, position.value + 1 + UP_NEXT),
)
const contextLocales = computed(() =>
  flat.value.locales
    .filter((code) => code !== baseLocale.value && code !== locale.value)
    .filter((code) => stringValue(current.value?.values[code]))
    .slice(0, CONTEXT_LANGUAGES),
)
const progress = computed(() =>
  queue.value.length
    ? coveragePercent(position.value, queue.value.length)
    : 100,
)
const modeItems = computed(() => [
  {
    label: t('dms_lang.queue.mode_missing', {
      count: formatCount(counts.value.missing),
    }),
    value: 'missing',
  },
  {
    label: t('dms_lang.queue.mode_issues', {
      count: formatCount(counts.value.issues),
    }),
    value: 'issues',
  },
  {
    label: t('dms_lang.queue.mode_all', {
      count: formatCount(counts.value.all),
    }),
    value: 'all',
  },
])
const languageName = computed(() => nativeName(locale.value))

watch(
  () => current.value?.key,
  () => {
    draft.value = stringValue(current.value?.values[locale.value])
  },
  { immediate: true },
)
watch([mode, namespace, locale], () => {
  position.value = 0
})

function move(step: number) {
  const next = position.value + step
  if (next < 0 || next >= queue.value.length) return
  position.value = next
}

async function save() {
  const row = current.value
  if (!row || isSaving.value) return
  if (draft.value === stringValue(row.values[locale.value])) return move(1)
  isSaving.value = true
  const value = draft.value
  try {
    await upsertKey(
      selectedWorkspace.value,
      row.key,
      { [locale.value]: value },
      baseLocale.value,
    )
    update(selectedWorkspace.value, (next) => {
      const target = next.rows.find((entry) => entry.key === row.key)
      if (target) target.values[locale.value] = value === '' ? undefined : value
    })
    if (queue.value[position.value]?.key === row.key) move(1)
  } catch (error) {
    reportFailure(error, {
      title: t('dms_lang.matrix.save_failed', {
        key: row.key,
        code: locale.value,
      }),
      retry: save,
    })
  } finally {
    isSaving.value = false
  }
}

function insertToken(token: string) {
  const spacer = draft.value && !draft.value.endsWith(' ') ? ' ' : ''
  draft.value = `${draft.value}${spacer}{${token}}`
}

async function download() {
  try {
    const messages = await exportWorkspace(selectedWorkspace.value)
    downloadFile(
      `${locale.value}.json`,
      JSON.stringify(messages[locale.value] ?? {}, null, JSON_INDENT),
      'application/json',
    )
  } catch (error) {
    reportFailure(error, { title: t('dms_lang.errors.export_failed') })
  }
}

async function remove() {
  if (await removeLanguage(locale.value)) await router.push(links.overview())
}

function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target.closest('input, textarea, [contenteditable]')) return
  if (event.key === 's') move(1)
}

usePageHeaderActions(() => [
  h(UButton, {
    label: t('dms_lang.queue.open_matrix'),
    icon: 'i-ph-table',
    color: 'neutral',
    variant: 'outline',
    to: links.translations({
      locale: locale.value,
      missingIn: isBase.value ? undefined : locale.value,
      filter: isBase.value ? undefined : 'missing',
    }),
  }),
  exists.value
    ? h(UButton, {
        label: t('dms_lang.queue.download', { file: `${locale.value}.json` }),
        icon: 'i-ph-download-simple',
        color: 'neutral',
        variant: 'outline',
        onClick: download,
      })
    : null,
  canManage.value && exists.value && !isBase.value
    ? h(
        UDropdownMenu,
        {
          items: [
            [
              {
                label: t('dms_lang.languages.make_base'),
                icon: 'i-ph-star',
                onSelect: () => makeBase(locale.value),
              },
              {
                label: t('dms_lang.languages.remove'),
                icon: 'i-ph-trash',
                color: 'error',
                onSelect: remove,
              },
            ],
          ],
          content: { align: 'end' },
        },
        () =>
          h(UButton, {
            icon: 'i-ph-dots-three',
            color: 'neutral',
            variant: 'outline',
            'aria-label': t('dms_lang.queue.more'),
          }),
      )
    : null,
])

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <DmsCard v-if="!isLoaded" padded>
    <div class="space-y-4">
      <USkeleton class="h-5 w-1/3" />
      <USkeleton class="h-14 w-full" />
      <USkeleton class="h-24 w-full" />
    </div>
  </DmsCard>

  <DmsEmptyState
    v-else-if="!exists"
    variant="no-result"
    size="lg"
    hatched
    :title="$t('dms_lang.queue.unknown_title', { code: locale })"
    :description="
      $t('dms_lang.queue.unknown_description', { workspace: selectedWorkspace })
    "
    :actions="[
      {
        label: $t('dms_lang.queue.back'),
        icon: 'i-ph-arrow-left',
        color: 'neutral',
        variant: 'outline',
        to: links.overview(),
      },
    ]"
  />

  <DmsEmptyState
    v-else-if="isBase"
    icon="i-ph-star"
    tone="primary"
    size="lg"
    hatched
    :title="$t('dms_lang.queue.base_title', { name: languageName })"
    :description="$t('dms_lang.queue.base_description')"
    :actions="[
      {
        label: $t('dms_lang.queue.open_matrix'),
        icon: 'i-ph-table',
        color: 'neutral',
        variant: 'outline',
        to: links.translations(),
      },
    ]"
  />

  <DmsCard v-else :padded="false">
    <div
      class="border-default flex flex-wrap items-center gap-3 border-b px-4 py-3"
    >
      <DmsEyebrow :label="$t('dms_lang.queue.title')" size="xs" />
      <span class="text-muted font-mono text-xs">
        {{
          queue.length
            ? $t('dms_lang.queue.position', {
                current: formatCount(position + 1),
                total: formatCount(queue.length),
              })
            : '—'
        }}
      </span>
      <DmsMeter
        class="min-w-24 flex-1"
        :value="progress"
        :max="100"
        format="none"
        size="xs"
        tone="primary"
      />
      <DmsSegmented v-model="mode" :items="modeItems" size="xs" />
    </div>

    <DmsEmptyState
      v-if="!current"
      icon="i-ph-check-circle"
      tone="success"
      size="lg"
      :title="
        mode === 'issues'
          ? $t('dms_lang.queue.no_issues_title')
          : $t('dms_lang.queue.done_title', { name: languageName })
      "
      :description="
        mode === 'issues'
          ? $t('dms_lang.queue.no_issues_description')
          : $t('dms_lang.queue.done_description', {
              count: formatCount(flat.totalKeys),
              name: languageName,
            })
      "
      :actions="[
        {
          label: $t('dms_lang.queue.back'),
          color: 'neutral',
          variant: 'outline',
          to: links.overview(),
        },
        ...(mode !== 'issues'
          ? [
              {
                label: $t('dms_lang.queue.review_issues', {
                  count: counts.issues,
                }),
                color: 'neutral',
                variant: 'ghost',
                onClick: () => (mode = 'issues'),
              },
            ]
          : []),
      ]"
    />

    <template v-else>
      <div class="space-y-4 px-4 py-4">
        <div class="flex items-center gap-2">
          <UIcon name="i-ph-key" class="text-dimmed size-4" />
          <span class="break-all font-mono text-xs">
            <span class="text-dimmed">
              {{ current.key.slice(0, current.key.lastIndexOf('.') + 1) }}
            </span>
            <span class="text-primary font-semibold">
              {{ current.key.slice(current.key.lastIndexOf('.') + 1) }}
            </span>
          </span>
          <DmsStatusPill
            dot="none"
            v-if="baseText.length > 80"
            tone="neutral"
            size="sm"
            class="ml-auto"
            :label="$t('dms_lang.queue.long_text')"
          />
        </div>

        <div class="space-y-1.5">
          <div class="flex items-center gap-2 text-sm">
            <LocaleTile :code="baseLocale" size="sm" is-base />
            <span class="text-highlighted font-medium">
              {{ nativeName(baseLocale) }}
            </span>
            <span class="text-dimmed text-xs">
              {{ $t('dms_lang.common.base') }}
            </span>
          </div>
          <div
            class="border-default bg-(--dms-bg-muted) rounded-md border px-3.5 py-3 text-base"
          >
            <PlaceholderText
              v-if="baseText"
              :text="baseText"
              class="text-highlighted"
            />
            <span v-else class="text-dimmed italic">
              {{ $t('dms_lang.queue.no_base') }}
            </span>
          </div>
        </div>

        <div v-if="contextLocales.length" class="space-y-1">
          <DmsEyebrow :label="$t('dms_lang.queue.context')" size="xs" />
          <p
            v-for="code in contextLocales"
            :key="code"
            class="text-muted flex items-start gap-2 text-sm"
          >
            <LocaleTile :code="code" size="sm" />
            <span>{{ stringValue(current.values[code]) }}</span>
          </p>
        </div>

        <div class="space-y-1.5">
          <div class="flex items-center gap-2 text-sm">
            <LocaleTile :code="locale" size="sm" />
            <span class="text-highlighted font-medium">{{ languageName }}</span>
            <span class="text-dimmed font-mono text-xs">{{ locale }}</span>
            <span v-if="tokens.length" class="ml-auto text-xs">
              <span
                v-if="issues.length && draft"
                class="text-error inline-flex items-center gap-1"
              >
                <UIcon name="i-ph-warning" class="size-3.5" />
                {{
                  $t('dms_lang.matrix.placeholder_missing', {
                    tokens: formatTokens(issues),
                  })
                }}
              </span>
              <span
                v-else-if="draft"
                class="text-success inline-flex items-center gap-1"
              >
                <UIcon name="i-ph-check" class="size-3.5" />
                {{
                  $t('dms_lang.queue.uses', { tokens: formatTokens(tokens) })
                }}
              </span>
              <span v-else class="text-dimmed inline-flex items-center gap-1">
                <UIcon name="i-ph-brackets-curly" class="size-3.5" />
                {{
                  $t('dms_lang.queue.needs', { tokens: formatTokens(tokens) })
                }}
              </span>
            </span>
          </div>
          <UTextarea
            v-model="draft"
            :rows="3"
            autoresize
            :maxrows="12"
            autofocus
            class="w-full"
            :disabled="!canEditValues"
            :color="issues.length && draft ? 'error' : 'primary'"
            :highlight="true"
            :placeholder="baseText"
            :ui="{ base: 'text-base' }"
            @keydown.meta.enter.prevent="save"
            @keydown.ctrl.enter.prevent="save"
          />
          <div
            v-if="issues.length && draft && canEditValues"
            class="flex flex-wrap gap-1.5"
          >
            <UButton
              v-for="token in issues"
              :key="token"
              size="xs"
              color="error"
              variant="soft"
              :label="
                $t('dms_lang.drawer.insert', { token: formatTokens([token]) })
              "
              @click="insertToken(token)"
            />
          </div>
        </div>
      </div>

      <div class="border-default flex items-center gap-2 border-t px-4 py-3">
        <UButton
          icon="i-ph-arrow-left"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="position === 0"
          :label="$t('dms_lang.queue.previous')"
          @click="move(-1)"
        />
        <div class="flex-1" />
        <UButton color="neutral" variant="outline" size="sm" @click="move(1)">
          {{ $t('dms_lang.queue.skip') }}
          <UKbd size="sm">S</UKbd>
        </UButton>
        <UButton
          v-if="canEditValues"
          icon="i-ph-check"
          size="sm"
          :loading="isSaving"
          @click="save"
        >
          {{ $t('dms_lang.queue.save_next') }}
          <UKbd size="sm">⌘↵</UKbd>
        </UButton>
      </div>

      <ul
        v-if="upNext.length"
        class="border-default divide-default divide-y border-t"
      >
        <li
          v-for="(row, offset) in upNext"
          :key="row.key"
          class="grid grid-cols-[4rem_minmax(0,16rem)_minmax(0,1fr)] items-center gap-3 px-4 py-2"
        >
          <DmsEyebrow
            v-if="offset === 0"
            :label="$t('dms_lang.queue.up_next')"
            size="xs"
          />
          <span v-else />
          <button
            type="button"
            class="hover:text-primary truncate text-left font-mono text-xs"
            @click="position = position + offset + 1"
          >
            {{ row.key }}
          </button>
          <span class="text-muted truncate text-sm">
            {{ stringValue(row.values[baseLocale]) }}
          </span>
        </li>
      </ul>
    </template>
  </DmsCard>
</template>
