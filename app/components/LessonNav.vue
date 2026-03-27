<script setup lang="ts">
const props = defineProps<{
  prevDay?: { day: number; title: string } | null
  nextDay?: { day: number; title: string } | null
  courseSlug: string
}>()

function daySlug(day: number) {
  return `/${props.courseSlug}/day-${String(day).padStart(2, '0')}`
}
</script>

<template>
  <div class="mt-16 grid grid-cols-2 gap-4 border-t border-border pt-8">
    <NuxtLink
      v-if="prevDay"
      :to="daySlug(prevDay.day)"
      class="group flex flex-col rounded-xl border border-border bg-surface p-4 no-underline transition-all duration-150 ease-smooth hover:-translate-y-px hover:border-accent hover-glow"
    >
      <span class="mb-1 text-[0.72rem] uppercase tracking-wider text-text-muted">← Previous</span>
      <span class="text-sm font-medium text-text-main">Day {{ String(prevDay.day).padStart(2, '0') }}: {{ prevDay.title }}</span>
    </NuxtLink>
    <NuxtLink
      v-else
      :to="`/${courseSlug}/`"
      class="group flex flex-col rounded-xl border border-border bg-surface p-4 no-underline transition-all duration-150 ease-smooth hover:-translate-y-px hover:border-accent hover-glow"
    >
      <span class="mb-1 text-[0.72rem] uppercase tracking-wider text-text-muted">← Back</span>
      <span class="text-sm font-medium text-text-main">All Lessons</span>
    </NuxtLink>

    <NuxtLink
      v-if="nextDay"
      :to="daySlug(nextDay.day)"
      class="group flex flex-col rounded-xl border border-border bg-surface p-4 text-right no-underline transition-all duration-150 ease-smooth hover:-translate-y-px hover:border-accent hover-glow"
    >
      <span class="mb-1 text-[0.72rem] uppercase tracking-wider text-text-muted">Next →</span>
      <span class="text-sm font-medium text-text-main">Day {{ String(nextDay.day).padStart(2, '0') }}: {{ nextDay.title }}</span>
    </NuxtLink>
  </div>
</template>
