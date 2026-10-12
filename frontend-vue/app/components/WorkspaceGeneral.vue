<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import type { WorkspaceType } from '../types/lang'
import type { SaveState } from '../utils/keySaves'
import LocaleTile from '../build/components/LocaleTile.vue'
import { useSaveStates } from '../build/composables/useKeySaves'

/** A setting of the page, each saved on its own. */
type DetailField = 'description' | 'type' | 'base'

const DESCRIPTION_ROWS = 2

const { current, canManage, isAdded, isUnknown, allows } = useWorkspaceContext()
const { fullName } = useLocaleNames()
const { addLanguage, makeBase } = useLanguageActions()
const { updateDetails } = useWorkspaceActions()
const { typeItems, typeOf, descriptionMax } = useWorkspaceTypes()
const { route } = useWorkspaceRoute()

const workspaceId = computed(() => route.query.workspace ?? '')
const canEditDetails = computed(
  () => canManage.value && allows('editWorkspace'),
)
const canManageLanguages = computed(
  () => canManage.value && allows('manageLanguages'),
)
const kind = computed(() => current.value?.kind ?? 'default')
const baseLocale = computed(() => current.value?.defaultLocale ?? '')
const baseItems = computed(() =>
  (current.value?.locales ?? []).map(({ code }) => ({
    label: `${fullName(code)} · ${code}`,
    value: code,
  })),
)
const saveStates = ref<Record<string, SaveState>>({})
const { stateOf, setState, flashSaved } = useSaveStates(saveStates)
const retries: Partial<Record<DetailField, () => void>> = {}

/** Saves one setting, its state shown next to it and in the header pill. */
async function track(field: DetailField, run: () => Promise<boolean>) {
  retries[field] = () => void track(field, run)
  setState(field, 'saving')
  if (await run()) flashSaved(field)
  else setState(field, 'error')
}

async function changeBase(code: string) {
  setState('base', 'saving')
  if (await makeBase(code)) flashSaved('base')
  else setState('base', 'idle')
}

const baseModel = computed({
  get: () => baseLocale.value,
  set: (code: string) => {
    if (code !== baseLocale.value) void changeBase(code)
  },
})

const description = ref('')
const isTypingDescription = ref(false)
watch(
  () => current.value?.description,
  (text) => {
    if (isTypingDescription.value || stateOf('description') === 'error') return
    description.value = text ?? ''
  },
  { immediate: true },
)

function saveDescription() {
  isTypingDescription.value = false
  const text = description.value.trim()
  if (text === (current.value?.description ?? '')) return
  void track('description', () =>
    updateDetails(workspaceId.value, { description: text || null }),
  )
}

function saveType(type: WorkspaceType) {
  void track('type', () => updateDetails(workspaceId.value, { type }))
}

function pickType(value: unknown) {
  const type = typeOf(value)
  if (type && type !== current.value?.type) saveType(type)
}

const hasInstantSaves = computed(
  () => canEditDetails.value || canManageLanguages.value,
)

const instantSaveBadge = resolveComponent('DmsInstantSaveBadge')

usePageHeaderActions(() =>
  hasInstantSaves.value
    ? h(instantSaveBadge, {
        state: combineSaveStates(Object.values(saveStates.value)),
      })
    : null,
)
</script>

<template>
  <DmsSection
    v-if="!isUnknown"
    :title="$t('dms_lang.workspace.general_title')"
    :description="
      isAdded
        ? $t('dms_lang.workspace.general_description')
        : $t(`dms_lang.workspace_kinds.${kind}.description`)
    "
  >
    <DmsFieldRow
      v-if="isAdded"
      layout="form"
      :label="$t('dms_lang.workspace_name.label')"
      :description="$t('dms_lang.workspace.name_help')"
    >
      <DmsInputText
        :model-value="workspaceId"
        readonly
        class="w-full"
        :ui="{ base: 'font-mono' }"
      />
    </DmsFieldRow>
    <DmsFieldRow
      v-else
      layout="form"
      :label="$t('dms_lang.workspace.source_label')"
      :description="$t(`dms_lang.workspace.source_help_${kind}`)"
    >
      <code class="text-muted font-mono text-xs break-all">
        {{ $t(`dms_lang.workspace_kinds.${kind}.folder`) }}
      </code>
    </DmsFieldRow>

    <template v-if="isAdded">
      <DmsFieldRow
        layout="form"
        :label="$t('dms_lang.workspace_details.description_label')"
        :description="$t('dms_lang.workspace_details.description_help')"
      >
        <DmsTextarea
          v-if="canEditDetails"
          v-model="description"
          :rows="DESCRIPTION_ROWS"
          :maxlength="descriptionMax"
          autoresize
          class="w-full"
          :placeholder="
            $t('dms_lang.workspace_details.description_placeholder')
          "
          @focus="isTypingDescription = true"
          @blur="saveDescription"
        />
        <p v-else class="text-highlighted text-sm">
          {{ current?.description || '—' }}
        </p>
        <template #details>
          <DmsSaveStatus
            :state="stateOf('description')"
            @retry="retries.description?.()"
          />
        </template>
      </DmsFieldRow>
      <DmsFieldRow
        layout="form"
        :label="$t('dms_lang.workspace_details.type_label')"
      >
        <DmsSegmentedSelect
          :model-value="current?.type"
          @update:model-value="pickType"
          :items="typeItems"
          :disabled="!canEditDetails"
        />
        <template #details>
          <DmsSaveStatus :state="stateOf('type')" @retry="retries.type?.()" />
        </template>
      </DmsFieldRow>
    </template>

    <DmsFieldRow
      layout="form"
      :label="$t('dms_lang.workspace.base_label')"
      :description="$t('dms_lang.workspace.base_help')"
    >
      <USkeleton v-if="!current" class="h-8 w-64" />
      <USelect
        v-else-if="canManageLanguages"
        v-model="baseModel"
        :items="baseItems"
        class="w-full max-w-xs"
      >
        <template #leading>
          <LocaleTile :code="baseLocale" size="sm" is-base />
        </template>
      </USelect>
      <span
        v-else
        class="text-highlighted inline-flex items-center gap-2 text-sm"
      >
        <LocaleTile :code="baseLocale" size="sm" is-base />
        {{ fullName(baseLocale) }}
        <span class="text-dimmed font-mono text-xs">
          {{ baseLocale }}
        </span>
      </span>
      <template #details>
        <DmsSaveStatus :state="stateOf('base')" />
      </template>
    </DmsFieldRow>

    <DmsFieldRow
      v-if="canManageLanguages"
      layout="inline"
      :label="$t('dms_lang.workspace.languages_label')"
      :description="
        $t(`dms_lang.workspace_kinds.${kind}.files`, { name: workspaceId })
      "
    >
      <UButton
        icon="i-ph-plus"
        color="neutral"
        variant="outline"
        size="sm"
        :label="$t('dms_lang.languages.add')"
        @click="addLanguage()"
      />
    </DmsFieldRow>
  </DmsSection>
</template>
