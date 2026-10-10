<script setup lang="ts">
interface Props {
  text: string
}

interface TextPart {
  value: string
  isToken: boolean
}

const TOKEN_SPLIT = /(\{\s*[\w.-]+\s*\})/g
const TOKEN_MATCH = /^\{\s*[\w.-]+\s*\}$/

const props = defineProps<Props>()

const parts = computed<TextPart[]>(() =>
  props.text
    .split(TOKEN_SPLIT)
    .filter(Boolean)
    .map((value) => ({ value, isToken: TOKEN_MATCH.test(value) })),
)
</script>

<template>
  <span class="whitespace-pre-wrap break-words">
    <template v-for="(part, index) in parts" :key="index">
      <span
        v-if="part.isToken"
        class="text-secondary bg-secondary/10 rounded px-1 font-mono text-[0.92em]"
      >
        {{ part.value }}
      </span>
      <template v-else>{{ part.value }}</template>
    </template>
  </span>
</template>
