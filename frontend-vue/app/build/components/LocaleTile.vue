<script setup lang="ts">
type LocaleTileSize = 'sm' | 'md' | 'lg'

interface Props {
  code: string
  size?: LocaleTileSize
  isBase?: boolean
  /**
   * The codes shown next to this one: when one of them shares its language
   * (pt-BR, pt-PT), the tile adds the region to tell them apart.
   */
  siblings?: string[]
}

const SIZE_CLASSES: Record<LocaleTileSize, string> = {
  sm: 'h-[18px] min-w-5 rounded-[5px] text-[9px]',
  md: 'h-7 min-w-7 rounded-[7px] text-[10.5px]',
  lg: 'h-10 min-w-10 rounded-[10px] text-[13px]',
}
const WIDE_PADDING: Record<LocaleTileSize, string> = {
  sm: 'px-1',
  md: 'px-1.5',
  lg: 'px-2',
}
const SHORT_TILE_LENGTH = 3

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  isBase: false,
  siblings: () => [],
})

const { tileOf } = useLocaleNames()

const letters = computed(() => tileOf(props.code, props.siblings))
</script>

<template>
  <span
    class="inline-grid shrink-0 place-items-center font-mono font-bold tracking-[0.04em]"
    :class="[
      SIZE_CLASSES[props.size],
      letters.length > SHORT_TILE_LENGTH ? WIDE_PADDING[props.size] : '',
      props.isBase
        ? 'text-primary bg-(--dms-accent-tint-strong) ring-1 ring-(--dms-accent-line) ring-inset'
        : 'bg-elevated text-toned ring-accented ring-1 ring-inset',
    ]"
    aria-hidden="true"
  >
    {{ letters }}
  </span>
</template>
