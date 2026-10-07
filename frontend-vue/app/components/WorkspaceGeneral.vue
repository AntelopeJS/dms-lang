<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import UButton from '@nuxt/ui/components/Button.vue'
import { useDmsRouter } from '#dms/frontend-module'
import type { LanguageCoverage } from '../types/lang'
import { coverageTone, languageCoverage } from '../utils/translations'
import LocaleTile from '../build/components/LocaleTile.vue'

const { t } = useI18n()
const { setDefaultLocale } = useI18nWorkspaces()
const { current, canManage, isAdded } = useWorkspaceContext()
const { flat, isLoaded, reload } = useWorkspaceFlat()
const { nativeName } = useLocaleNames()
const { addLanguage, removeLanguage, makeBase } = useLanguageActions()
const { renameWorkspace } = useWorkspaceActions()
const { tryMutate } = useMutationToast()
const { route } = useWorkspaceRoute()
const router = useDmsRouter()
const links = useLangLinks()

const workspaceId = computed(() => route.query.workspace ?? '')
const languages = computed<LanguageCoverage[]>(() => {
  const all = languageCoverage(flat.value, nativeName)
  return [
    ...all.filter((entry) => entry.isBase),
    ...all.filter((entry) => !entry.isBase),
  ]
})
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

function menuOf(entry: LanguageCoverage): DropdownMenuItem[][] {
  return [
    [
      {
        label: t('dms_lang.languages.open'),
        icon: 'i-ph-arrow-right',
        to: links.language(entry.code),
      },
    ],
    [
      {
        label: t('dms_lang.languages.make_base'),
        icon: 'i-ph-star',
        onSelect: () => makeBase(entry.code),
      },
      {
        label: t('dms_lang.languages.remove'),
        icon: 'i-ph-trash',
        color: 'error' as const,
        onSelect: () => removeLanguage(entry.code),
      },
    ],
  ]
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
        <UInput
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
      layout="form"
      :label="$t('dms_lang.workspace.languages_label')"
      :description="
        $t(`dms_lang.workspace_kinds.${current?.kind ?? 'default'}.files`, {
          name: workspaceId,
        })
      "
    >
      <div class="space-y-2">
        <ul class="border-default divide-default divide-y rounded-md border">
          <template v-if="!isLoaded">
            <li v-for="index in 3" :key="index" class="px-3 py-2.5">
              <USkeleton class="h-5 w-full" />
            </li>
          </template>
          <li
            v-for="entry in languages"
            v-else
            :key="entry.code"
            class="grid grid-cols-[auto_minmax(0,1fr)_6rem_auto] items-center gap-3 px-3 py-2"
          >
            <LocaleTile :code="entry.code" :is-base="entry.isBase" />
            <span class="min-w-0 truncate text-sm">
              <span class="text-highlighted font-medium">{{ entry.name }}</span>
              <span class="text-dimmed ml-1.5 font-mono text-xs">
                {{ entry.code }}
              </span>
            </span>
            <DmsMeter
              :value="entry.coverage"
              :max="100"
              format="none"
              size="xs"
              :tone="entry.isBase ? 'primary' : coverageTone(entry.coverage)"
            />
            <DmsStatusPill
              dot="none"
              v-if="entry.isBase"
              tone="neutral"
              size="sm"
              :label="$t('dms_lang.common.base')"
            />
            <UDropdownMenu
              v-else-if="canManage"
              :items="menuOf(entry)"
              :content="{ align: 'end' }"
            >
              <UButton
                icon="i-ph-dots-three"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="
                  $t('dms_lang.languages.more', { name: entry.name })
                "
              />
            </UDropdownMenu>
            <span v-else />
          </li>
        </ul>
        <UButton
          v-if="canManage"
          icon="i-ph-plus"
          color="neutral"
          variant="ghost"
          size="sm"
          :label="$t('dms_lang.languages.add')"
          @click="addLanguage()"
        />
      </div>
    </DmsFieldRow>
  </DmsSection>
</template>
