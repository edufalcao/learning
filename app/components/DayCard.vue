<script setup lang="ts">
import { useProgress } from '~/composables/useProgress'

const props = defineProps<{
  day: number
  title: string
  tag: string
  weekColor: string
  courseSlug: string
  isReview?: boolean
}>()

const dayNum = computed(() => String(props.day).padStart(2, '0'))
const { isComplete } = useProgress()
const completed = computed(() => isComplete(props.courseSlug, `day-${dayNum.value}`))
</script>

<template>
  <NuxtLink
    :to="`/${courseSlug}/day-${dayNum}`"
    class="group block rounded-xl border bg-surface p-4 no-underline transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40"
    :class="[
      isReview ? 'border-dashed border-border' : 'border-border',
      `hover:border-${weekColor}`,
    ]"
    :style="{ '--hover-color': weekColor === 'week1' ? '#3B82F6' : weekColor === 'week2' ? '#10B981' : weekColor === 'week3' ? '#8B5CF6' : '#F59E0B' }"
  >
    <div
      class="mb-1.5 flex items-center gap-1.5 text-[0.72rem] font-bold uppercase tracking-wider text-text-muted transition-colors group-hover:text-[var(--hover-color)]"
    >
      <span v-if="completed" class="text-emerald-400 text-[0.65rem]">✓</span>
      Day {{ dayNum }}
    </div>
    <div class="text-sm font-medium leading-snug text-text-main">
      {{ title }}
    </div>
    <span class="mt-2.5 inline-block rounded bg-surface-2 px-2 py-0.5 text-[0.68rem] text-text-muted">
      {{ tag }}
    </span>
  </NuxtLink>
</template>
