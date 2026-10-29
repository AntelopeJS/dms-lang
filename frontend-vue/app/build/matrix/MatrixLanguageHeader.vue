<script setup lang="ts">
import type { LanguageCoverage } from '../../types/lang'
import { coverageTone } from '../../utils/coverage'
import LocaleTile from '../components/LocaleTile.vue'

/** The head of a language column of the matrix: the language, its missing texts and its coverage. */
defineProps<{
  column: LanguageCoverage
  columnSiblings: string[]
  formatCount: (value: number) => string
}>()
</script>

<template>
<div class="flex items-center gap-2">
  <LocaleTile
    :code="column.code"
    size="sm"
    :is-base="column.isBase"
    :siblings="columnSiblings"
  />
  <span class="text-highlighted truncate font-medium">
    {{ column.name }}
  </span>
  <DmsStatusPill
    v-if="column.isBase"
    dot="none"
    tone="neutral"
    size="sm"
    :label="$t('dms_lang.common.base')"
  />
  <span
    v-else
    class="text-dimmed ml-auto font-mono text-[10.5px] whitespace-nowrap"
  >
    {{
      $t(
        'dms_lang.matrix.column_missing',
        { count: formatCount(column.missing) },
        column.missing,
      )
    }}
  </span>
</div>
<DmsMeter
  class="mt-2"
  :value="column.coverage"
  :max="100"
  size="xs"
  :tone="column.isBase ? 'primary' : coverageTone(column.coverage)"
/>
</template>
