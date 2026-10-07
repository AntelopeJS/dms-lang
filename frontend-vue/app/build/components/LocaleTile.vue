<script setup lang="ts">
type LocaleTileSize = 'sm' | 'md' | 'lg'

interface Props {
  code: string
  size?: LocaleTileSize
  isBase?: boolean
}

const SIZE_CLASSES: Record<LocaleTileSize, string> = {
  sm: 'h-[18px] w-5 rounded-[5px] text-[9px]',
  md: 'size-7 rounded-[7px] text-[10.5px]',
  lg: 'size-10 rounded-[10px] text-[13px]',
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  isBase: false,
})

const { tileOf } = useLocaleNames()
</script>

<template>
  <span
    class="inline-grid shrink-0 place-items-center font-mono font-bold tracking-[0.04em]"
    :class="[
      SIZE_CLASSES[props.size],
      props.isBase
        ? 'bg-(--dms-accent-tint-strong) text-primary ring-(--dms-accent-line) ring-1 ring-inset'
        : 'bg-elevated text-toned ring-accented ring-1 ring-inset',
    ]"
    aria-hidden="true"
  >
    {{ tileOf(props.code) }}
  </span>
</template>
