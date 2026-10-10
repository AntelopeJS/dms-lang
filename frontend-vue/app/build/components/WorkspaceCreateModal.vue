<script setup lang="ts">
import LocaleTile from './LocaleTile.vue'
import FormFieldRow from './form/FormFieldRow.vue'
import FormRows from './form/FormRows.vue'
import { SUGGESTED_LANGUAGE_CODES } from '../../utils/languages'

interface LanguageItem {
  label: string
  value: string
  description: string
}

const DEFAULT_BASE = 'en'

const emit = defineEmits<{ close: [workspace: string | null] }>()

const { t } = useI18n()
const { createWorkspace, fetchWorkspaces } = useI18nWorkspaces()
const { tryMutate } = useMutationToast()
const { nativeName } = useLocaleNames()
const links = useLangLinks()

const isOpen = ref(true)
const name = ref('')
const base = ref(DEFAULT_BASE)
const isSubmitting = ref(false)
const check = useWorkspaceNameCheck(name)

const languageItems = computed<LanguageItem[]>(() =>
  SUGGESTED_LANGUAGE_CODES.map((code) => ({
    label: nativeName(code),
    value: code,
    description: code,
  })),
)

const previewUrl = computed(() =>
  links.publicLocaleUrl(
    check.normalized.value || t('dms_lang.workspace_name.placeholder'),
  ),
)

function close(workspace: string | null) {
  isOpen.value = false
  emit('close', workspace)
}

async function submit() {
  if (!check.isValid.value || isSubmitting.value) return
  isSubmitting.value = true
  const id = check.normalized.value
  const ok = await tryMutate(() => createWorkspace(id, { code: base.value }))
  isSubmitting.value = false
  if (!ok) return
  await fetchWorkspaces()
  close(id)
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('dms_lang.workspace_create.title')"
    :description="$t('dms_lang.workspace_create.description')"
    :ui="{ content: 'sm:max-w-lg' }"
    @update:open="(open: boolean) => !open && close(null)"
  >
    <template #body>
      <form class="space-y-4" novalidate @submit.prevent="submit">
        <FormRows has-required>
          <FormFieldRow
            :label="$t('dms_lang.workspace_name.label')"
            :help="check.isError.value ? undefined : check.message.value"
            :error="check.isError.value ? check.message.value : null"
            required
          >
            <template #default="{ id }">
              <DmsInputText
                :id="id"
                v-model="name"
                autofocus
                class="w-full"
                :placeholder="$t('dms_lang.workspace_name.placeholder')"
                :trailing-icon="
                  check.isValid.value ? 'i-ph-check-circle' : undefined
                "
                :ui="{ trailingIcon: 'text-success' }"
              />
            </template>
          </FormFieldRow>
          <FormFieldRow
            :label="$t('dms_lang.workspace_create.base')"
            :help="$t('dms_lang.workspace_create.base_help')"
            required
          >
            <template #default="{ id }">
              <USelectMenu
                :id="id"
                v-model="base"
                :items="languageItems"
                value-key="value"
                class="w-full"
              >
                <template #leading>
                  <LocaleTile :code="base" size="sm" />
                </template>
              </USelectMenu>
            </template>
          </FormFieldRow>
        </FormRows>
        <div
          class="border-default flex items-center gap-2.5 rounded-md border border-dashed px-3 py-2"
        >
          <DmsStatusPill tone="success" size="sm" label="GET" :dot="'none'" />
          <code class="text-muted min-w-0 truncate font-mono text-xs">
            {{ previewUrl }}
          </code>
        </div>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="outline"
          :label="$t('dms_lang.actions.cancel')"
          @click="close(null)"
        />
        <UButton
          icon="i-ph-plus"
          :loading="isSubmitting"
          :disabled="!check.isValid.value"
          :label="$t('dms_lang.workspace_create.submit')"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
