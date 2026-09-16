<script setup lang="ts">
const { isDefault, isModules, isEditable } = useWorkspaceContext();
</script>

<template>
  <UBadge
    :color="isEditable ? 'primary' : 'warning'"
    variant="subtle"
    :icon="isEditable ? 'i-lucide-pencil' : 'i-lucide-lock'"
  >
    {{
      isEditable
        ? $t("dms_lang.translation.ws_editable")
        : $t("dms_lang.translation.ws_read_only")
    }}
  </UBadge>

  <p v-if="isDefault" class="text-muted text-sm">
    {{ $t("dms_lang.translation.ws_default_hint") }}
  </p>
  <p v-else-if="isModules" class="text-muted text-sm">
    {{ $t("dms_lang.translation.ws_modules_hint") }}
  </p>
</template>
