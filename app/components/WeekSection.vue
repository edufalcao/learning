<script setup lang="ts">
import type { WeekInfo } from '~/composables/useDays';

defineProps<{
  week: WeekInfo,
  courseSlug: string
}>();

const weekColorMap: Record<string, string> = {
  week1: '#3B82F6',
  week2: '#10B981',
  week3: '#8B5CF6',
  week4: '#FF006E'
};
</script>

<template>
  <div class="mb-14">
    <div class="mb-5 flex items-center gap-3">
      <span
        class="rounded px-2.5 py-1 text-[0.8rem] font-bold uppercase tracking-widest"
        :style="{
          color: weekColorMap[week.color],
          background: weekColorMap[week.color] + '14'
        }"
      >
        Week {{ week.number }}
      </span>
      <span class="text-lg font-semibold text-text-main">
        {{ week.name }}
        <span class="font-normal text-text-muted"> — {{ week.subtitle }}</span>
      </span>
    </div>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      <DayCard
        v-for="day in week.days"
        :key="day.day"
        :day="day.day"
        :title="day.title"
        :tag="day.tag"
        :week-color="week.color"
        :course-slug="courseSlug"
        :is-review="day.tag === 'review'"
      />
    </div>
  </div>
</template>
