<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import { useDmsRouter } from '#dms/frontend-module'
import LocaleTile from '../build/components/LocaleTile.vue'

const { t } = useI18n()
const { setDefaultLocale } = useI18nWorkspaces()
const { current, canManage, isAdded } = useWorkspaceContext()
const { flat, isLoaded, reload } = useWorkspaceFlat()
const { nativeName } = useLocaleNames()
const { addLanguage } = useLanguageActions()
const { renameWorkspace } = useWorkspaceActions()
const { tryMutate } = useMutationToast()
const { route } = useWorkspaceRoute()
const router = useDmsRouter()
const links = useLangLinks()

const workspaceId = computed(() => route.query.workspace ?? '')
const baseItems = computed(() =>
  flat.value.locales.map((code) => ({
    label: `${nativeName(code)} · ${code}`,
    value: code,
  })),
)
const baseModel = computed({
  get: () => flat.value.defaultLocale,
  set: (code: string) => {
    void changeBase(code)
  },
})

async function changeBase(code: string) {
  if (code === flat.value.defaultLocale) return
  const ok = await tryMutate(() => setDefaultLocale(workspaceId.value, code))
  if (ok) await reload()
}

async function rename() {
  const renamed = await renameWorkspace(workspaceId.value)
  if (renamed) await router.replace(links.workspaceSettings(renamed))
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
    :title="$t('dms_lang.workspace.general_title')"
    :description="
      isAdded
        ? $t('dms_lang.workspace.general_description')
        : $t(
            `dms_lang.workspace_kinds.${current?.kind ?? 'default'}.description`,
          )
    "
  >
    <DmsFieldRow
      layout="form"
      :label="$t('dms_lang.workspace_name.label')"
      :description="$t('dms_lang.workspace.name_help')"
    >
      <div class="flex gap-2">
        <DmsInputText
          :model-value="workspaceId"
          readonly
          class="flex-1"
          :ui="{ base: 'font-mono' }"
        />
        <UButton
          v-if="canManage"
          color="neutral"
          variant="outline"
          :label="$t('dms_lang.workspace.rename')"
          @click="rename"
        />
      </div>
    </DmsFieldRow>

    <DmsFieldRow
      layout="form"
      :label="$t('dms_lang.workspace.base_label')"
      :description="$t('dms_lang.workspace.base_help')"
    >
      <USkeleton v-if="!isLoaded" class="h-8 w-64" />
      <USelect
        v-else-if="canManage"
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
        {{ nativeName(flat.defaultLocale) }}
        <span class="text-dimmed font-mono text-xs">
          {{ flat.defaultLocale }}
        </span>
      </span>
    </DmsFieldRow>

    <DmsFieldRow
      v-if="canManage"
      layout="inline"
      :label="$t('dms_lang.workspace.languages_label')"
      :description="
        $t(`dms_lang.workspace_kinds.${current?.kind ?? 'default'}.files`, {
          name: workspaceId,
        })
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
