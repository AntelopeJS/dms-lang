<script setup lang="ts">
import type { WorkspaceDetails, WorkspaceType } from '../../types/lang'
import type { WorkspaceBackup } from '../../utils/workspaceBackup'
import { canonicalLocale, searchLanguages } from '../../utils/languages'
import { PUBLIC_URL_METHOD } from '../../utils/workspaces'
import LanguagePicker from './LanguagePicker.vue'
import FormFieldRow from './form/FormFieldRow.vue'
import FormRows from './form/FormRows.vue'
import WorkspaceDetailsFields from './form/WorkspaceDetailsFields.vue'

interface Emits {
  close: [workspace: string | null]
}

interface Props {
  /** A backup or a JSON of languages to create the workspace from. */
  backup?: WorkspaceBackup
}

const DEFAULT_BASE = 'en'

const props = withDefaults(defineProps<Props>(), { backup: undefined })
const emit = defineEmits<Emits>()

const { t } = useI18n()
const { createWorkspace, importWorkspace } = useI18nWorkspaces()
const { tryMutate } = useMutationToast()
const { findLanguages, languageOption } = useLocaleNames()
const links = useLangLinks()

const backupCodes = computed(() =>
  Object.keys(props.backup?.messages ?? {}).map(
    (code) => canonicalLocale(code) ?? code,
  ),
)
const mode = computed(() => (props.backup ? 'import' : 'create'))

const isOpen = ref(true)
const name = ref(props.backup?.id ?? '')
const base = ref(
  canonicalLocale(props.backup?.defaultLocale ?? '') ??
    backupCodes.value[0] ??
    DEFAULT_BASE,
)
const baseSearch = ref('')
const description = ref(props.backup?.description ?? '')
const type = ref<WorkspaceType | undefined>(props.backup?.type)
const isSubmitting = ref(false)
const check = useWorkspaceNameCheck(name)

const languageOptions = computed(() =>
  props.backup
    ? searchLanguages(backupCodes.value.map(languageOption), baseSearch.value)
    : findLanguages(baseSearch.value),
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

function detailsOf(): WorkspaceDetails {
  const text = description.value.trim()
  return {
    ...(text ? { description: text } : {}),
    ...(type.value ? { type: type.value } : {}),
  }
}

/** The backup with the details as the form leaves them: a field emptied clears the backup's. */
function importOf(backup: WorkspaceBackup) {
  return {
    ...backup,
    description: description.value.trim() || null,
    type: type.value ?? null,
    defaultLocale: base.value,
  }
}

function send(id: string): Promise<unknown> {
  if (!props.backup)
    return createWorkspace(id, { code: base.value }, detailsOf())
  return importWorkspace(id, importOf(props.backup))
}

async function submit() {
  if (!check.isValid.value || isSubmitting.value) return
  isSubmitting.value = true
  check.freeze()
  const id = check.normalized.value
  const ok = await tryMutate(() => send(id))
  if (!ok) {
    check.thaw()
    isSubmitting.value = false
    return
  }
  close(id)
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="$t(`dms_lang.workspace_${mode}.title`)"
    :description="
      $t(`dms_lang.workspace_${mode}.description`, backupCodes.length)
    "
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
              <LanguagePicker
                :id="id"
                v-model="base"
                v-model:search="baseSearch"
                :options="languageOptions"
              />
            </template>
          </FormFieldRow>
          <WorkspaceDetailsFields
            v-model:description="description"
            v-model:type="type"
          />
        </FormRows>
        <div
          class="border-default flex items-center gap-2.5 rounded-md border border-dashed px-3 py-2"
        >
          <DmsStatusPill
            tone="success"
            size="sm"
            :label="PUBLIC_URL_METHOD"
            dot="none"
          />
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
          :disabled="isSubmitting"
          @click="close(null)"
        />
        <UButton
          :icon="props.backup ? 'i-ph-upload-simple' : 'i-ph-plus'"
          :loading="isSubmitting"
          :disabled="!check.isValid.value"
          :label="$t(`dms_lang.workspace_${mode}.submit`)"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
