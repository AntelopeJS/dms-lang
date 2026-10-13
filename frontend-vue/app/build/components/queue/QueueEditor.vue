<script setup lang="ts">
import type { FlatTranslationRow } from '../../../types/lang'
import type { MessageIssueKind } from '../../../utils/translations'
import {
  escapeMessage,
  formatTokens,
  messageIssueText,
  placeholdersOf,
  replacePlaceholder,
  stringValue,
} from '../../../utils/translations'
import { textDirection } from '../../../utils/languages'
import LocaleTile from '../LocaleTile.vue'
import PlaceholderText from '../PlaceholderText.vue'
import { useQueue } from '../../composables/useQueueContext'

interface Props {
  /** The key shown. */
  row: FlatTranslationRow
}

/** The part of the textarea component the editor reaches into. */
interface TextareaHandle {
  textareaRef?: HTMLTextAreaElement
}

/** A variable renamed by mistake, and the one to put back in its place. */
interface TokenReplacement {
  from: string
  to: string
}

const CONTEXT_LANGUAGES = 2
const LONG_TEXT = 80
const KEY_SEPARATOR = '.'

const props = defineProps<Props>()
const { t } = useI18n()
const { flat } = useWorkspaceFlat()
const { canEditValues, isModules } = useWorkspaceContext()
const { switchLink } = useWorkspaceRoute()
const { session, editing, save, languageName, nameOf } = useQueue()
const { locale, baseLocale, drafts } = session
const { baseText, draft, issues, isBlocked, conflict, isOutdated } = editing
const { isSaving, isReviewing, isArmed, rejectedProblems } = save

const textarea = useTemplateRef<TextareaHandle>('textarea')

const keyParts = computed(() => {
  const key = props.row.key
  const cut = key.lastIndexOf(KEY_SEPARATOR) + 1
  return { path: key.slice(0, cut), leaf: key.slice(cut) }
})
const escapedDraft = computed(() => escapeMessage(draft.value))
const tokensOf = (kind: MessageIssueKind) =>
  issues.value
    .filter((issue) => issue.kind === kind)
    .flatMap((issue) => issue.tokens)
const missingTokens = computed(() => tokensOf('missing'))
const replacement = computed<TokenReplacement | undefined>(() => {
  const extra = tokensOf('extra')
  if (missingTokens.value.length !== 1 || extra.length !== 1) return undefined
  return { from: extra[0], to: missingTokens.value[0] }
})
const tokens = computed(() => placeholdersOf(baseText.value))
const fieldColor = computed(() => {
  if (isBlocked.value) return 'error'
  return issues.value.length ? 'warning' : 'primary'
})
const contextLocales = computed(() =>
  flat.value.locales
    .filter((code) => code !== baseLocale.value && code !== locale.value)
    .filter((code) => stringValue(props.row.values[code]))
    .slice(0, CONTEXT_LANGUAGES),
)
const overrideLink = computed(() =>
  switchLink(DEFAULT_WORKSPACE, {
    page: 'translations',
    query: { key: props.row.key },
  }),
)

/** Puts the text in the field, the caret at `caret` (the end by default). */
async function rewrite(value: string, caret = value.length) {
  draft.value = value
  await nextTick()
  const field = textarea.value?.textareaRef
  field?.focus()
  field?.setSelectionRange(caret, caret)
}

/** Writes a variable where the caret is (over the selection). */
function insertToken(token: string) {
  const text = formatTokens([token])
  const field = textarea.value?.textareaRef
  const start = field?.selectionStart ?? draft.value.length
  const end = field?.selectionEnd ?? draft.value.length
  void rewrite(
    `${draft.value.slice(0, start)}${text}${draft.value.slice(end)}`,
    start + text.length,
  )
}

function replaceToken(from: string, to: string) {
  void rewrite(replacePlaceholder(draft.value, from, to))
}

defineExpose({
  /** The text field, for the keys that leave it. */
  field: () => textarea.value?.textareaRef,
  focus: () => textarea.value?.textareaRef?.focus(),
})
</script>

<template>
  <div class="space-y-4 px-4 py-4">
    <div class="flex items-center gap-2">
      <UIcon name="i-ph-key" class="text-dimmed size-4" />
      <span class="break-all font-mono text-xs">
        <span class="text-dimmed">{{ keyParts.path }}</span>
        <span class="text-primary font-semibold">{{ keyParts.leaf }}</span>
      </span>
      <DmsStatusPill
        v-if="session.currentStatus.value"
        dot="none"
        size="sm"
        :tone="session.currentStatus.value === 'done' ? 'success' : 'neutral'"
        :label="$t(`dms_lang.queue.status_${session.currentStatus.value}`)"
      />
      <DmsStatusPill
        v-if="drafts.has(props.row.key)"
        dot="none"
        size="sm"
        tone="warning"
        :label="$t('dms_lang.queue.draft')"
      />
      <DmsStatusPill
        v-else-if="isOutdated"
        dot="none"
        size="sm"
        tone="warning"
        :label="$t('dms_lang.queue.status_outdated')"
      />
      <DmsStatusPill
        v-if="baseText.length > LONG_TEXT"
        dot="none"
        tone="neutral"
        size="sm"
        class="ml-auto"
        :label="$t('dms_lang.queue.long_text')"
      />
    </div>

    <div class="space-y-1.5">
      <div class="flex items-center gap-2 text-sm">
        <LocaleTile :code="baseLocale" size="sm" is-base />
        <span class="text-highlighted font-medium">
          {{ nameOf(baseLocale) }}
        </span>
        <span class="text-dimmed text-xs">
          {{ $t('dms_lang.common.base') }}
        </span>
      </div>
      <div
        class="border-default bg-(--dms-bg-muted) rounded-md border px-3.5 py-3 text-base"
        :dir="textDirection(baseLocale)"
      >
        <PlaceholderText
          v-if="baseText"
          :text="baseText"
          class="text-highlighted"
        />
        <span v-else class="text-dimmed italic">
          {{ $t('dms_lang.queue.no_base') }}
        </span>
      </div>
    </div>

    <div v-if="contextLocales.length" class="space-y-1">
      <DmsEyebrow :label="$t('dms_lang.queue.context')" size="xs" />
      <p
        v-for="code in contextLocales"
        :key="code"
        class="text-muted flex items-start gap-2 text-sm"
      >
        <LocaleTile :code="code" size="sm" />
        <span :dir="textDirection(code)">
          {{ stringValue(props.row.values[code]) }}
        </span>
      </p>
    </div>

    <div class="space-y-1.5">
      <div class="flex items-center gap-2 text-sm">
        <LocaleTile :code="locale" size="sm" />
        <span class="text-highlighted font-medium">{{ languageName }}</span>
        <span class="text-dimmed font-mono text-xs">{{ locale }}</span>
        <span
          v-if="tokens.length && !issues.length"
          class="ml-auto inline-flex items-center gap-1 text-xs"
          :class="draft ? 'text-success' : 'text-dimmed'"
        >
          <UIcon
            :name="draft ? 'i-ph-check' : 'i-ph-brackets-curly'"
            class="size-3.5"
          />
          {{
            $t(draft ? 'dms_lang.queue.uses' : 'dms_lang.queue.needs', {
              tokens: formatTokens(tokens),
            })
          }}
        </span>
      </div>

      <DmsBanner
        v-if="conflict !== undefined"
        tone="warning"
        icon="i-ph-warning"
        :title="$t('dms_lang.queue.conflict_title', { key: props.row.key })"
        :description="
          conflict
            ? $t('dms_lang.queue.conflict_current', { value: conflict })
            : $t('dms_lang.queue.conflict_empty')
        "
      >
        <template #actions>
          <UButton
            :label="$t('dms_lang.queue.conflict_use')"
            color="warning"
            variant="outline"
            size="xs"
            @click="save.useTheirs"
          />
          <UButton
            :label="$t('dms_lang.queue.conflict_overwrite')"
            color="warning"
            size="xs"
            :disabled="isSaving"
            @click="save.overwrite"
          />
        </template>
      </DmsBanner>

      <DmsBanner
        v-if="isOutdated && canEditValues && !drafts.has(props.row.key)"
        tone="warning"
        size="sm"
        icon="i-ph-clock-counter-clockwise"
        :description="$t('dms_lang.drawer.outdated')"
      >
        <template #actions>
          <UButton
            :label="$t('dms_lang.drawer.mark_reviewed')"
            icon="i-ph-check"
            color="warning"
            variant="outline"
            size="xs"
            :loading="isReviewing"
            @click="save.markReviewed"
          />
        </template>
      </DmsBanner>

      <DmsBanner
        v-if="!canEditValues"
        tone="info"
        size="sm"
        icon="i-ph-lock-simple"
        :description="
          isModules
            ? $t('dms_lang.queue.read_only_modules')
            : $t('dms_lang.queue.read_only')
        "
      >
        <template v-if="isModules" #actions>
          <UButton
            :label="$t('dms_lang.queue.override')"
            icon="i-ph-pencil-simple"
            color="neutral"
            variant="outline"
            size="xs"
            :to="overrideLink"
          />
        </template>
      </DmsBanner>

      <UTextarea
        ref="textarea"
        v-model="draft"
        :rows="3"
        autoresize
        :maxrows="12"
        autofocus
        class="w-full"
        :disabled="!canEditValues"
        :color="fieldColor"
        :highlight="true"
        :placeholder="baseText"
        :dir="textDirection(locale)"
        :ui="{ base: 'text-base' }"
      />

      <ul v-if="issues.length" class="space-y-0.5 text-xs">
        <li
          v-for="issue in issues"
          :key="issue.kind"
          class="inline-flex w-full items-center gap-1"
          :class="issue.severity === 'error' ? 'text-error' : 'text-warning'"
        >
          <UIcon name="i-ph-warning" class="size-3.5 shrink-0" />
          {{ messageIssueText(issue, t) }}
        </li>
      </ul>

      <ul v-if="rejectedProblems.length" class="text-error space-y-0.5 text-xs">
        <li
          v-for="problem in rejectedProblems"
          :key="problem"
          class="inline-flex w-full items-center gap-1"
        >
          <UIcon name="i-ph-x-circle" class="size-3.5 shrink-0" />
          {{ problem }}
        </li>
      </ul>

      <div
        v-if="canEditValues && (missingTokens.length || isBlocked)"
        class="flex flex-wrap gap-1.5"
      >
        <UButton
          v-if="replacement"
          size="xs"
          color="warning"
          variant="soft"
          icon="i-ph-swap"
          :label="
            $t('dms_lang.queue.replace', {
              from: formatTokens([replacement.from]),
              to: formatTokens([replacement.to]),
            })
          "
          @mousedown.prevent
          @click="replaceToken(replacement.from, replacement.to)"
        />
        <UButton
          v-for="token in missingTokens"
          :key="token"
          size="xs"
          color="warning"
          variant="soft"
          :label="
            $t('dms_lang.drawer.insert', { token: formatTokens([token]) })
          "
          @mousedown.prevent
          @click="insertToken(token)"
        />
        <UButton
          v-if="isBlocked && escapedDraft !== draft"
          size="xs"
          color="error"
          variant="soft"
          icon="i-ph-magic-wand"
          :label="$t('dms_lang.queue.escape')"
          @mousedown.prevent
          @click="rewrite(escapedDraft)"
        />
      </div>

      <p v-if="isArmed && !isBlocked" class="text-warning text-xs font-medium">
        {{ $t('dms_lang.queue.save_anyway_hint') }}
      </p>
    </div>
  </div>
</template>
