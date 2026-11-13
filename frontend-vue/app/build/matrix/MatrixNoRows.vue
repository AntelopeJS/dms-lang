<script setup lang="ts">
import type { ButtonProps } from '@nuxt/ui'
import type { FlatTranslations } from '../../types/lang'
import type { MatrixFilterState } from '../composables/useMatrixFilters'

/**
 * The matrix with no row to show: no key matches the filters (show them all),
 * or the workspace has no key yet (add one).
 */
const props = defineProps<{
  flat: FlatTranslations
  filters: MatrixFilterState
  canManageKeys: boolean
  formatCount: (value: number) => string
  resetFilters: () => void
  addKey: () => unknown
}>()

const { t } = useI18n()

const description = computed(() => {
  const count = props.flat.rows.length
  if (!count) return t('dms_lang.matrix.no_keys_description')
  return t(
    'dms_lang.matrix.no_match_description',
    { count: props.formatCount(count) },
    count,
  )
})

const actions = computed((): ButtonProps[] => {
  const count = props.flat.rows.length
  const showAll: ButtonProps[] = count
    ? [
        {
          label: t(
            'dms_lang.matrix.show_all',
            { count: props.formatCount(count) },
            count,
          ),
          color: 'neutral',
          variant: 'outline',
          onClick: props.resetFilters,
        },
      ]
    : []
  const addNew: ButtonProps[] = props.canManageKeys
    ? [
        {
          label: props.filters.search
            ? t('dms_lang.matrix.add_named', { key: props.filters.search })
            : t('dms_lang.key_add.title'),
          icon: 'i-ph-plus',
          color: 'neutral',
          variant: 'ghost',
          onClick: () => props.addKey(),
        },
      ]
    : []
  return [...showAll, ...addNew]
})
</script>

<template>
  <DmsEmptyState
    :variant="flat.rows.length ? 'no-result' : 'no-data'"
    size="lg"
    hatched
    :title="
      flat.rows.length
        ? $t('dms_lang.matrix.no_match', { search: filters.search })
        : $t('dms_lang.matrix.no_keys')
    "
    :description="description"
    :actions="actions"
  />
</template>
