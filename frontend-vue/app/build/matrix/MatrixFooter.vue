<script setup lang="ts">
import { MATRIX_KEYS } from '../../utils/shortcuts'
import ShortcutKbds from '../components/ShortcutKbds.vue'
import type { MatrixCounts } from '../composables/useMatrixFilters'

/** The foot of the matrix: what is left to translate, and the keyboard shortcuts of its cells. */
defineProps<{
  counts: MatrixCounts
  countedLabel: string
  canEditValues: boolean
  isCompact: boolean
  formatCount: (value: number) => string
}>()
</script>

<template>
  <div
    class="border-default text-dimmed flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 text-xs"
  >
    <span>
      {{
        $t(
          'dms_lang.matrix.footer_keys',
          { count: formatCount(counts.missing) },
          counts.missing,
        )
      }}
      ·
      {{
        $t(
          'dms_lang.matrix.footer_cells',
          { count: formatCount(counts.cells), languages: countedLabel },
          counts.cells,
        )
      }}
    </span>
    <span
      v-if="canEditValues && !isCompact"
      class="ml-auto inline-flex flex-wrap items-center gap-3"
    >
      <span class="inline-flex items-center gap-1">
        <ShortcutKbds :keys="MATRIX_KEYS.saveDown" />
        {{ $t('dms_lang.matrix.shortcut_save_down') }}
      </span>
      <span class="inline-flex items-center gap-1">
        <ShortcutKbds :keys="MATRIX_KEYS.nextCell" />
        {{ $t('dms_lang.matrix.shortcut_next_cell') }}
      </span>
      <span class="inline-flex items-center gap-1">
        <ShortcutKbds :keys="MATRIX_KEYS.nextMissing" />
        /
        <ShortcutKbds :keys="MATRIX_KEYS.previousMissing" />
        {{ $t('dms_lang.matrix.shortcut_next_missing') }}
      </span>
      <span class="inline-flex items-center gap-1">
        <ShortcutKbds :keys="MATRIX_KEYS.openPanel" />
        {{ $t('dms_lang.matrix.open_panel') }}
      </span>
    </span>
  </div>
</template>
