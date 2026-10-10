<script setup lang="ts">
import FormFieldRow from './form/FormFieldRow.vue'
import FormRows from './form/FormRows.vue'

interface Props {
  workspace: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [workspace: string | null] }>()

const { renameWorkspace, fetchWorkspaces } = useI18nWorkspaces()
const { tryMutate } = useMutationToast()
const links = useLangLinks()

const isOpen = ref(true)
const name = ref(props.workspace)
const isSubmitting = ref(false)
const check = useWorkspaceNameCheck(name, props.workspace)

function close(workspace: string | null) {
  isOpen.value = false
  emit('close', workspace)
}

async function submit() {
  if (!check.isValid.value || isSubmitting.value) return
  isSubmitting.value = true
  const id = check.normalized.value
  const ok = await tryMutate(() => renameWorkspace(props.workspace, id))
  isSubmitting.value = false
  if (!ok) return
  await fetchWorkspaces()
  close(id)
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('dms_lang.workspace_rename.title', { name: props.workspace })"
    :description="$t('dms_lang.workspace_rename.description')"
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
              <DmsInputText :id="id" v-model="name" autofocus class="w-full" />
            </template>
          </FormFieldRow>
        </FormRows>
        <div class="border-default space-y-2 rounded-md border px-3 py-2.5">
          <div>
            <DmsEyebrow
              :label="$t('dms_lang.workspace_rename.before')"
              size="xs"
            />
            <code class="text-muted break-all font-mono text-xs">
              {{ links.publicLocaleUrl(props.workspace) }}
            </code>
          </div>
          <UIcon name="i-ph-arrow-down" class="text-dimmed size-3.5" />
          <div>
            <DmsEyebrow
              :label="$t('dms_lang.workspace_rename.after')"
              size="xs"
            />
            <code class="text-highlighted break-all font-mono text-xs">
              {{
                links.publicLocaleUrl(check.normalized.value || props.workspace)
              }}
            </code>
          </div>
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
          color="warning"
          :loading="isSubmitting"
          :disabled="!check.isValid.value"
          :label="$t('dms_lang.workspace_rename.submit')"
          @click="submit"
        />
      </div>
    </template>
  </UModal>
</template>
