<script setup lang="ts">
import type { FlatTranslationRow, KeyRowResponse } from '../../types/lang'
import {
  checkMessage,
  escapeMessage,
  hasBlockingIssue,
  isValidKeyPath,
  keyPathConflict,
  messageIssueText,
  namespaceOf,
  stringValue,
  type KeyPathConflict,
  type MessageIssue,
  type MessageIssueSeverity,
} from '../../utils/translations'
import FormFieldRow from './form/FormFieldRow.vue'
import FormRows from './form/FormRows.vue'

interface Props {
  workspace: string
  baseLocale: string
  /** Every language of the workspace; the base is listed first whatever its place. */
  locales?: string[]
  existingKeys: string[]
  /** Project files only: the keys the installed modules provide. */
  moduleRows?: FlatTranslationRow[]
}

interface Emits {
  close: [added: string[]]
}

const VISIBLE_LOCALES = 3
const ISSUE_SEPARATOR = ' · '

const CONFLICT_LABELS: Record<KeyPathConflict['kind'], string> = {
  exists: 'dms_lang.key_add.path_taken',
  namespace: 'dms_lang.key_add.path_namespace_conflict',
  leafParent: 'dms_lang.key_add.path_parent_conflict',
}

const MODULE_CONFLICT_LABELS: Record<KeyPathConflict['kind'], string> = {
  exists: 'dms_lang.key_add.module_override',
  namespace: 'dms_lang.key_add.module_namespace',
  leafParent: 'dms_lang.key_add.module_parent',
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t } = useI18n()
const { errorMessage } = useMutationToast()
const toast = useToast()
const { updateKey, createKey } = useI18nWorkspaces()
const { nativeName } = useLocaleNames()
const { applyRow } = useWorkspaceFlat()

const isOpen = ref(true)
const path = ref('')
const values = ref<Record<string, string>>({})
const addAnother = ref(false)
const showAll = ref(false)
const isSubmitting = ref(false)
const submitError = ref('')
const added = ref<string[]>([])
const form = useTemplateRef<HTMLFormElement>('form')

const trimmedPath = computed(() => path.value.trim())
const orderedLocales = computed(() => [
  props.baseLocale,
  ...(props.locales ?? []).filter((code) => code !== props.baseLocale),
])
const shownLocales = computed(() =>
  showAll.value
    ? orderedLocales.value
    : orderedLocales.value.slice(0, VISIBLE_LOCALES),
)
const hiddenCount = computed(
  () => orderedLocales.value.length - shownLocales.value.length,
)
const moduleRow = computed(() =>
  props.moduleRows?.find((row) => row.key === trimmedPath.value),
)
const isOverride = computed(() => Boolean(moduleRow.value))
const conflict = computed(() =>
  keyPathConflict(trimmedPath.value, [...props.existingKeys, ...added.value]),
)
const moduleConflict = computed(() =>
  isOverride.value
    ? null
    : keyPathConflict(
        trimmedPath.value,
        (props.moduleRows ?? []).map((row) => row.key),
      ),
)
const pathError = computed(() => {
  if (!trimmedPath.value) return ''
  if (!isValidKeyPath(trimmedPath.value))
    return t('dms_lang.key_add.path_invalid')
  if (conflict.value) return conflictText(conflict.value, CONFLICT_LABELS)
  if (moduleConflict.value)
    return conflictText(moduleConflict.value, MODULE_CONFLICT_LABELS)
  return submitError.value
})
const pathHelp = computed(() => {
  if (!trimmedPath.value) return t('dms_lang.key_add.path_help')
  if (isOverride.value)
    return t('dms_lang.key_add.module_override', { path: trimmedPath.value })
  const namespace = namespaceOf(trimmedPath.value)
  const siblings = props.existingKeys.filter(
    (key) => namespaceOf(key) === namespace,
  ).length
  return t(
    'dms_lang.key_add.path_namespace',
    { namespace, count: siblings },
    siblings,
  )
})
const written = computed(() =>
  Object.fromEntries(
    orderedLocales.value
      .map((code) => [code, valueOf(code).trim() ? valueOf(code) : ''])
      .filter(([code, value]) => value && value !== moduleTextOf(code)),
  ),
)
const hasBlockedValue = computed(() =>
  orderedLocales.value.some((code) => hasBlockingIssue(issuesOf(code))),
)
const isValid = computed(
  () =>
    Boolean(trimmedPath.value) &&
    !pathError.value &&
    Object.keys(written.value).length > 0 &&
    !hasBlockedValue.value,
)

watch(trimmedPath, () => (submitError.value = ''))

function conflictText(
  found: KeyPathConflict,
  labels: Record<KeyPathConflict['kind'], string>,
): string {
  return t(
    labels[found.kind],
    {
      path: trimmedPath.value,
      parent: found.keys[0],
      example: found.keys[0],
      count: found.keys.length,
    },
    found.keys.length,
  )
}

function moduleTextOf(code: string): string {
  return stringValue(moduleRow.value?.values[code])
}

function valueOf(code: string): string {
  return values.value[code] ?? moduleTextOf(code)
}

function setValue(code: string, value: string) {
  values.value = { ...values.value, [code]: value }
}

function issuesOf(code: string): MessageIssue[] {
  const base = code === props.baseLocale ? '' : valueOf(props.baseLocale)
  return checkMessage(base, valueOf(code))
}

function issueText(code: string, severity: MessageIssueSeverity): string {
  return issuesOf(code)
    .filter((issue) => issue.severity === severity)
    .map((issue) => messageIssueText(issue, t))
    .join(ISSUE_SEPARATOR)
}

function valueHelp(code: string, index: number): string | undefined {
  const warnings = issueText(code, 'warning')
  if (warnings) return warnings
  const needsText = index === 0 && !Object.keys(written.value).length
  return needsText ? t('dms_lang.key_add.texts_required') : undefined
}

function close() {
  isOpen.value = false
  emit('close', added.value)
}

function resetForNext() {
  path.value = ''
  values.value = {}
  nextTick(() => form.value?.querySelector('input')?.focus())
}

function write(key: string): Promise<KeyRowResponse> {
  if (isOverride.value)
    return updateKey(props.workspace, key, written.value)
  return createKey(props.workspace, key, written.value)
}

async function submit() {
  if (!isValid.value || isSubmitting.value) return
  isSubmitting.value = true
  const key = trimmedPath.value
  try {
    applyRow(props.workspace, key, await write(key))
  } catch (error) {
    submitError.value = errorMessage(error)
    return
  } finally {
    isSubmitting.value = false
  }
  added.value = [...added.value, key]
  toast.add({
    title: t('dms_lang.key_add.added', { key }),
    color: 'success',
    icon: 'i-ph-check-circle',
  })
  if (addAnother.value) resetForNext()
  else close()
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('dms_lang.key_add.title')"
    :description="
      $t('dms_lang.key_add.description', { workspace: props.workspace })
    "
    :ui="{ content: 'sm:max-w-lg' }"
    @update:open="(open: boolean) => !open && close()"
  >
    <template #body>
      <form ref="form" novalidate @submit.prevent="submit">
        <FormRows has-required>
          <FormFieldRow
            :label="$t('dms_lang.key_add.path')"
            :help="pathError ? undefined : pathHelp"
            :error="pathError || null"
            required
          >
            <template #default="{ id }">
              <DmsInputText
                :id="id"
                v-model="path"
                autofocus
                class="w-full"
                :ui="{ base: 'font-mono' }"
                placeholder="checkout.coupon.invalid"
              />
            </template>
          </FormFieldRow>
          <FormFieldRow
            v-for="(code, index) in shownLocales"
            :key="code"
            :label="nativeName(code)"
            :help="valueHelp(code, index)"
            :error="issueText(code, 'error') || null"
          >
            <template #label-extra>
              <span class="text-dimmed font-mono text-xs">{{ code }}</span>
              <DmsStatusPill
                v-if="code === props.baseLocale"
                dot="none"
                tone="neutral"
                size="sm"
                :label="$t('dms_lang.common.base')"
              />
            </template>
            <template #default="{ id }">
              <DmsTextarea
                :id="id"
                :model-value="valueOf(code)"
                :rows="code === props.baseLocale ? 2 : 1"
                autoresize
                class="w-full"
                @update:model-value="(value: string) => setValue(code, value)"
                @keydown.meta.enter.prevent="submit"
                @keydown.ctrl.enter.prevent="submit"
              />
              <UButton
                v-if="hasBlockingIssue(issuesOf(code))"
                class="mt-1"
                size="xs"
                color="error"
                variant="soft"
                icon="i-ph-magic-wand"
                :label="$t('dms_lang.message_issue.escape')"
                @click="setValue(code, escapeMessage(valueOf(code)))"
              />
            </template>
          </FormFieldRow>
        </FormRows>
        <UButton
          v-if="orderedLocales.length > VISIBLE_LOCALES"
          class="mt-2"
          color="neutral"
          variant="link"
          size="sm"
          :icon="showAll ? 'i-ph-caret-up' : 'i-ph-caret-down'"
          :label="
            showAll
              ? $t('dms_lang.key_add.fewer_languages')
              : $t('dms_lang.key_add.more_languages', hiddenCount)
          "
          @click="showAll = !showAll"
        />
      </form>
    </template>
    <template #footer>
      <div class="flex w-full items-center gap-2">
        <DmsCheckbox
          v-model="addAnother"
          :label="$t('dms_lang.key_add.add_another')"
        />
        <div class="flex-1" />
        <UButton
          color="neutral"
          variant="outline"
          :label="$t('dms_lang.actions.cancel')"
          @click="close()"
        />
        <UButton
          :icon="isOverride ? 'i-ph-git-fork' : 'i-ph-plus'"
          :loading="isSubmitting"
          :disabled="!isValid"
          :label="
            isOverride
              ? $t('dms_lang.key_add.submit_override')
              : $t('dms_lang.key_add.submit')
          "
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
