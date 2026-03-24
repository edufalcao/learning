<script setup lang="ts">
import { getWeekMeta } from '~/composables/useDays'

const props = defineProps<{
  days: Array<{ day: number; title: string; week: number }>
  currentDay: number
  courseSlug: string
}>()

const weekColorMap: Record<number, string> = {
  1: '#3B82F6',
  2: '#10B981',
  3: '#8B5CF6',
  4: '#F59E0B',
}

const weeks = computed(() => {
  const grouped: Record<number, typeof props.days> = {}
  for (const d of props.days) {
    if (!grouped[d.week]) grouped[d.week] = []
    grouped[d.week].push(d)
  }
  return Object.entries(grouped)
    .map(([num, days]) => ({
      number: Number(num),
      meta: getWeekMeta(Number(num)),
      days: days.sort((a, b) => a.day - b.day),
    }))
    .sort((a, b) => a.number - b.number)
})

function daySlug(day: number) {
  return `/${props.courseSlug}/day-${String(day).padStart(2, '0')}`
}
</script>

<template>
  <aside class="sticky top-14 hidden h-[calc(100vh-56px)] w-60 shrink-0 overflow-y-auto border-r border-border py-6 lg:block">
    <div v-for="week in weeks" :key="week.number" class="mb-4">
      <div
        class="px-4 pb-1 text-[0.68rem] font-bold uppercase tracking-widest"
        :style="{ color: weekColorMap[week.number] }"
      >
        Week {{ week.number }} — {{ week.meta.name }}
      </div>
      <NuxtLink
        v-for="d in week.days"
        :key="d.day"
        :to="daySlug(d.day)"
        class="flex items-center gap-2 border-r-2 px-4 py-1.5 text-[0.82rem] no-underline transition-all duration-100"
        :class="
          d.day === currentDay
            ? 'border-r-brand bg-brand/5 text-brand'
            : 'border-r-transparent text-text-muted hover:bg-white/[0.03] hover:text-text-main'
        "
      >
        <span class="min-w-[28px] text-[0.7rem]" :class="d.day === currentDay ? 'text-brand/70' : 'text-text-muted'">
          {{ String(d.day).padStart(2, '0') }}
        </span>
        <span class="truncate">{{ d.title }}</span>
      </NuxtLink>
    </div>
  </aside>
</template>
