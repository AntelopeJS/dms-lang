<script setup lang="ts">
import { useDmsRoute } from '#dms/frontend-module'
import TranslationMatrix from '../../build/components/pages/lang/TranslationMatrix.vue'
import {
  type FlatTranslationRow,
  isLocaleValueMissing,
} from '../../composables/translation/useTranslationProgress'

interface LocaleColumn {
  code: string
  name: string
  flag: string
  isDefault: boolean
}

interface SavePayload {
  key: string
  locale: string
  value: string
}

type TranslationFilter = 'all' | 'missing' | 'complete'

const FILTER_PREDICATES: Record<
  TranslationFilter,
  (missing: boolean) => boolean
> = {
  all: () => true,
  missing: (missing) => missing,
  complete: (missing) => !missing,
}

const route = useDmsRoute()
const { t } = useI18n()
const toast = useToast()
const { confirm } = useConfirm()
const { localeMetaOf } = useLocaleMeta()
const { tryMutate } = useMutationToast()

const {
  editable: devEditable,
  selectedWorkspace,
  upsertKey,
  renameKey,
  deleteKey,
} = useI18nWorkspaces()

const { isDefault, isModules, isEditable, canManage } = useWorkspaceContext()

const initialFilter =
  route.query.filter === 'missing' || route.query.filter === 'complete'
    ? route.query.filter
    : 'all'
const initialLocale =
  typeof route.query.locale === 'string' ? route.query.locale : ''

const filter = ref<TranslationFilter>(initialFilter)
const search = ref('')
const { flat, isLoading, loadFlat, reload, removeLanguage } = useWorkspaceFlat()

const canManageKeys = computed(() => isEditable.value && !isModules.value)
const canEditValues = computed(() => isEditable.value && !isModules.value)
const showOverride = computed(() => isModules.value && devEditable.value)

const allLocaleColumns = computed<LocaleColumn[]>(() => {
  const fallback = flat.value.defaultLocale
  return [...flat.value.locales]
    .sort((a, b) => (a === fallback ? -1 : b === fallback ? 1 : 0))
    .map((code) => ({
      code,
      ...localeMetaOf(code),
      isDefault: code === fallback,
    }))
})

const visibleOrder = ref<string[]>([])
let localeFocusPending = Boolean(initialLocale)

function focusedOrder(codes: string[]): string[] | null {
  if (!codes.includes(initialLocale)) return null
  const fallback = flat.value.defaultLocale
  if (initialLocale === fallback) return [initialLocale]
  return codes.includes(fallback) ? [fallback, initialLocale] : [initialLocale]
}

watch(
  () => allLocaleColumns.value.map((column) => column.code).join(','),
  () => {
    const codes = allLocaleColumns.value.map((column) => column.code)
    if (codes.length > 0 && localeFocusPending) {
      localeFocusPending = false
      const focused = focusedOrder(codes)
      if (focused) {
        visibleOrder.value = focused
        return
      }
    }
    visibleOrder.value = codes
  },
  { immediate: true },
)

const displayColumns = computed<LocaleColumn[]>(() => {
  const byCode = new Map(
    allLocaleColumns.value.map((column) => [column.code, column]),
  )
  return visibleOrder.value
    .map((code) => byCode.get(code))
    .filter((column): column is LocaleColumn => Boolean(column))
})

function isColumnShown(code: string): boolean {
  return visibleOrder.value.includes(code)
}

function toggleColumn(code: string) {
  visibleOrder.value = visibleOrder.value.includes(code)
    ? visibleOrder.value.filter((current) => current !== code)
    : [...visibleOrder.value, code]
}

function moveColumn(code: string, direction: -1 | 1) {
  const index = visibleOrder.value.indexOf(code)
  const target = index + direction
  if (index < 0 || target < 0 || target >= visibleOrder.value.length) return
  const next = [...visibleOrder.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  visibleOrder.value = next
}

const columnManagerRows = computed(() => {
  const shown = displayColumns.value.map((column) => ({
    ...column,
    shown: true,
  }))
  const hidden = allLocaleColumns.value
    .filter((column) => !isColumnShown(column.code))
    .map((column) => ({ ...column, shown: false }))
  return [...shown, ...hidden]
})

function rowMissing(row: FlatTranslationRow): boolean {
  return displayColumns.value
    .filter((column) => !column.isDefault)
    .some((column) => isLocaleValueMissing(row.values[column.code]))
}

const counts = computed(() => {
  const missing = flat.value.rows.filter(rowMissing).length
  return {
    all: flat.value.rows.length,
    missing,
    complete: flat.value.rows.length - missing,
  }
})

const filterItems = computed(() => [
  {
    label: `${t('dms_lang.editor.filter_all')} ${counts.value.all}`,
    value: 'all',
  },
  {
    label: `${t('dms_lang.editor.filter_missing')} ${counts.value.missing}`,
    value: 'missing',
  },
  {
    label: `${t('dms_lang.editor.filter_complete')} ${counts.value.complete}`,
    value: 'complete',
  },
])

const filteredRows = computed(() => {
  const needle = search.value.trim().toLowerCase()
  const matchesFilter = FILTER_PREDICATES[filter.value]
  return flat.value.rows.filter((row) => {
    const passFilter = matchesFilter(rowMissing(row))
    const passSearch = !needle || row.key.toLowerCase().includes(needle)
    return passFilter && passSearch
  })
})

function toMatrixValues(
  source: Record<string, unknown>,
): Record<string, string | undefined> {
  const result: Record<string, string | undefined> = {}
  for (const code of flat.value.locales) {
    const value = source[code]
    result[code] = value == null ? undefined : String(value)
  }
  return result
}

const matrixRows = computed(() =>
  filteredRows.value.map((row) => ({
    key: row.key,
    values: toMatrixValues(row.values),
    inherited: row.inherited ? toMatrixValues(row.inherited) : undefined,
  })),
)

async function onSave(payload: SavePayload) {
  const ok = await tryMutate(() =>
    upsertKey(
      selectedWorkspace.value,
      payload.key,
      { [payload.locale]: payload.value },
      flat.value.defaultLocale,
    ),
  )
  if (!ok) return
  const row = flat.value.rows.find((item) => item.key === payload.key)
  if (row)
    row.values[payload.locale] =
      payload.value === '' ? undefined : payload.value
  toast.add({ title: t('dms_lang.translation.ws_saved'), color: 'success' })
}

function overrideKey(key: string) {
  selectedWorkspace.value = DEFAULT_WORKSPACE
  filter.value = 'all'
  search.value = key
}

const langAddOpen = ref(false)

const keyAddOpen = ref(false)
const keyAddForm = ref({ path: '' })
const keyRenameOpen = ref(false)
const keyRenameForm = ref({ path: '', newPath: '' })

function openAddKey() {
  keyAddForm.value = { path: '' }
  keyAddOpen.value = true
}

async function submitAddKey() {
  const path = keyAddForm.value.path.trim()
  if (!path) return
  const seed = isDefault.value ? { [flat.value.defaultLocale]: '' } : {}
  const ok = await tryMutate(() =>
    upsertKey(selectedWorkspace.value, path, seed, flat.value.defaultLocale),
  )
  if (!ok) return
  keyAddOpen.value = false
  await loadFlat()
}

function openRenameKey(key: string) {
  keyRenameForm.value = { path: key, newPath: key }
  keyRenameOpen.value = true
}

async function submitRenameKey() {
  const { path, newPath } = keyRenameForm.value
  const ok = await tryMutate(() =>
    renameKey(selectedWorkspace.value, path, newPath),
  )
  if (!ok) return
  keyRenameOpen.value = false
  await loadFlat()
}

async function requestDeleteKey(key: string) {
  const workspace = selectedWorkspace.value
  const confirmed = await confirm({
    title: t('dms_lang.translation.ws_delete_key_title'),
    description: t('dms_lang.translation.ws_delete_key_confirm', { path: key }),
    confirmLabel: t('dms_lang.translation.ws_delete'),
    confirmColor: 'error',
  })
  if (!confirmed) return
  const ok = await tryMutate(() => deleteKey(workspace, key))
  if (!ok) return
  await loadFlat()
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center gap-3">
      <DmsLangWorkspaceStatus />

      <div class="flex-1" />

      <UButton
        v-if="canManage"
        icon="i-lucide-languages"
        color="neutral"
        variant="subtle"
        :label="$t('dms_lang.translation.ws_add_language')"
        @click="langAddOpen = true"
      />
    </div>

    <DmsLangWorkspaceEndpoint />

    <div class="flex flex-wrap items-center gap-3">
      <DmsSegmented
        v-model="filter"
        :items="filterItems"
        :aria-label="$t('dms_lang.editor.filter_all')"
      />
      <UInput
        v-model="search"
        icon="i-lucide-search"
        :placeholder="$t('dms_lang.editor.search_placeholder')"
        class="w-64"
      />
      <div class="flex-1" />

      <UPopover>
        <UButton
          icon="i-lucide-columns-3"
          color="neutral"
          variant="subtle"
          size="sm"
          :label="$t('dms_lang.editor.columns')"
        />
        <template #content>
          <div class="w-72 space-y-0.5 p-2">
            <div
              v-for="column in columnManagerRows"
              :key="column.code"
              class="hover:bg-elevated/50 flex items-center gap-2 rounded-md px-2 py-1.5"
            >
              <UCheckbox
                :model-value="column.shown"
                @update:model-value="toggleColumn(column.code)"
              />
              <UIcon
                :name="
                  column.flag ? `flagpack:${column.flag}` : 'i-lucide-globe'
                "
                class="size-4 shrink-0"
              />
              <span class="min-w-0 flex-1 truncate text-sm">
                {{ column.name }}
              </span>
              <UBadge
                v-if="column.isDefault"
                color="neutral"
                variant="subtle"
                size="sm"
              >
                {{ $t('dms_lang.editor.base') }}
              </UBadge>
              <template v-if="column.shown">
                <UButton
                  icon="i-lucide-chevron-up"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :aria-label="$t('dms_lang.editor.move_up')"
                  @click="moveColumn(column.code, -1)"
                />
                <UButton
                  icon="i-lucide-chevron-down"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :aria-label="$t('dms_lang.editor.move_down')"
                  @click="moveColumn(column.code, 1)"
                />
              </template>
              <UButton
                v-if="canManage && !column.isDefault"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                :aria-label="$t('dms_lang.translation.ws_delete')"
                @click="removeLanguage(column.code)"
              />
            </div>

            <template v-if="canManage">
              <USeparator class="my-1.5" />
              <UButton
                icon="i-lucide-plus"
                color="neutral"
                variant="ghost"
                size="sm"
                block
                :label="$t('dms_lang.translation.ws_add_language')"
                @click="langAddOpen = true"
              />
            </template>
          </div>
        </template>
      </UPopover>

      <UButton
        v-if="canManageKeys"
        icon="i-lucide-plus"
        color="neutral"
        variant="subtle"
        size="sm"
        :label="$t('dms_lang.translation.ws_add_key')"
        @click="openAddKey"
      />
    </div>

    <div class="relative">
      <div
        v-if="isLoading"
        class="bg-default/50 absolute inset-0 z-30 flex items-center justify-center rounded-xl"
      >
        <div class="text-center">
          <UIcon
            name="i-lucide-loader-circle"
            class="text-muted mb-2 size-8 animate-spin"
          />
          <p class="text-muted text-xs">
            {{ $t('dms_lang.translation.loading_translations') }}
          </p>
        </div>
      </div>

      <DmsCard :padded="false">
        <TranslationMatrix
          :rows="matrixRows"
          :columns="displayColumns"
          :editable="canEditValues"
          :show-inherited="isDefault"
          :overridable="showOverride"
          :manage-keys="canManageKeys"
          :reset-key="`${selectedWorkspace}|${filter}|${search}`"
          @save="onSave"
          @rename="openRenameKey"
          @remove="requestDeleteKey"
          @override="overrideKey"
        />
      </DmsCard>
    </div>

    <DmsLangLanguageAddModal v-model:open="langAddOpen" @added="reload" />

    <UModal
      v-model:open="keyAddOpen"
      :title="$t('dms_lang.translation.ws_add_key')"
    >
      <template #body>
        <UFormField
          :label="$t('dms_lang.translation.ws_key_path')"
          :help="$t('dms_lang.translation.ws_key_path_help')"
        >
          <UInput
            v-model="keyAddForm.path"
            class="w-full"
            placeholder="menu.home.title"
          />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('dms_lang.translation.ws_cancel')"
            @click="keyAddOpen = false"
          />
          <UButton
            :label="$t('dms_lang.translation.ws_add')"
            @click="submitAddKey"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="keyRenameOpen"
      :title="$t('dms_lang.translation.ws_rename_key')"
    >
      <template #body>
        <UFormField
          :label="$t('dms_lang.translation.ws_new_path')"
          :help="$t('dms_lang.translation.ws_key_path_help')"
        >
          <UInput v-model="keyRenameForm.newPath" class="w-full" />
        </UFormField>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('dms_lang.translation.ws_cancel')"
            @click="keyRenameOpen = false"
          />
          <UButton
            :label="$t('dms_lang.translation.ws_save')"
            @click="submitRenameKey"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
