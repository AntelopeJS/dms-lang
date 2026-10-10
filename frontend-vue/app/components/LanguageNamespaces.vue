<script setup lang="ts">
import { coverageTone, namespaceCoverage } from '../utils/translations'

const { flat, isLoaded } = useWorkspaceFlat()
const { formatCount } = useLangFormat()
const { locale, namespace, exists, isBase } = useLanguageQueue()

const entries = computed(() =>
  namespaceCoverage(flat.value.rows, [locale.value])
    .map((entry) => ({
      namespace: entry.namespace,
      coverage: entry.coverage[locale.value] ?? 0,
      missing: entry.missing[locale.value] ?? 0,
    }))
    .sort((left, right) => left.coverage - right.coverage),
)

function scope(target: string) {
  namespace.value = namespace.value === target ? '' : target
}
</script>

<template>
  <DmsCard
    v-if="(exists && !isBase) || !isLoaded"
    :padded="false"
    :title="$t('dms_lang.language_namespaces.title')"
  >
    <template v-if="namespace" #actions>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-ph-x"
        :label="$t('dms_lang.language_namespaces.clear')"
        @click="namespace = ''"
      />
    </template>
    <div v-if="!isLoaded" class="space-y-2 p-4">
      <USkeleton v-for="index in 5" :key="index" class="h-6 w-full" />
    </div>
    <ul v-else class="divide-default divide-y">
      <li v-for="entry in entries" :key="entry.namespace">
        <button
          type="button"
          class="grid w-full grid-cols-[minmax(0,1fr)_5rem_3rem_3rem] items-center gap-3 px-4 py-2.5 text-left transition-colors"
          :class="
            namespace === entry.namespace
              ? 'bg-primary/10'
              : 'hover:bg-elevated/50'
          "
          :aria-pressed="namespace === entry.namespace"
          @click="scope(entry.namespace)"
        >
          <span class="text-highlighted truncate font-mono text-xs">
            {{ entry.namespace }}
          </span>
          <DmsMeter
            :value="entry.coverage"
            :max="100"
            format="none"
            size="xs"
            :tone="coverageTone(entry.coverage)"
          />
          <span class="text-muted text-right font-mono text-xs">
            {{ entry.coverage }}%
          </span>
          <span
            class="text-right font-mono text-xs font-semibold"
            :class="entry.missing ? 'text-warning' : 'text-dimmed'"
          >
            {{ formatCount(entry.missing) }}
          </span>
        </button>
      </li>
    </ul>
    <template v-if="isLoaded" #footer>
      <p class="text-dimmed flex items-center gap-1.5 text-xs">
        <UIcon name="i-ph-info" class="size-3.5" />
        {{ $t('dms_lang.language_namespaces.hint') }}
      </p>
    </template>
  </DmsCard>
</template>
