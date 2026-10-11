<script setup lang="ts">
import { scanMessage, type MessagePartKind } from '../../utils/translations'

interface Props {
  text: string
}

interface TextPart {
  label: string
  title?: string
  classes?: string
}

const CHIP = 'rounded px-1 font-mono text-[0.92em]'
const PART_CLASSES: Partial<Record<MessagePartKind, string>> = {
  placeholder: `text-secondary bg-secondary/10 ${CHIP}`,
  literal: `text-default bg-(--dms-bg-muted) ${CHIP}`,
  linked: `text-info bg-info/10 ${CHIP}`,
  pipe: `text-dimmed mx-0.5 ${CHIP}`,
}

const props = defineProps<Props>()

const parts = computed<TextPart[]>(() =>
  scanMessage(props.text).parts.map((part) => ({
    label: part.kind === 'literal' ? part.name : part.raw,
    title: part.kind === 'literal' ? part.raw : undefined,
    classes: PART_CLASSES[part.kind],
  })),
)
</script>

<template>
  <span class="break-words whitespace-pre-wrap">
    <template v-for="(part, index) in parts" :key="index">
      <span v-if="part.classes" :class="part.classes" :title="part.title">
        {{ part.label }}
      </span>
      <template v-else>{{ part.label }}</template>
    </template>
  </span>
</template>
