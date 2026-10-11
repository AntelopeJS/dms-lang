<script setup lang="ts">
import { QUEUE_KEYS } from '../../../utils/shortcuts'
import ShortcutKbds from '../ShortcutKbds.vue'
import { useQueue } from '../../composables/useQueueContext'

const { canEditValues } = useWorkspaceContext()
const { session, save, skip } = useQueue()
const { isSaving, isArmed } = save
</script>

<template>
  <div class="border-default border-t px-4 py-3">
    <div class="flex flex-wrap items-center gap-2">
      <UButton
        icon="i-ph-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        :disabled="!session.canGoBack.value"
        @click="session.previous()"
      >
        {{ $t('dms_lang.queue.previous') }}
        <ShortcutKbds :keys="QUEUE_KEYS.previous" />
      </UButton>
      <div class="flex-1" />
      <UButton color="neutral" variant="outline" size="sm" @click="skip">
        {{ $t('dms_lang.queue.skip') }}
        <ShortcutKbds :keys="QUEUE_KEYS.skip" />
      </UButton>
      <UButton
        v-if="canEditValues"
        icon="i-ph-check"
        size="sm"
        :color="isArmed ? 'warning' : 'primary'"
        :loading="isSaving"
        @click="save.save()"
      >
        {{
          isArmed
            ? $t('dms_lang.queue.save_anyway')
            : $t('dms_lang.queue.save_next')
        }}
        <ShortcutKbds :keys="QUEUE_KEYS.saveNext" />
      </UButton>
    </div>
    <p class="text-dimmed mt-2 text-xs">
      <i18n-t keypath="dms_lang.queue.shortcuts_hint" scope="global" tag="span">
        <template #leave>
          <ShortcutKbds :keys="QUEUE_KEYS.leaveField" />
        </template>
        <template #skip>
          <ShortcutKbds :keys="QUEUE_KEYS.skip" />
        </template>
        <template #previous>
          <ShortcutKbds :keys="QUEUE_KEYS.previous" />
        </template>
      </i18n-t>
    </p>
  </div>
</template>
