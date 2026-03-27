<script setup lang="ts">
import { groupByWeek } from '~/composables/useDays';
import type { DayInfo } from '~/composables/useDays';
import { useProgress } from '~/composables/useProgress';

const route = useRoute();
const courseSlug = computed(() => route.params.course as string);

const { getCompletedCount, getCompletedSlugs } = useProgress();
const completedCount = ref(0);
const completedSlugs = ref<string[]>([]);

onMounted(() => {
  completedCount.value = getCompletedCount(courseSlug.value);
  completedSlugs.value = getCompletedSlugs(courseSlug.value);
});

// Map course slugs to collection names
const collectionMap: Record<string, string> = {
  'agentic-coding': 'agentic_coding'
};

const collectionName = computed(() => collectionMap[courseSlug.value] || courseSlug.value);

// Fetch course metadata
const { data: allCourses } = await useAsyncData(`course-meta-${courseSlug.value}`, () =>
  queryCollection('courses').all()
);

const course = computed(() =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allCourses.value?.find((c: any) => c.slug === courseSlug.value)
);

// Fetch all days for this course
const { data: rawDays } = await useAsyncData(`course-days-${courseSlug.value}`, () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryCollection(collectionName.value as any).order('day', 'ASC').all()
);

const days = computed<DayInfo[]>(() =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (rawDays.value || []).map((d: any) => ({
    day: d.day,
    title: d.title,
    slug: d.stem || `day-${String(d.day).padStart(2, '0')}`,
    week: d.week,
    weekName: d.weekName,
    tag: d.tag,
    description: d.description
  }))
);

const weeks = computed(() => groupByWeek(days.value));

useHead({
  title: () => course.value ? `${course.value.title} — Eduardo Falcão` : 'Course'
});

useSeoMeta({
  ogTitle: () => course.value?.title || '',
  ogDescription: () => course.value?.description || ''
});
</script>

<template>
  <div v-if="course">
    <!-- Hero -->
    <section class="mx-auto max-w-[820px] px-8 pb-16 pt-20 text-center">
      <div
        class="mx-auto mb-6 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.85rem] tracking-wide"
        :style="{
          color: course.color,
          borderColor: course.color + '33',
          background: course.color + '14'
        }"
      >
        <span class="text-[0.55rem]">●</span>
        {{ course.lessons }} lessons · Eduardo Falcão
      </div>

      <h1 class="mb-5 font-display text-5xl font-extrabold leading-tight tracking-tight text-[var(--color-headings)] sm:text-6xl">
        {{ course.title.replace('30 Days of ', '30 Days of\n').split('\n')[0] }}<br>
        <span :style="{ color: course.color }">
          {{ course.title.replace('30 Days of ', '').trim() || course.title }}
        </span>
      </h1>

      <p class="mx-auto mb-10 max-w-[540px] text-lg leading-relaxed text-text-muted sm:text-xl">
        {{ course.description }}
        One lesson per day. Each under 10 minutes.
      </p>

      <div class="flex flex-wrap justify-center gap-2">
        <span
          v-for="week in course.weeks"
          :key="week.number"
          class="rounded-full border px-3 py-1 text-[0.85rem] font-medium"
          :style="{
            color: week.color,
            borderColor: week.color + '40',
            background: week.color + '0D'
          }"
        >
          Week {{ week.number }}: {{ week.name }}
        </span>
      </div>
    </section>

    <!-- Progress Bar -->
    <ProgressBar
      :weeks="course.weeks"
      :total-lessons="course.lessons"
      :completed="completedCount"
      :completed-slugs="completedSlugs"
    />

    <!-- Weeks Grid -->
    <section
      id="weeks"
      class="mx-auto max-w-[900px] px-8 pb-24"
    >
      <WeekSection
        v-for="week in weeks"
        :key="week.number"
        :week="week"
        :course-slug="courseSlug"
      />
    </section>
  </div>
</template>
