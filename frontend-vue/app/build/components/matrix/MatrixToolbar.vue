<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import type { TranslationFilter } from '../../../types/lang'
import type {
  MatrixCounts,
  MatrixFilterState,
} from '../../composables/useMatrixFilters'

interface LanguageItem {
  code: string
  name: string
}

interface Props {
  counts: MatrixCounts
  /** The target languages one can translate into. */
  languages: LanguageItem[]
  namespaces: string[]
  /** How many languages the counts look at. */
  countedLanguages: number
  /** The language shown next to the base when none is chosen (on a phone). */
  shownLanguage: string
  isCompact: boolean
}

const SEARCH_DELAY_MS = 200
const ANY_LANGUAGE = '*'
const ALL_NAMESPACES = '*'
const FILTER_LABELS: Record<TranslationFilter, string> = {
  all: 'dms_lang.matrix.filter_all',
  missing: 'dms_lang.matrix.filter_missing',
  complete: 'dms_lang.matrix.filter_complete',
  issues: 'dms_lang.matrix.filter_issues',
}

const props = defineProps<Props>()
const filters = defineModel<MatrixFilterState>('filters', { required: true })

const { t } = useI18n()
const { formatCount } = useLangFormat()

const searchInput = ref(filters.value.search)

const filterItems = computed(() =>
  (Object.keys(FILTER_LABELS) as TranslationFilter[]).map((value) => ({
    value,
    label: t(
      value === 'missing' && props.countedLanguages > 1
        ? 'dms_lang.matrix.filter_incomplete'
        : FILTER_LABELS[value],
      { count: formatCount(props.counts[value]) },
    ),
  })),
)
const languageItems = computed(() => [
  ...(props.isCompact
    ? []
    : [{ label: t('dms_lang.matrix.every_language'), value: ANY_LANGUAGE }]),
  ...props.languages.map((entry) => ({
    label: `${entry.name} · ${entry.code}`,
    value: entry.code,
  })),
])
const namespaceItems = computed(() => [
  {
    label: t('dms_lang.matrix.all_namespaces', {
      count: props.namespaces.length,
    }),
    value: ALL_NAMESPACES,
  },
  ...props.namespaces.map((namespace) => ({
    label: namespace,
    value: namespace,
  })),
])

const filterModel = computed({
  get: () => filters.value.filter,
  set: (filter: TranslationFilter) =>
    (filters.value = { ...filters.value, filter }),
})
const languageModel = computed({
  get: () => filters.value.missingIn || props.shownLanguage || ANY_LANGUAGE,
  set: (value: string) => {
    const missingIn = value === ANY_LANGUAGE ? '' : value
    filters.value = {
      ...filters.value,
      missingIn,
      filter: missingIn ? 'missing' : filters.value.filter,
    }
  },
})
const namespaceModel = computed({
  get: () => filters.value.namespace || ALL_NAMESPACES,
  set: (value: string) =>
    (filters.value = {
      ...filters.value,
      namespace: value === ALL_NAMESPACES ? '' : value,
    }),
})

watch(
  () => filters.value.search,
  (search) => {
    if (search !== searchInput.value.trim()) searchInput.value = search
  },
)

watchDebounced(
  searchInput,
  (value) => {
    if (value !== filters.value.search)
      filters.value = { ...filters.value, search: value }
  },
  { debounce: SEARCH_DELAY_MS },
)
</script>

<template>
  <div
    class="border-default gap-2 border-b p-3"
    :class="
      props.isCompact ? 'grid grid-cols-1' : 'flex flex-wrap items-center'
    "
  >
    <USelect
      v-if="props.isCompact"
      v-model="filterModel"
      :items="filterItems"
      size="sm"
      class="w-full"
      :aria-label="$t('dms_lang.matrix.filter_label')"
    />
    <DmsSegmented
      v-else
      v-model="filterModel"
      :items="filterItems"
      size="sm"
      :aria-label="$t('dms_lang.matrix.filter_label')"
    />
    <USelect
      v-model="languageModel"
      :items="languageItems"
      size="sm"
      :class="props.isCompact ? 'w-full' : 'w-56'"
      icon="i-ph-translate"
      :aria-label="$t('dms_lang.matrix.translate_into')"
    />
    <USelect
      v-model="namespaceModel"
      :items="namespaceItems"
      size="sm"
      :class="props.isCompact ? 'w-full' : 'w-44'"
      icon="i-ph-folder-simple"
      :aria-label="$t('dms_lang.matrix.namespace')"
    />
    <UInput
      v-model="searchInput"
      icon="i-ph-magnifying-glass"
      size="sm"
      :class="props.isCompact ? 'w-full' : 'min-w-48 flex-1'"
      :placeholder="$t('dms_lang.matrix.search')"
      :aria-label="$t('dms_lang.matrix.search')"
    />
    <slot />
  </div>
</template>
