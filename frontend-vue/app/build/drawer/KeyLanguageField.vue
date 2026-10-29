<script setup lang="ts">
import type { FlatTranslationRow } from '../../types/lang'
import type { SaveState } from '../../utils/keySaves'
import {
  escapeMessage,
  formatTokens,
  messageIssueText,
  replacePlaceholder,
  type MessageIssue,
  type MessageTranslate,
} from '../../utils/translations'
import LocaleTile from '../components/LocaleTile.vue'
import PlaceholderText from '../components/PlaceholderText.vue'
import {
  BASE_MISSING_LABEL,
  FIELD_STATUS_LABELS,
  type FieldStatus,
} from './fieldStatus'

/**
 * The field of one language in the key panel (`KeyEditorDrawer`): its name
 * and status, its text, a conflict or an error, and its issues. The panel
 * keeps the state and hands its readers and actions down.
 */
const props = defineProps<{
  code: string
  base: string
  baseText: string
  row: FlatTranslationRow
  fieldErrors: Record<string, string>
  editable: boolean
  t: MessageTranslate
  nativeName: (code: string) => string
  fieldIdOf: (code: string) => string
  hasConflict: (code: string) => boolean
  saveStateOf: (code: string) => SaveState
  statusOf: (code: string) => FieldStatus
  issuesOf: (code: string) => MessageIssue[]
  issueOfKind: (
    code: string,
    kind: MessageIssue['kind'],
  ) => MessageIssue | undefined
  draftOf: (code: string) => string
  ownOf: (code: string) => string
  save: (codes: string[]) => Promise<boolean>
  setDraft: (code: string, value: string) => void
  discardDraft: (code: string) => void
  overwrite: (code: string) => void
  markReviewed: (code: string) => Promise<void>
  insertAtCaret: (code: string, token: string) => void
  rewrite: (code: string, value: string) => void
  onFieldBlur: (code: string) => void
  saveAndNext: () => Promise<void>
}>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
    <LocaleTile :code="code" size="sm" :is-base="code === base" />
    <label
      v-if="props.editable"
      :for="fieldIdOf(code)"
      class="text-highlighted font-medium"
    >
      {{ nativeName(code) }}
    </label>
    <span v-else class="text-highlighted font-medium">
      {{ nativeName(code) }}
    </span>
    <span class="text-dimmed font-mono text-xs">{{ code }}</span>
    <DmsStatusPill
      v-if="code === base"
      dot="none"
      tone="neutral"
      size="sm"
      :label="$t('dms_lang.common.base')"
    />
    <span class="ml-auto inline-flex items-center gap-1.5 text-xs">
      <span
        v-if="hasConflict(code)"
        class="text-error inline-flex items-center gap-1 font-medium"
      >
        <UIcon name="i-ph-warning" class="size-3.5" />
        {{ $t('dms_lang.drawer.conflict') }}
      </span>
      <template v-else-if="saveStateOf(code) !== 'idle'">
        <DmsSaveStatus
          :state="saveStateOf(code)"
          @retry="save([code])"
        />
        <UButton
          v-if="saveStateOf(code) === 'error'"
          size="xs"
          color="neutral"
          variant="link"
          :label="$t('dms_lang.drawer.discard')"
          @click="discardDraft(code)"
        />
      </template>
      <span
        v-else-if="statusOf(code) === 'missing'"
        class="text-warning font-mono font-semibold uppercase"
      >
        {{
          $t(
            code === base
              ? BASE_MISSING_LABEL
              : FIELD_STATUS_LABELS.missing,
          )
        }}
      </span>
      <template v-else-if="statusOf(code) !== 'done'">
        <span
          :class="
            statusOf(code) === 'outdated'
              ? 'text-warning font-medium'
              : 'text-dimmed'
          "
        >
          {{ $t(FIELD_STATUS_LABELS[statusOf(code)]) }}
        </span>
        <UButton
          v-if="statusOf(code) === 'overridden' && props.editable"
          size="xs"
          color="neutral"
          variant="link"
          :label="$t('dms_lang.drawer.use_module')"
          @click="(setDraft(code, ''), save([code]))"
        />
        <UButton
          v-else-if="statusOf(code) === 'outdated' && props.editable"
          size="xs"
          color="neutral"
          variant="link"
          icon="i-ph-check"
          :label="$t('dms_lang.drawer.mark_reviewed')"
          @click="markReviewed(code)"
        />
      </template>
      <UIcon
        v-else-if="code !== base && !issuesOf(code).length"
        name="i-ph-check"
        class="text-success size-4"
      />
    </span>
  </div>
  <UTextarea
    v-if="props.editable"
    :id="fieldIdOf(code)"
    :model-value="draftOf(code)"
    autoresize
    :rows="1"
    :maxrows="10"
    class="w-full"
    :color="issuesOf(code).length ? 'error' : undefined"
    :highlight="issuesOf(code).length > 0"
    @update:model-value="(value: string) => setDraft(code, value)"
    @blur="onFieldBlur(code)"
    @keydown.meta.enter.prevent="saveAndNext"
    @keydown.ctrl.enter.prevent="saveAndNext"
  />
  <div
    v-else
    class="border-default rounded-md border bg-(--dms-bg-muted) px-3 py-2 text-sm"
  >
    <PlaceholderText v-if="draftOf(code)" :text="draftOf(code)" />
    <span v-else class="text-dimmed">—</span>
    <p
      v-if="row.overrides?.[code]"
      class="text-dimmed border-default mt-2 border-t pt-2 text-xs"
    >
      {{ $t('dms_lang.drawer.project_value') }}
      <PlaceholderText
        :text="row.overrides[code]"
        class="text-default"
      />
    </p>
  </div>
  <div
    v-if="hasConflict(code)"
    class="border-error/40 space-y-1.5 rounded-md border px-3 py-2 text-xs"
  >
    <p class="text-dimmed">
      <template v-if="ownOf(code)">
        {{ $t('dms_lang.drawer.conflict_value') }}
        <PlaceholderText :text="ownOf(code)" class="text-default" />
      </template>
      <template v-else>
        {{ $t('dms_lang.drawer.conflict_empty') }}
      </template>
    </p>
    <p class="text-dimmed">{{ $t('dms_lang.drawer.conflict_help') }}</p>
    <div class="flex flex-wrap gap-1.5">
      <UButton
        size="xs"
        color="error"
        variant="soft"
        :label="$t('dms_lang.drawer.overwrite')"
        @mousedown.prevent
        @click="overwrite(code)"
      />
      <UButton
        size="xs"
        color="neutral"
        variant="outline"
        :label="$t('dms_lang.drawer.discard')"
        @mousedown.prevent
        @click="discardDraft(code)"
      />
    </div>
  </div>
  <p v-else-if="fieldErrors[code]" class="text-error text-xs">
    {{ fieldErrors[code] }}
  </p>
  <div
    v-if="props.editable && issuesOf(code).length"
    class="space-y-1 text-xs"
  >
    <div
      v-for="issue in issuesOf(code)"
      :key="issue.kind"
      class="flex flex-wrap items-center gap-x-3 gap-y-1"
    >
      <span
        :class="
          issue.severity === 'error' ? 'text-error' : 'text-warning'
        "
      >
        {{ messageIssueText(issue, t) }}
        <template v-if="issue.kind === 'missing'">
          {{
            $t(
              'dms_lang.drawer.issue_help',
              { tokens: formatTokens(issue.tokens) },
              issue.count,
            )
          }}
        </template>
      </span>
      <template v-if="issue.kind === 'missing'">
        <UButton
          v-for="token in issue.tokens"
          :key="token"
          size="xs"
          color="error"
          variant="soft"
          :label="
            $t('dms_lang.drawer.insert', {
              token: formatTokens([token]),
            })
          "
          @mousedown.prevent
          @click="insertAtCaret(code, formatTokens([token]))"
        />
        <UButton
          v-if="
            issue.tokens.length === 1 &&
            issueOfKind(code, 'extra')?.tokens.length === 1
          "
          size="xs"
          color="error"
          variant="soft"
          :label="
            $t('dms_lang.message_issue.replace', {
              token: formatTokens(issue.tokens),
            })
          "
          @mousedown.prevent
          @click="
            rewrite(
              code,
              replacePlaceholder(
                draftOf(code),
                issueOfKind(code, 'extra')?.tokens[0] ?? '',
                issue.tokens[0],
              ),
            )
          "
        />
      </template>
      <UButton
        v-else-if="
          issue.severity === 'error' &&
          escapeMessage(draftOf(code)) !== draftOf(code)
        "
        size="xs"
        color="error"
        variant="soft"
        icon="i-ph-magic-wand"
        :label="$t('dms_lang.message_issue.escape')"
        @mousedown.prevent
        @click="rewrite(code, escapeMessage(draftOf(code)))"
      />
    </div>
  </div>
  <p
    v-else-if="
      props.editable &&
      code !== base &&
      baseText &&
      statusOf(code) === 'missing'
    "
    class="text-dimmed text-xs"
  >
    {{ $t('dms_lang.drawer.reference') }}
    <PlaceholderText :text="baseText" />
  </p>
</template>
