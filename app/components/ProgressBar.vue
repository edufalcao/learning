<script setup lang="ts">
const props = defineProps<{
  weeks?: Array<{ number: number, name: string, color: string }>,
  totalLessons?: number,
  completed?: number,
  completedSlugs?: string[]
}>();

const total = computed(() => props.totalLessons || 30);
const completedCount = computed(() => props.completed || 0);
const percent = computed(() => total.value > 0 ? Math.round((completedCount.value / total.value) * 100) : 0);
const fillWidth = computed(() => total.value > 0 ? (completedCount.value / total.value) * 100 : 0);

// Build a set of completed day indices (0-based) from slugs like "day-01"
const completedIndices = computed(() => {
  const set = new Set<number>();
  if (props.completedSlugs) {
    for (const slug of props.completedSlugs) {
      const match = slug.match(/day-(\d+)/);
      if (match) set.add(Number(match[1]) - 1);
    }
  }
  return set;
});

// Default week config for backward compatibility
const defaultWeeks = [
  { class: 'bg-week1', count: 7 },
  { class: 'bg-week2', count: 7 },
  { class: 'bg-week3', count: 7 },
  { class: 'bg-week4', count: 9 }
];

const days = computed(() => {
  let index = 0;
  if (props.weeks) {
    const perWeek = Math.floor(total.value / props.weeks.length);
    const remainder = total.value % props.weeks.length;
    return props.weeks.flatMap((w, i) => {
      const count = perWeek + (i === props.weeks!.length - 1 ? remainder : 0);
      return Array.from({ length: count }, () => {
        const done = completedIndices.value.has(index);
        index++;
        return { style: { background: done ? w.color : w.color + '30' }, done };
      });
    });
  }
  return defaultWeeks.flatMap(w =>
    Array.from({ length: w.count }, () => {
      const done = completedIndices.value.has(index);
      index++;
      return { class: done ? w.class : '', style: done ? undefined : { background: 'rgba(255,255,255,0.06)' }, done };
    })
  );
});
</script>

<template>
  <div class="mx-auto max-w-[820px] px-8 pb-16">
    <div class="mb-2 flex justify-between text-sm text-text-muted">
      <span>{{ completedCount }} of {{ total }} completed</span>
      <span :class="percent === 100 ? 'text-emerald-400' : 'text-accent'">{{ percent }}%</span>
    </div>
    <div class="h-1 overflow-hidden rounded-full bg-border">
      <div
        class="h-full rounded-full bg-gradient-to-r from-week1 via-week2 via-week3 to-week4 transition-all duration-500"
        :style="{ width: fillWidth + '%' }"
      />
    </div>
    <div class="mt-3 flex gap-0.5">
      <div
        v-for="(day, i) in days"
        :key="i"
        class="h-[3px] flex-1 rounded-full transition-all duration-300"
        :class="'class' in day ? day.class : undefined"
        :style="day.style"
      />
    </div>
  </div>
</template>
