<script setup lang="ts">
import { useProgress } from '~/composables/useProgress';

const { data: courses } = await useAsyncData('all-courses', () =>
  queryCollection('courses').all()
);

const { getCompletedCount } = useProgress();
const courseProgress = ref<Record<string, number>>({});

onMounted(() => {
  const progress: Record<string, number> = {};
  for (const course of courses.value || []) {
    progress[course.slug] = getCompletedCount(course.slug);
  }
  courseProgress.value = progress;
});

useHead({
  title: 'Eduardo Falcão — learning hub'
});

useSeoMeta({
  ogTitle: 'Eduardo Falcão — learning hub',
  ogDescription: 'Structured learning series on software engineering & AI.'
});
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="mx-auto max-w-[820px] px-8 pb-16 pt-20 text-center">
      <div
        class="mx-auto mb-6 inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-[0.85rem] tracking-wide text-accent"
      >
        <span class="text-[0.55rem]">●</span>
        learning hub
      </div>

      <h1 class="mb-5 font-display text-5xl font-extrabold leading-tight tracking-tight text-[var(--color-headings)] sm:text-6xl">
        Eduardo Falcão<br>
        <span class="gradient-text">learning hub</span>
      </h1>

      <p class="mx-auto mb-12 max-w-[540px] text-lg leading-relaxed text-text-muted sm:text-xl">
        Structured learning series on software engineering & AI.
        Deep dives, one topic at a time.
      </p>
    </section>

    <!-- Course Grid -->
    <section class="mx-auto max-w-[900px] px-8 pb-24">
      <h2 class="mb-6 text-base font-bold uppercase tracking-widest text-text-muted">
        Courses
      </h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="course in courses"
          :key="course.slug"
          :to="`/${course.slug}/`"
          class="group relative block overflow-hidden rounded-xl border border-border bg-surface p-6 no-underline transition-all duration-150 ease-smooth hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[var(--shadow-color)] hover-glow"
          :style="{ '--course-color': course.color }"
        >
          <!-- Accent stripe -->
          <div
            class="absolute inset-x-0 top-0 h-1 transition-all duration-150 ease-smooth group-hover:h-1.5"
            :style="{ background: course.color }"
          />

          <div class="mt-2">
            <div class="mb-3 flex flex-wrap items-center gap-2">
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.78rem] font-semibold uppercase tracking-wider"
                :style="{
                  color: course.color,
                  background: course.color + '14'
                }"
              >
                {{ course.lessons }} lessons
              </span>
              <span
                v-if="courseProgress[course.slug]"
                class="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.72rem] font-semibold text-emerald-400"
              >
                {{ courseProgress[course.slug] }}/{{ course.lessons }} completed
              </span>
              <span
                v-else-if="courseProgress[course.slug] === 0"
                class="inline-flex items-center rounded-full bg-text-muted/10 px-2 py-0.5 text-[0.72rem] font-medium text-text-muted"
              >
                Start learning
              </span>
            </div>

            <h3 class="mb-2 font-display text-xl font-bold leading-snug text-[var(--color-headings)] transition-colors duration-150 ease-smooth group-hover:text-[var(--course-color)]">
              {{ course.title }}
            </h3>

            <p class="text-base leading-relaxed text-text-muted">
              {{ course.description }}
            </p>

            <!-- Week pills -->
            <div class="mt-4 flex flex-wrap gap-1.5">
              <span
                v-for="week in course.weeks"
                :key="week.number"
                class="rounded-full px-2 py-0.5 text-[0.72rem] font-medium"
                :style="{
                  color: week.color,
                  background: week.color + '14',
                  border: '1px solid ' + week.color + '30'
                }"
              >
                {{ week.name }}
              </span>
            </div>
          </div>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
