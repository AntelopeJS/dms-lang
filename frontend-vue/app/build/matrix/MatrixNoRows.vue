<script setup lang="ts">
import type { FlatTranslations } from '../../types/lang'
import type { MatrixFilterState } from '../composables/useMatrixFilters'

/**
 * The matrix with no row to show: no key matches the filters (show them all),
 * or the workspace has no key yet (add one).
 */
defineProps<{
  flat: FlatTranslations
  filters: MatrixFilterState
  canManageKeys: boolean
  formatCount: (value: number) => string
  resetFilters: () => void
  addKey: () => unknown
}>()
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
    :description="
      flat.rows.length
        ? $t(
            'dms_lang.matrix.no_match_description',
            { count: formatCount(flat.rows.length) },
            flat.rows.length,
          )
        : $t('dms_lang.matrix.no_keys_description')
    "
    :actions="[
      ...(flat.rows.length
        ? [
            {
              label: $t(
                'dms_lang.matrix.show_all',
                { count: formatCount(flat.rows.length) },
                flat.rows.length,
              ),
              color: 'neutral',
              variant: 'outline',
              onClick: resetFilters,
            },
          ]
        : []),
      ...(canManageKeys
        ? [
            {
              label: filters.search
                ? $t('dms_lang.matrix.add_named', { key: filters.search })
                : $t('dms_lang.key_add.title'),
              icon: 'i-ph-plus',
              color: 'neutral',
              variant: 'ghost',
              onClick: () => addKey(),
            },
          ]
        : []),
    ]"
  />
</template>
