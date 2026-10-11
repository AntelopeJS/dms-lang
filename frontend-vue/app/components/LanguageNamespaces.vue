<script setup lang="ts">
import { useWorkspaceFlatSync } from '../composables/translation/useWorkspaceFlat'
import { coverageTone } from '../utils/translations'

const { isLoaded } = useWorkspaceFlat()
useWorkspaceFlatSync()
const { isUnknown } = useWorkspaceContext()
const { formatCount } = useLangFormat()
const { namespace, namespaceProgress, exists, isBase } = useLanguageQueue()

function scope(target: string) {
  namespace.value = namespace.value === target ? '' : target
}
</script>

<template>
  <DmsCard
    v-if="!isUnknown && ((exists && !isBase) || !isLoaded)"
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
      <li v-for="entry in namespaceProgress" :key="entry.namespace">
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
