<script setup lang="ts">
import type { LanguageCoverage } from '../../../types/lang'
import LocaleTile from '../LocaleTile.vue'
import {
  COVERAGE_TEXT_CLASSES,
  coverageTone,
} from '../../../utils/translations'

interface Props {
  languages: LanguageCoverage[]
  canManage: boolean
}

interface Emits {
  add: []
  remove: [code: string]
}

type MoveDirection = -1 | 1

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const order = defineModel<string[]>('order', { required: true })

const dragged = ref<string | null>(null)

const rows = computed(() => {
  const byCode = new Map(props.languages.map((entry) => [entry.code, entry]))
  const shown = order.value
    .map((code) => byCode.get(code))
    .filter((entry): entry is LanguageCoverage => Boolean(entry))
  const hidden = props.languages.filter(
    (entry) => !order.value.includes(entry.code),
  )
  return [
    ...shown.map((entry) => ({ ...entry, shown: true })),
    ...hidden.map((entry) => ({ ...entry, shown: false })),
  ]
})

function toggle(code: string) {
  order.value = order.value.includes(code)
    ? order.value.filter((entry) => entry !== code)
    : [...order.value, code]
}

function moveTo(code: string, target: string) {
  const next = order.value.filter((entry) => entry !== code)
  next.splice(next.indexOf(target), 0, code)
  order.value = next
}

function move(code: string, direction: MoveDirection) {
  const index = order.value.indexOf(code)
  const target = index + direction
  if (index < 0 || target < 0 || target >= order.value.length) return
  const next = [...order.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  order.value = next
}

function onDrop(target: string) {
  if (
    dragged.value &&
    dragged.value !== target &&
    order.value.includes(target)
  ) {
    moveTo(dragged.value, target)
  }
  dragged.value = null
}
</script>

<template>
  <UPopover :content="{ align: 'end' }">
    <UButton
      icon="i-ph-columns"
      color="neutral"
      variant="outline"
      size="sm"
      :label="
        $t('dms_lang.matrix.languages', {
          shown: order.length,
          total: props.languages.length,
        })
      "
    />
    <template #content>
      <div class="w-80 p-1.5">
        <DmsEyebrow
          :label="$t('dms_lang.matrix.columns_hint')"
          size="xs"
          class="px-2 pb-2 pt-1.5"
        />
        <ul class="space-y-0.5">
          <li
            v-for="row in rows"
            :key="row.code"
            class="hover:bg-elevated/50 flex items-center gap-2 rounded-md px-2 py-1.5"
            :class="dragged === row.code ? 'opacity-50' : undefined"
            :draggable="row.shown"
            @dragstart="dragged = row.code"
            @dragend="dragged = null"
            @dragover.prevent
            @drop.prevent="onDrop(row.code)"
          >
            <button
              type="button"
              class="text-dimmed cursor-grab rounded focus-visible:outline"
              :class="row.shown ? undefined : 'invisible'"
              :aria-label="$t('dms_lang.matrix.reorder', { name: row.name })"
              @keydown.up.prevent="move(row.code, -1)"
              @keydown.down.prevent="move(row.code, 1)"
            >
              <UIcon name="i-ph-dots-six-vertical" class="size-4" />
            </button>
            <UCheckbox
              :model-value="row.shown"
              :aria-label="row.name"
              @update:model-value="toggle(row.code)"
            />
            <LocaleTile :code="row.code" size="sm" :is-base="row.isBase" />
            <span class="min-w-0 flex-1 truncate text-sm">{{ row.name }}</span>
            <span
              class="font-mono text-[10.5px]"
              :class="
                row.isBase
                  ? 'text-dimmed'
                  : COVERAGE_TEXT_CLASSES[coverageTone(row.coverage)]
              "
            >
              {{ row.isBase ? $t('dms_lang.common.base') : `${row.coverage}%` }}
            </span>
            <UButton
              v-if="props.canManage && !row.isBase"
              icon="i-ph-trash"
              color="error"
              variant="ghost"
              size="xs"
              :aria-label="
                $t('dms_lang.languages.remove_named', { name: row.name })
              "
              @click="emit('remove', row.code)"
            />
          </li>
        </ul>
        <template v-if="props.canManage">
          <USeparator class="my-1.5" />
          <UButton
            icon="i-ph-plus"
            color="neutral"
            variant="ghost"
            size="sm"
            block
            :label="$t('dms_lang.languages.add')"
            @click="emit('add')"
          />
        </template>
      </div>
    </template>
  </UPopover>
</template>
