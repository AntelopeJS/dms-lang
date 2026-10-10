<script setup lang="ts">
import PlaceholderText from '../PlaceholderText.vue'
import { formatTokens, missingPlaceholders } from '../../../utils/translations'

export type CellState = 'idle' | 'saving' | 'saved' | 'error'

interface Props {
  value: string
  baseValue: string
  inherited?: string
  isBase: boolean
  editable: boolean
  isEditing: boolean
  state: CellState
  failedDraft?: string
  maxLength?: number
}

interface Emits {
  edit: []
  save: [value: string]
  cancel: []
  retry: []
  next: []
}

const props = withDefaults(defineProps<Props>(), {
  inherited: undefined,
  failedDraft: undefined,
  maxLength: undefined,
})
const emit = defineEmits<Emits>()

const draft = ref('')
const isCommitted = ref(false)
const textarea = useTemplateRef<{ textareaRef?: HTMLTextAreaElement }>(
  'textarea',
)

const isMissing = computed(() => props.value === '')
const issues = computed(() =>
  props.isBase ? [] : missingPlaceholders(props.baseValue, props.value),
)
const counterLimit = computed(
  () => props.maxLength ?? Math.max(props.baseValue.length * 2, 60),
)

watch(
  () => props.isEditing,
  (editing) => {
    if (!editing) return
    isCommitted.value = false
    draft.value = props.failedDraft ?? props.value
    nextTick(() => textarea.value?.textareaRef?.focus())
  },
  { immediate: true },
)

function commit() {
  if (isCommitted.value) return
  isCommitted.value = true
  if (draft.value === props.value) emit('cancel')
  else emit('save', draft.value)
}

function cancel() {
  isCommitted.value = true
  emit('cancel')
}

function commitAndNext() {
  commit()
  emit('next')
}
</script>

<template>
  <div v-if="isEditing" class="space-y-1">
    <UTextarea
      ref="textarea"
      v-model="draft"
      autoresize
      :rows="1"
      :maxrows="8"
      :placeholder="props.inherited || props.baseValue"
      class="w-full"
      :ui="{ base: 'text-sm' }"
      @keydown.esc.prevent.stop="cancel"
      @keydown.meta.enter.prevent="commit"
      @keydown.ctrl.enter.prevent="commit"
      @keydown.tab.exact.prevent="commitAndNext"
      @blur="commit"
    />
    <div
      class="text-dimmed flex items-center justify-between font-mono text-[10.5px]"
    >
      <span class="inline-flex items-center gap-1">
        <UKbd size="sm">⌘</UKbd>
        <UKbd size="sm">↵</UKbd>
        {{ $t('dms_lang.matrix.save') }}
      </span>
      <span :class="draft.length > counterLimit ? 'text-warning' : undefined">
        {{ draft.length }} / {{ counterLimit }}
      </span>
    </div>
  </div>

  <div v-else-if="props.state === 'error'" class="space-y-1">
    <div
      class="border-error/40 bg-error/5 text-default rounded-md border px-2.5 py-1.5 text-sm"
    >
      {{ props.failedDraft }}
    </div>
    <div class="flex items-center justify-between text-xs">
      <span class="text-error inline-flex items-center gap-1">
        <UIcon name="i-ph-warning-circle" class="size-3.5" />
        {{ $t('dms_lang.matrix.not_saved') }}
      </span>
      <UButton
        size="xs"
        color="error"
        variant="soft"
        :label="$t('dms_lang.actions.retry')"
        @click="emit('retry')"
      />
    </div>
  </div>

  <button
    v-else-if="isMissing && !props.inherited && props.editable && !props.isBase"
    type="button"
    class="border-warning/40 bg-warning/5 hover:bg-warning/10 flex w-full items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-left transition-colors"
    @click="emit('edit')"
  >
    <span
      class="text-warning font-mono text-[10px] font-bold uppercase tracking-wider"
    >
      {{ $t('dms_lang.matrix.missing') }}
    </span>
    <span class="text-dimmed min-w-0 truncate text-xs italic">
      {{ $t('dms_lang.matrix.translate') }}
    </span>
  </button>

  <component
    :is="props.editable ? 'button' : 'div'"
    v-else
    :type="props.editable ? 'button' : undefined"
    class="group/cell w-full rounded-md px-2.5 py-1.5 text-left text-sm"
    :class="[
      props.editable
        ? 'hover:bg-elevated/70 cursor-text transition-colors'
        : '',
      issues.length ? 'ring-warning/50 bg-warning/5 ring-1 ring-inset' : '',
    ]"
    @click="props.editable && emit('edit')"
  >
    <span v-if="isMissing && props.inherited" class="space-y-0.5">
      <span class="text-dimmed block italic">{{ props.inherited }}</span>
      <span
        class="text-dimmed flex items-center gap-1 font-mono text-[10px] uppercase"
      >
        <UIcon name="i-ph-puzzle-piece" class="size-3" />
        {{ $t('dms_lang.matrix.inherited') }}
      </span>
    </span>
    <span v-else-if="isMissing" class="text-dimmed italic">—</span>
    <PlaceholderText v-else :text="props.value" class="text-default" />
    <span
      v-if="issues.length"
      class="text-warning mt-1 flex items-center gap-1 font-mono text-[10.5px]"
    >
      <UIcon name="i-ph-warning" class="size-3" />
      {{
        $t('dms_lang.matrix.placeholder_missing', {
          tokens: formatTokens(issues),
        })
      }}
    </span>
    <span
      v-if="props.state === 'saving' || props.state === 'saved'"
      class="mt-1 flex items-center gap-1 text-[10.5px]"
      :class="props.state === 'saved' ? 'text-success' : 'text-dimmed'"
    >
      <UIcon
        :name="props.state === 'saved' ? 'i-ph-check' : 'i-ph-circle-notch'"
        class="size-3"
        :class="props.state === 'saving' ? 'animate-spin' : undefined"
      />
      {{
        props.state === 'saved'
          ? $t('dms_lang.matrix.saved')
          : $t('dms_lang.matrix.saving')
      }}
    </span>
  </component>
</template>
