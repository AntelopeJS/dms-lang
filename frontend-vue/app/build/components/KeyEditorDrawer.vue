<script setup lang="ts">
import type { FlatTranslationRow } from '../../types/lang'
import {
  formatTokens,
  isLocaleValueMissing,
  missingPlaceholders,
  placeholdersOf,
  stringValue,
} from '../../utils/translations'
import LocaleTile from './LocaleTile.vue'
import PlaceholderText from './PlaceholderText.vue'

interface Props {
  keys: string[]
  startIndex: number
  editable: boolean
  manageKeys: boolean
  /** A key the workspace does not hold yet (a module key being overridden). */
  seed?: FlatTranslationRow
}

type DrawerResult = 'saved' | 'renamed' | 'deleted' | 'closed'

const KEY_SEPARATOR = '.'

const props = defineProps<Props>()
const emit = defineEmits<{ close: [result: DrawerResult] }>()

const { t } = useI18n()
const toast = useToast()
const { selectedWorkspace, upsertKey } = useI18nWorkspaces()
const { flat, update } = useWorkspaceFlat()
const { nativeName } = useLocaleNames()
const { tryMutate } = useMutationToast()
const { renameKey, deleteKey } = useKeyActions()

const isOpen = ref(true)
const index = ref(props.startIndex)
const drafts = ref<Record<string, string>>({})
const isSaving = ref(false)

const key = computed(() => props.keys[index.value] ?? '')
const row = computed<FlatTranslationRow>(
  () =>
    flat.value.rows.find((entry) => entry.key === key.value) ??
    props.seed ?? { key: key.value, values: {} },
)
const base = computed(() => flat.value.defaultLocale)
const baseText = computed(() => stringValue(row.value.values[base.value]))
const locales = computed(() => [
  base.value,
  ...flat.value.locales.filter((code) => code !== base.value),
])
const crumbs = computed(() =>
  key.value.split(KEY_SEPARATOR).slice(0, -1).join(' › '),
)
const changed = computed(() =>
  Object.entries(drafts.value).filter(
    ([code, value]) => value !== stringValue(row.value.values[code]),
  ),
)
const missingCount = computed(
  () =>
    locales.value.filter((code) => isLocaleValueMissing(draftOf(code))).length,
)
const issueCount = computed(
  () => locales.value.filter((code) => issuesOf(code).length > 0).length,
)

const isStored = computed(() =>
  flat.value.rows.some((entry) => entry.key === key.value),
)

function placeholderOf(code: string): string | undefined {
  const inherited = row.value.inherited?.[code]
  if (!isLocaleValueMissing(inherited)) return stringValue(inherited)
  return code === base.value ? undefined : baseText.value
}

function draftOf(code: string): string {
  return drafts.value[code] ?? stringValue(row.value.values[code])
}

function issuesOf(code: string): string[] {
  if (code === base.value) return []
  return missingPlaceholders(baseText.value, draftOf(code))
}

function setDraft(code: string, value: string) {
  drafts.value = { ...drafts.value, [code]: value }
}

function insertToken(code: string, token: string) {
  const current = draftOf(code)
  setDraft(
    code,
    `${current}${current.endsWith(' ') || !current ? '' : ' '}{${token}}`,
  )
}

function go(step: number) {
  const next = index.value + step
  if (next < 0 || next >= props.keys.length) return
  drafts.value = {}
  index.value = next
}

async function save(goNext = false) {
  if (!changed.value.length || isSaving.value) return goNext ? go(1) : undefined
  isSaving.value = true
  const values = Object.fromEntries(changed.value)
  const count = changed.value.length
  const workspace = selectedWorkspace.value
  const ok = await tryMutate(
    () => upsertKey(workspace, key.value, values, base.value),
    { title: t('dms_lang.drawer.save_failed', { key: key.value }) },
  )
  isSaving.value = false
  if (!ok) return
  applySaved(values)
  toast.add({
    title: t('dms_lang.drawer.saved', { count, key: key.value }),
    color: 'success',
    icon: 'i-ph-check-circle',
  })
  drafts.value = {}
  if (goNext) go(1)
}

function applySaved(values: Record<string, string>) {
  update(selectedWorkspace.value, (next) => {
    let target = next.rows.find((entry) => entry.key === key.value)
    if (!target) {
      target = { key: key.value, values: {} }
      next.rows.push(target)
    }
    for (const [code, value] of Object.entries(values)) {
      target.values[code] = value === '' ? undefined : value
    }
  })
}

function close(result: DrawerResult) {
  isOpen.value = false
  emit('close', result)
}

async function rename() {
  if (await renameKey(key.value)) close('renamed')
}

async function remove() {
  if (await deleteKey(key.value)) close('deleted')
}
</script>

<template>
  <USlideover
    v-model:open="isOpen"
    :title="key"
    :ui="{ content: 'sm:max-w-xl', body: 'space-y-3' }"
    @update:open="(open: boolean) => !open && close('closed')"
  >
    <template #title>
      <span class="break-all font-mono">{{ key }}</span>
    </template>
    <template #description>
      <span class="block space-y-2">
        <DmsEyebrow
          as="span"
          :label="
            crumbs
              ? $t('dms_lang.drawer.eyebrow', { path: crumbs })
              : $t('dms_lang.drawer.key')
          "
          size="xs"
          truncate
        />
        <span class="flex flex-wrap items-center gap-1.5">
          <DmsStatusPill
            dot="none"
            v-if="missingCount"
            tone="warning"
            size="sm"
            :label="$t('dms_lang.drawer.missing', missingCount)"
          />
          <DmsStatusPill
            dot="none"
            v-if="issueCount"
            tone="error"
            size="sm"
            icon="i-ph-warning"
            :label="$t('dms_lang.drawer.issues', issueCount)"
          />
          <span
            v-if="placeholdersOf(baseText).length"
            class="text-dimmed inline-flex items-center gap-1.5 text-xs"
          >
            <UIcon name="i-ph-brackets-curly" class="size-3.5" />
            {{ $t('dms_lang.drawer.placeholders') }}
            <PlaceholderText :text="formatTokens(placeholdersOf(baseText))" />
          </span>
        </span>
      </span>
    </template>
    <template #actions>
      <UButton
        icon="i-ph-caret-up"
        color="neutral"
        variant="ghost"
        size="xs"
        :disabled="index === 0"
        :aria-label="$t('dms_lang.drawer.previous')"
        @click="go(-1)"
      />
      <UButton
        icon="i-ph-caret-down"
        color="neutral"
        variant="ghost"
        size="xs"
        :disabled="index >= props.keys.length - 1"
        :aria-label="$t('dms_lang.drawer.next')"
        @click="go(1)"
      />
    </template>

    <template #body>
      <div v-for="code in locales" :key="`${key}-${code}`" class="space-y-1.5">
        <div class="flex items-center gap-2 text-sm">
          <LocaleTile :code="code" size="sm" :is-base="code === base" />
          <span class="text-highlighted font-medium">
            {{ nativeName(code) }}
          </span>
          <span class="text-dimmed font-mono text-xs">{{ code }}</span>
          <DmsStatusPill
            dot="none"
            v-if="code === base"
            tone="neutral"
            size="sm"
            :label="$t('dms_lang.common.base')"
          />
          <span class="ml-auto text-xs">
            <span
              v-if="issuesOf(code).length"
              class="text-error inline-flex items-center gap-1 font-mono"
            >
              <UIcon name="i-ph-warning" class="size-3.5" />
              {{
                $t('dms_lang.matrix.placeholder_missing', {
                  tokens: formatTokens(issuesOf(code)),
                })
              }}
            </span>
            <span
              v-else-if="isLocaleValueMissing(draftOf(code))"
              class="text-warning font-mono font-semibold uppercase"
            >
              {{ $t('dms_lang.matrix.missing') }}
            </span>
            <UIcon
              v-else-if="code !== base"
              name="i-ph-check"
              class="text-success size-4"
            />
          </span>
        </div>
        <UTextarea
          v-if="props.editable"
          :model-value="draftOf(code)"
          autoresize
          :rows="1"
          :maxrows="10"
          class="w-full"
          :color="issuesOf(code).length ? 'error' : undefined"
          :highlight="issuesOf(code).length > 0"
          :placeholder="placeholderOf(code)"
          @update:model-value="(value: string) => setDraft(code, value)"
          @keydown.meta.enter.prevent="save(true)"
          @keydown.ctrl.enter.prevent="save(true)"
        />
        <div
          v-else
          class="border-default bg-(--dms-bg-muted) rounded-md border px-3 py-2 text-sm"
        >
          <PlaceholderText v-if="draftOf(code)" :text="draftOf(code)" />
          <span v-else class="text-dimmed">—</span>
        </div>
        <div
          v-if="props.editable && issuesOf(code).length"
          class="flex items-start justify-between gap-3 text-xs"
        >
          <span class="text-error">
            {{
              $t('dms_lang.drawer.issue_help', {
                tokens: formatTokens(issuesOf(code)),
              })
            }}
          </span>
          <UButton
            v-for="token in issuesOf(code)"
            :key="token"
            size="xs"
            color="error"
            variant="soft"
            :label="
              $t('dms_lang.drawer.insert', { token: formatTokens([token]) })
            "
            @click="insertToken(code, token)"
          />
        </div>
        <p
          v-else-if="
            props.editable &&
            code !== base &&
            baseText &&
            isLocaleValueMissing(draftOf(code))
          "
          class="text-dimmed text-xs"
        >
          {{ $t('dms_lang.drawer.reference') }}
          <PlaceholderText :text="baseText" />
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center gap-2">
        <template v-if="props.manageKeys && isStored">
          <UButton
            icon="i-ph-pencil-simple"
            color="neutral"
            variant="ghost"
            size="sm"
            :label="$t('dms_lang.drawer.rename')"
            @click="rename"
          />
          <UButton
            icon="i-ph-trash"
            color="error"
            variant="ghost"
            size="sm"
            :label="$t('dms_lang.drawer.delete')"
            @click="remove"
          />
        </template>
        <div class="flex-1" />
        <span
          v-if="props.editable"
          class="text-dimmed hidden items-center gap-1 text-xs sm:inline-flex"
        >
          <UKbd size="sm">⌘</UKbd>
          <UKbd size="sm">↵</UKbd>
          {{ $t('dms_lang.drawer.save_next') }}
        </span>
        <UButton
          v-if="props.editable"
          icon="i-ph-check"
          size="sm"
          :loading="isSaving"
          :disabled="!changed.length"
          :label="$t('dms_lang.drawer.save')"
          @click="save()"
        />
      </div>
    </template>
  </USlideover>
</template>
