<script setup lang="ts">
import PlaceholderText from '../PlaceholderText.vue'
import ShortcutKbds from '../ShortcutKbds.vue'
import { MATRIX_KEYS } from '../../../utils/shortcuts'
import {
  checkMessage,
  escapeMessage,
  formatTokens,
  hasBlockingIssue,
  messageIssueText,
  PLURAL_SEPARATOR,
  type MessageIssue,
} from '../../../utils/translations'
import type { SaveState } from '../../../utils/keySaves'
import type { CellFailure } from '../../composables/useCellSaves'
import type { CellMove } from '../../composables/useCellEditor'

interface Props {
  value: string
  baseValue: string
  inherited?: string
  /** In the modules workspace, the project's text that replaces the module's. */
  override?: string
  isBase: boolean
  editable: boolean
  isEditing: boolean
  state: SaveState
  failure?: CellFailure
  rowKey: string
  languageName: string
  /** Translated from an older base text. */
  isOutdated?: boolean
  /** The server found an issue in the stored text. */
  hasIssue?: boolean
  code: string
  /** The text the editor opens with. */
  initialDraft?: string
  /** The other's text when the cell changed elsewhere while being edited ('': removed). */
  changedElsewhere?: string
}

interface Emits {
  edit: [key: string, code: string]
  commit: [key: string, code: string, move: CellMove, draft: string]
  cancel: []
  retry: [key: string, code: string]
  discard: [key: string, code: string]
  /** Write the bare `@` and lone braces of the unsaved text as literals. */
  escape: [key: string, code: string]
  openPanel: [key: string, code: string, draft: string]
  review: [key: string, code: string]
  /** The text typed so far, each time it changes. */
  draft: [key: string, code: string, draft: string]
}

interface TextareaHandle {
  textareaRef?: HTMLTextAreaElement
}

type KeyHandler = (event: KeyboardEvent) => (() => void) | undefined

type FailureAction = 'fix' | 'overwrite' | 'retry'

const LONG_TEXT = 150
const MULTILINE = '\n'
const SYNTAX_KINDS = new Set(['bareAt', 'unclosedBrace', 'strayBrace'])
const FAILURE_ACTION_LABELS: Record<FailureAction, string> = {
  fix: 'dms_lang.matrix.fix',
  overwrite: 'dms_lang.matrix.overwrite',
  retry: 'dms_lang.actions.retry',
}

const props = withDefaults(defineProps<Props>(), {
  inherited: undefined,
  override: undefined,
  failure: undefined,
  isOutdated: false,
  hasIssue: false,
  changedElsewhere: undefined,
  initialDraft: '',
})
const emit = defineEmits<Emits>()
const draft = ref(props.initialDraft)

const { t } = useI18n()
const isCommitted = ref(false)
const textarea = useTemplateRef<TextareaHandle>('textarea')

const isMissing = computed(() => props.value === '')
const shown = computed(() => (props.isEditing ? draft.value : props.value))
/** Checked here only while it is typed or not stored yet; a stored text, only when the server flagged it. */
const isChecked = computed(
  () => props.isEditing || props.hasIssue || props.state !== 'idle',
)
const issues = computed<MessageIssue[]>(() =>
  isChecked.value
    ? checkMessage(props.isBase ? '' : props.baseValue, shown.value)
    : [],
)
const missingTokens = computed(() =>
  issues.value
    .filter((issue) => issue.kind === 'missing')
    .flatMap((issue) => issue.tokens),
)
const canEscape = computed(() => isEscapable(issues.value))
const failureIssues = computed<MessageIssue[]>(() =>
  props.failure ? checkMessage('', props.failure.draft) : [],
)
const isFailureInvalid = computed(() => hasBlockingIssue(failureIssues.value))
const failureAction = computed<FailureAction>(() => {
  if (isFailureInvalid.value) return 'fix'
  return props.failure?.isConflict ? 'overwrite' : 'retry'
})
const hasError = computed(() =>
  issues.value.some((issue) => issue.severity === 'error'),
)
const suggestsPanel = computed(
  () =>
    props.baseValue.length > LONG_TEXT ||
    props.baseValue.includes(MULTILINE) ||
    props.baseValue.includes(PLURAL_SEPARATOR),
)
const ariaLabel = computed(() =>
  t(
    isMissing.value
      ? 'dms_lang.matrix.aria_translate'
      : 'dms_lang.matrix.aria_edit',
    { key: props.rowKey, language: props.languageName },
  ),
)

watch(draft, (text) => emit('draft', props.rowKey, props.code, text))

watch(
  () => props.isEditing,
  (editing) => {
    if (!editing) return
    draft.value = props.initialDraft
    isCommitted.value = false
    nextTick(() => {
      const element = textarea.value?.textareaRef
      element?.focus()
      element?.setSelectionRange(element.value.length, element.value.length)
    })
  },
  { immediate: true },
)

function isEscapable(list: MessageIssue[]): boolean {
  return list.some((issue) => SYNTAX_KINDS.has(issue.kind))
}

function commit(move: CellMove) {
  if (isCommitted.value) return
  isCommitted.value = true
  emit('commit', props.rowKey, props.code, move, draft.value)
}

function onBlur() {
  if (document.hasFocus()) commit('stay')
}

function cancel() {
  isCommitted.value = true
  emit('cancel')
}

function openPanel() {
  isCommitted.value = true
  emit('openPanel', props.rowKey, props.code, draft.value)
}

const KEY_HANDLERS: Record<string, KeyHandler> = {
  Escape: () => cancel,
  Tab: (event) => () => commit(event.shiftKey ? 'previous' : 'next'),
  Enter: (event) => {
    if (event.altKey) return undefined
    const hasModifier = event.ctrlKey || event.metaKey
    if (hasModifier && event.shiftKey) return openPanel
    if (hasModifier) return () => commit('stay')
    return event.shiftKey ? undefined : () => commit('down')
  },
}

function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) return
  const action = KEY_HANDLERS[event.key]?.(event)
  if (!action) return
  event.preventDefault()
  event.stopPropagation()
  action()
}

function insertToken(token: string) {
  const separator = draft.value && !draft.value.endsWith(' ') ? ' ' : ''
  draft.value = `${draft.value}${separator}{${token}}`
  textarea.value?.textareaRef?.focus()
}

function escapeDraft() {
  draft.value = escapeMessage(draft.value)
  textarea.value?.textareaRef?.focus()
}
</script>

<template>
  <div v-if="isEditing" class="space-y-1">
    <p
      v-if="!props.isBase && props.baseValue"
      class="text-dimmed line-clamp-2 px-1 text-xs"
      :title="props.baseValue"
    >
      <PlaceholderText :text="props.baseValue" />
    </p>
    <UTextarea
      ref="textarea"
      v-model="draft"
      autoresize
      :rows="1"
      :maxrows="8"
      :placeholder="props.inherited || props.baseValue"
      :color="hasError ? 'error' : undefined"
      :highlight="hasError"
      :aria-label="ariaLabel"
      class="w-full"
      :ui="{ base: 'text-sm' }"
      @keydown="onKeydown"
      @blur="onBlur"
    />
    <p
      v-if="props.changedElsewhere !== undefined"
      class="text-warning flex items-start gap-1 px-1 text-[10.5px]"
      role="status"
    >
      <UIcon name="i-ph-arrows-clockwise" class="mt-px size-3 shrink-0" />
      <span class="min-w-0">
        {{ $t('dms_lang.matrix.changed_elsewhere') }}
        <PlaceholderText
          v-if="props.changedElsewhere"
          :text="props.changedElsewhere"
          class="text-default"
        />
        <span v-else class="italic">
          {{ $t('dms_lang.matrix.current_none') }}
        </span>
      </span>
    </p>
    <ul v-if="issues.length" class="space-y-0.5 px-1">
      <li
        v-for="issue in issues"
        :key="issue.kind"
        class="flex items-start gap-1 text-[10.5px]"
        :class="issue.severity === 'error' ? 'text-error' : 'text-warning'"
      >
        <UIcon name="i-ph-warning" class="mt-px size-3 shrink-0" />
        {{ messageIssueText(issue, t) }}
      </li>
    </ul>
    <div
      v-if="missingTokens.length || canEscape"
      class="flex flex-wrap gap-1 px-1"
    >
      <UButton
        v-for="token in missingTokens"
        :key="token"
        size="xs"
        color="warning"
        variant="soft"
        :label="$t('dms_lang.drawer.insert', { token: formatTokens([token]) })"
        @mousedown.prevent
        @click="insertToken(token)"
      />
      <UButton
        v-if="canEscape"
        size="xs"
        color="error"
        variant="soft"
        :label="$t('dms_lang.message_issue.escape')"
        @mousedown.prevent
        @click="escapeDraft"
      />
    </div>
    <div
      class="text-dimmed flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[10.5px]"
    >
      <span class="inline-flex items-center gap-1">
        <ShortcutKbds :keys="MATRIX_KEYS.saveDown" />
        {{ $t('dms_lang.matrix.shortcut_save_down') }}
      </span>
      <span class="inline-flex items-center gap-1">
        <ShortcutKbds :keys="MATRIX_KEYS.newLine" />
        {{ $t('dms_lang.matrix.shortcut_newline') }}
      </span>
      <span class="inline-flex items-center gap-1">
        <ShortcutKbds :keys="MATRIX_KEYS.cancel" />
        {{ $t('dms_lang.matrix.shortcut_cancel') }}
      </span>
      <span v-if="!props.isBase && props.baseValue" class="font-mono">
        {{
          $t('dms_lang.matrix.length', {
            count: draft.length,
            base: props.baseValue.length,
          })
        }}
      </span>
      <UButton
        v-if="props.isOutdated && !isMissing"
        size="xs"
        color="info"
        variant="soft"
        icon="i-ph-check"
        class="ml-auto"
        :label="$t('dms_lang.drawer.mark_reviewed')"
        :title="$t('dms_lang.drawer.outdated')"
        @mousedown.prevent
        @click="emit('review', props.rowKey, props.code)"
      />
      <UButton
        size="xs"
        :color="suggestsPanel ? 'primary' : 'neutral'"
        :variant="suggestsPanel ? 'soft' : 'ghost'"
        icon="i-ph-arrows-out-simple"
        :class="props.isOutdated && !isMissing ? undefined : 'ml-auto'"
        :label="
          suggestsPanel
            ? $t('dms_lang.matrix.panel_suggested')
            : $t('dms_lang.matrix.open_panel')
        "
        :title="$t('dms_lang.matrix.open_panel')"
        @mousedown.prevent
        @click="openPanel"
      />
    </div>
  </div>

  <div v-else-if="props.failure" class="space-y-1">
    <button
      type="button"
      data-matrix-cell
      :data-key="props.rowKey"
      :data-code="props.code"
      class="border-error/40 bg-error/5 text-default line-clamp-3 w-full rounded-md border px-2.5 py-1.5 text-left text-sm"
      :aria-label="ariaLabel"
      :disabled="!props.editable"
      @click="emit('edit', props.rowKey, props.code)"
    >
      <PlaceholderText v-if="props.failure.draft" :text="props.failure.draft" />
      <span v-else class="text-dimmed italic">—</span>
    </button>
    <p class="text-error flex items-start gap-1 text-xs">
      <UIcon name="i-ph-warning-circle" class="mt-0.5 size-3.5 shrink-0" />
      <span>
        {{ $t('dms_lang.matrix.not_saved') }} · {{ props.failure.message }}
      </span>
    </p>
    <p
      v-if="props.failure.isConflict"
      class="border-default text-dimmed line-clamp-3 rounded-md border border-dashed px-2.5 py-1.5 text-xs"
    >
      {{ $t('dms_lang.matrix.current_label') }}
      <PlaceholderText
        v-if="props.value"
        :text="props.value"
        class="text-default"
      />
      <span v-else class="italic">
        {{ $t('dms_lang.matrix.current_none') }}
      </span>
    </p>
    <div class="flex flex-wrap justify-end gap-1">
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        :label="$t('dms_lang.matrix.discard')"
        @click="emit('discard', props.rowKey, props.code)"
      />
      <UButton
        v-if="isFailureInvalid && isEscapable(failureIssues)"
        size="xs"
        color="error"
        variant="soft"
        :label="$t('dms_lang.message_issue.escape')"
        @click="emit('escape', props.rowKey, props.code)"
      />
      <UButton
        size="xs"
        color="error"
        variant="soft"
        :label="$t(FAILURE_ACTION_LABELS[failureAction])"
        @click="emit('retry', props.rowKey, props.code)"
      />
    </div>
  </div>

  <component
    :is="props.editable ? 'button' : 'div'"
    v-else
    :type="props.editable ? 'button' : undefined"
    :aria-label="props.editable && isMissing ? ariaLabel : undefined"
    data-matrix-cell
    :data-key="props.rowKey"
    :data-code="props.code"
    class="group/cell block w-full rounded-md px-2.5 py-1.5 text-left text-sm"
    :class="[
      props.editable
        ? 'hover:bg-elevated/70 cursor-text transition-colors'
        : '',
      issues.length ? 'ring-warning/50 bg-warning/5 ring-1 ring-inset' : '',
      isMissing && !props.inherited && props.editable
        ? 'border-warning/40 bg-warning/5 hover:bg-warning/10 border border-dashed'
        : '',
    ]"
    @click="props.editable && emit('edit', props.rowKey, props.code)"
  >
    <span v-if="isMissing && props.inherited" class="block space-y-0.5">
      <span class="text-dimmed line-clamp-3 italic">
        {{ props.inherited }}
      </span>
      <span
        class="text-dimmed flex items-center gap-1 font-mono text-[10px] uppercase"
      >
        <UIcon name="i-ph-puzzle-piece" class="size-3" />
        {{ $t('dms_lang.matrix.inherited') }}
      </span>
    </span>
    <span
      v-else-if="isMissing && (props.editable || props.isBase)"
      class="flex items-center gap-2"
    >
      <span
        class="text-warning font-mono text-[10px] font-bold tracking-wider uppercase"
      >
        {{
          props.isBase
            ? $t('dms_lang.matrix.source_missing')
            : $t('dms_lang.matrix.missing')
        }}
      </span>
      <span
        v-if="props.editable"
        class="text-dimmed min-w-0 truncate text-xs italic"
      >
        {{ $t('dms_lang.matrix.translate') }}
      </span>
    </span>
    <span v-else-if="isMissing" class="text-dimmed italic">—</span>
    <span v-else-if="props.override" class="block space-y-0.5">
      <PlaceholderText
        :text="props.override"
        class="text-default line-clamp-3"
      />
      <span
        class="text-dimmed line-clamp-2 text-xs line-through"
        :title="$t('dms_lang.matrix.module_text')"
      >
        {{ props.value }}
      </span>
    </span>
    <span
      v-else
      class="line-clamp-3"
      :title="props.value.length > LONG_TEXT ? props.value : undefined"
    >
      <PlaceholderText :text="props.value" class="text-default" />
    </span>
    <span
      v-for="issue in issues"
      :key="issue.kind"
      class="mt-1 flex items-start gap-1 font-mono text-[10.5px]"
      :class="issue.severity === 'error' ? 'text-error' : 'text-warning'"
    >
      <UIcon name="i-ph-warning" class="mt-px size-3 shrink-0" />
      {{ messageIssueText(issue, t) }}
    </span>
    <span
      v-if="props.isOutdated && !isMissing"
      class="text-info mt-1 flex items-center gap-1 font-mono text-[10.5px]"
      :title="$t('dms_lang.drawer.outdated')"
    >
      <UIcon name="i-ph-clock-counter-clockwise" class="size-3" />
      {{ $t('dms_lang.matrix.outdated') }}
    </span>
    <span v-if="props.state !== 'idle'" class="mt-1 flex">
      <DmsSaveStatus :state="props.state" />
    </span>
  </component>
</template>
