<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import LocaleTile from '../build/components/LocaleTile.vue'

const DESCRIPTION_ROWS = 2

const { t } = useI18n()
const { current, canManage, isAdded, isUnknown, allows } = useWorkspaceContext()
const { flat, isLoaded } = useWorkspaceFlat()
const { fullName } = useLocaleNames()
const { addLanguage, makeBase } = useLanguageActions()
const { updateDetails } = useWorkspaceActions()
const { typeItems, typeOf, descriptionMax } = useWorkspaceTypes()
const { route } = useWorkspaceRoute()
const links = useLangLinks()

const workspaceId = computed(() => route.query.workspace ?? '')
const canEditDetails = computed(
  () => canManage.value && allows('editWorkspace'),
)
const canManageLanguages = computed(
  () => canManage.value && allows('manageLanguages'),
)
const kind = computed(() => current.value?.kind ?? 'default')
const baseItems = computed(() =>
  flat.value.locales.map((code) => ({
    label: `${fullName(code)} · ${code}`,
    value: code,
  })),
)
const baseModel = computed({
  get: () => flat.value.defaultLocale,
  set: (code: string) => {
    if (code !== flat.value.defaultLocale) void makeBase(code)
  },
})

const description = ref('')
watch(
  () => current.value?.description,
  (text) => {
    description.value = text ?? ''
  },
  { immediate: true },
)

async function saveDescription() {
  const text = description.value.trim()
  if (text === (current.value?.description ?? '')) return
  await updateDetails(workspaceId.value, { description: text || null })
}

function pickType(value: unknown) {
  const type = typeOf(value)
  if (type && type !== current.value?.type)
    void updateDetails(workspaceId.value, { type })
}

usePageHeaderActions(() =>
  h(UButton, {
    label: t('dms_lang.workspace.open_overview'),
    icon: 'i-ph-gauge',
    color: 'neutral',
    variant: 'outline',
    to: links.overview(),
  }),
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
          @blur="saveDescription"
        />
        <p v-else class="text-highlighted text-sm">
          {{ current?.description || '—' }}
        </p>
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
      </DmsFieldRow>
    </template>

    <DmsFieldRow
      layout="form"
      :label="$t('dms_lang.workspace.base_label')"
      :description="$t('dms_lang.workspace.base_help')"
    >
      <USkeleton v-if="!isLoaded" class="h-8 w-64" />
      <USelect
        v-else-if="canManageLanguages"
        v-model="baseModel"
        :items="baseItems"
        class="w-full max-w-xs"
      >
        <template #leading>
          <LocaleTile :code="flat.defaultLocale" size="sm" is-base />
        </template>
      </USelect>
      <span
        v-else
        class="text-highlighted inline-flex items-center gap-2 text-sm"
      >
        <LocaleTile :code="flat.defaultLocale" size="sm" is-base />
        {{ fullName(flat.defaultLocale) }}
        <span class="text-dimmed font-mono text-xs">
          {{ flat.defaultLocale }}
        </span>
      </span>
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
