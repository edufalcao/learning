<script setup lang="ts">
const props = defineProps<{
  weeks?: Array<{ number: number; name: string; color: string }>
  totalLessons?: number
}>()

// Default week config for backward compatibility
const defaultWeeks = [
  { class: 'bg-week1', count: 7 },
  { class: 'bg-week2', count: 7 },
  { class: 'bg-week3', count: 7 },
  { class: 'bg-week4', count: 9 },
]

const total = computed(() => props.totalLessons || 30)

const days = computed(() => {
  if (props.weeks) {
    const perWeek = Math.floor(total.value / props.weeks.length)
    const remainder = total.value % props.weeks.length
    return props.weeks.flatMap((w, i) => {
      const count = perWeek + (i === props.weeks!.length - 1 ? remainder : 0)
      return Array.from({ length: count }, () => ({ style: { background: w.color } }))
    })
  }
  return defaultWeeks.flatMap(w =>
    Array.from({ length: w.count }, () => ({ class: w.class }))
  )
})
</script>

<template>
  <div class="mx-auto max-w-[820px] px-8 pb-16">
    <div class="mb-2 flex justify-between text-xs text-text-muted">
      <span>{{ total }} days completed</span>
      <span class="text-brand">100%</span>
    </div>
    <div class="h-1 overflow-hidden rounded-full bg-border">
      <div class="h-full w-full rounded-full bg-gradient-to-r from-week1 via-week2 via-week3 to-week4" />
    </div>
    <div class="mt-3 flex gap-0.5">
      <div
        v-for="(day, i) in days"
        :key="i"
        class="h-[3px] flex-1 rounded-full"
        :class="day.class"
        :style="day.style"
      />
    </div>
  </div>
</template>
