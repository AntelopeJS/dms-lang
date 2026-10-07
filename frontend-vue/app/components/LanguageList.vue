<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import UButton from '@nuxt/ui/components/Button.vue'
import type { LanguageCoverage } from '../types/lang'
import LocaleTile from '../build/components/LocaleTile.vue'
import { coverageTone, languageCoverage } from '../utils/translations'
import { isRightToLeft } from '../utils/languages'

type LanguageSort = 'coverage' | 'name'

const SKELETON_ROWS = 4

const SORTERS: Record<
  LanguageSort,
  (left: LanguageCoverage, right: LanguageCoverage) => number
> = {
  coverage: (left, right) => left.coverage - right.coverage,
  name: (left, right) => left.name.localeCompare(right.name),
}

const { t } = useI18n()
const { formatCount } = useLangFormat()
const { flat, isLoaded, isLoading, hasError, reload } = useWorkspaceFlat()
const { current, canManage, isModules, canEditValues } = useWorkspaceContext()
const { nativeName } = useLocaleNames()
const { addLanguage, removeLanguage, makeBase } = useLanguageActions()
const { pageAction, clearPageAction } = useWorkspaceRoute()
const links = useLangLinks()

const sort = ref<LanguageSort>('coverage')
const sortItems = computed(() => [
  { label: t('dms_lang.languages.sort_coverage'), value: 'coverage' },
  { label: t('dms_lang.languages.sort_name'), value: 'name' },
])

const languages = computed(() => {
  const all = languageCoverage(flat.value, nativeName)
  const base = all.filter((entry) => entry.isBase)
  const others = all.filter((entry) => !entry.isBase)
  return [...base, ...others.sort(SORTERS[sort.value])]
})

const totalMissing = computed(() =>
  languages.value
    .filter((entry) => !entry.isBase)
    .reduce((total, entry) => total + entry.missing, 0),
)
const isFirstRun = computed(
  () =>
    isLoaded.value &&
    current.value?.kind === 'added' &&
    flat.value.totalKeys === 0,
)

function menuOf(entry: LanguageCoverage): DropdownMenuItem[][] {
  const open = [
    {
      label: t('dms_lang.languages.open'),
      icon: 'i-ph-arrow-right',
      to: links.language(entry.code),
    },
  ]
  if (!canManage.value || entry.isBase) return [open]
  return [
    open,
    [
      {
        label: t('dms_lang.languages.make_base'),
        icon: 'i-ph-star',
        onSelect: () => makeBase(entry.code),
      },
      {
        label: t('dms_lang.languages.remove'),
        icon: 'i-ph-trash',
        color: 'error' as const,
        onSelect: () => removeLanguage(entry.code),
      },
    ],
  ]
}

usePageHeaderActions(() => [
  canManage.value
    ? h(UButton, {
        label: t('dms_lang.languages.add'),
        icon: 'i-ph-plus',
        color: 'neutral',
        variant: 'outline',
        onClick: () => addLanguage(),
      })
    : null,
  !isModules.value && totalMissing.value > 0
    ? h(UButton, {
        label: t('dms_lang.languages.translate_missing', {
          count: formatCount(totalMissing.value),
        }),
        icon: 'i-ph-translate',
        to: links.translations({ filter: 'missing' }),
      })
    : null,
])

watch(
  [pageAction, isLoaded],
  async ([action, loaded]) => {
    if (action !== PAGE_ACTIONS.addLanguage || !loaded) return
    await clearPageAction()
    await addLanguage()
  },
  { immediate: true },
)
</script>

<template>
  <DmsEmptyState
    v-if="hasError && !isLoaded"
    variant="error"
    hatched
    :title="$t('dms_lang.errors.load_title', { name: current?.id ?? '' })"
    :description="$t('dms_lang.errors.load_description')"
    :actions="[
      {
        label: $t('dms_lang.actions.retry'),
        icon: 'i-ph-arrow-clockwise',
        color: 'neutral',
        variant: 'outline',
        loading: isLoading,
        onClick: () => reload(),
      },
    ]"
  />

  <DmsCard v-else-if="isFirstRun" padded>
    <div
      class="mx-auto flex max-w-md flex-col items-center gap-4 py-8 text-center"
    >
      <DmsIconWell icon="i-ph-translate" tone="primary" size="xl" />
      <div class="space-y-1.5">
        <h3 class="text-highlighted text-base font-semibold">
          {{ $t('dms_lang.first_run.title', { name: current?.id }) }}
        </h3>
        <p class="text-muted text-sm">
          {{ $t('dms_lang.first_run.description') }}
        </p>
      </div>
      <DmsCheckList
        size="sm"
        :items="[
          {
            id: 'created',
            label: $t('dms_lang.first_run.created', {
              base: nativeName(flat.defaultLocale),
            }),
            state: 'ok',
          },
          {
            id: 'keys',
            label: $t('dms_lang.first_run.keys'),
            state: 'pending',
          },
          {
            id: 'languages',
            label: $t('dms_lang.first_run.languages'),
            state: flat.locales.length > 1 ? 'ok' : 'pending',
          },
        ]"
      />
      <div class="flex gap-2">
        <UButton
          icon="i-ph-plus"
          :label="$t('dms_lang.first_run.add_key')"
          :to="links.translations({ [PAGE_ACTION_QUERY]: PAGE_ACTIONS.addKey })"
        />
        <UButton
          color="neutral"
          variant="outline"
          :label="$t('dms_lang.languages.add')"
          @click="addLanguage()"
        />
      </div>
    </div>
  </DmsCard>

  <DmsCard
    v-else
    :padded="false"
    :title="$t('dms_lang.languages.title')"
    :count="isLoaded ? languages.length : undefined"
  >
    <template #actions>
      <DmsSegmented v-model="sort" :items="sortItems" size="xs" />
    </template>

    <div v-if="isModules" class="p-3">
      <DmsBanner
        tone="warning"
        size="sm"
        icon="i-ph-lock-simple"
        :title="$t('dms_lang.modules_notice.title')"
        :description="$t('dms_lang.modules_notice.description')"
      >
        <template #actions>
          <UButton
            size="xs"
            color="neutral"
            variant="outline"
            :label="$t('dms_lang.modules_notice.browse')"
            :to="links.translations()"
          />
        </template>
      </DmsBanner>
    </div>

    <ul class="divide-default divide-y">
      <template v-if="!isLoaded">
        <li
          v-for="index in SKELETON_ROWS"
          :key="index"
          class="flex items-center gap-3 px-4 py-3.5"
        >
          <USkeleton class="size-7 rounded-md" />
          <USkeleton class="h-4 w-32" />
          <USkeleton class="ml-auto h-1.5 w-40" />
          <USkeleton class="h-7 w-24" />
        </li>
      </template>
      <li
        v-for="entry in languages"
        v-else
        :key="entry.code"
        class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[auto_minmax(10rem,1fr)_minmax(8rem,12rem)_6.5rem_auto]"
      >
        <LocaleTile :code="entry.code" :is-base="entry.isBase" />
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-highlighted truncate text-sm font-semibold">
              {{ entry.name }}
            </span>
            <DmsStatusPill
              dot="none"
              v-if="entry.isBase"
              tone="neutral"
              size="sm"
              :label="$t('dms_lang.common.base')"
            />
            <DmsStatusPill
              dot="none"
              v-if="isRightToLeft(entry.code)"
              tone="neutral"
              size="sm"
              :label="$t('dms_lang.common.rtl')"
            />
          </div>
          <span class="text-dimmed font-mono text-xs">
            {{ entry.code }} ·
            {{
              entry.isBase
                ? $t('dms_lang.languages.strings', {
                    count: formatCount(entry.translated),
                  })
                : $t('dms_lang.languages.of_total', {
                    count: formatCount(entry.translated),
                    total: formatCount(flat.totalKeys),
                  })
            }}
          </span>
        </div>
        <DmsMeter
          class="col-span-3 md:col-span-1"
          :label="
            entry.isBase
              ? $t('dms_lang.languages.reference')
              : $t('dms_lang.languages.coverage')
          "
          :value="entry.coverage"
          :max="100"
          format="percent"
          size="sm"
          :tone="entry.isBase ? 'primary' : coverageTone(entry.coverage)"
        />
        <span
          class="hidden text-right font-mono text-xs md:block"
          :class="
            entry.missing > 0 && !entry.isBase ? 'text-warning' : 'text-dimmed'
          "
        >
          {{
            entry.isBase
              ? '—'
              : entry.missing > 0
                ? $t('dms_lang.languages.missing', {
                    count: formatCount(entry.missing),
                  })
                : $t('dms_lang.languages.complete')
          }}
        </span>
        <div
          class="col-start-3 row-start-1 flex items-center justify-end gap-1 md:col-start-auto md:row-start-auto"
        >
          <UButton
            v-if="entry.isBase || !canEditValues"
            size="sm"
            color="neutral"
            variant="ghost"
            trailing-icon="i-ph-arrow-right"
            :label="$t('dms_lang.languages.open')"
            :to="links.language(entry.code)"
          />
          <UButton
            v-else
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-ph-translate"
            :label="$t('dms_lang.languages.translate')"
            :to="links.language(entry.code)"
          />
          <UDropdownMenu :items="menuOf(entry)" :content="{ align: 'end' }">
            <UButton
              size="sm"
              color="neutral"
              variant="ghost"
              icon="i-ph-dots-three"
              :aria-label="$t('dms_lang.languages.more', { name: entry.name })"
            />
          </UDropdownMenu>
        </div>
      </li>
    </ul>

    <template v-if="canManage" #footer>
      <button
        type="button"
        class="text-muted hover:text-highlighted flex w-full items-center gap-3 text-left text-sm font-medium transition-colors"
        @click="addLanguage()"
      >
        <span
          class="border-default grid size-7 place-items-center rounded-md border border-dashed"
        >
          <UIcon name="i-ph-plus" class="size-4" />
        </span>
        {{ $t('dms_lang.languages.add') }}
        <span class="text-dimmed ml-auto text-xs font-normal">
          {{
            $t('dms_lang.languages.add_hint', {
              base: nativeName(flat.defaultLocale),
            })
          }}
        </span>
      </button>
    </template>
  </DmsCard>
</template>
