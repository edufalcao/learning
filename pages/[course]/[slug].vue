<script setup lang="ts">
import { getWeekMeta } from '~/composables/useDays'

const route = useRoute()
const courseSlug = computed(() => route.params.course as string)
const slug = computed(() => route.params.slug as string)

// Map course slugs to collection names
const collectionMap: Record<string, string> = {
  'agentic-coding': 'agentic_coding',
}

const collectionName = computed(() => collectionMap[courseSlug.value] || courseSlug.value)

// Fetch course metadata
const { data: allCourses } = await useAsyncData(`lesson-course-meta-${courseSlug.value}`, () =>
  queryCollection('courses').all()
)

const course = computed(() =>
  allCourses.value?.find((c: any) => c.slug === courseSlug.value)
)

// Fetch current lesson
const { data: page } = await useAsyncData(`lesson-${courseSlug.value}-${slug.value}`, () =>
  queryCollection(collectionName.value as any).path(`/${courseSlug.value}/${slug.value}`).first()
)

// Fetch all days for sidebar + nav
const { data: allDays } = await useAsyncData(`sidebar-${courseSlug.value}`, () =>
  queryCollection(collectionName.value as any).order('day', 'ASC').all()
)

const sidebarDays = computed(() =>
  (allDays.value || []).map((d: any) => ({
    day: d.day,
    title: d.title,
    week: d.week,
  }))
)

const currentDay = computed(() => page.value?.day || 1)
const weekMeta = computed(() => getWeekMeta(page.value?.week || 1))

const weekColorMap: Record<number, string> = {
  1: '#3B82F6',
  2: '#10B981',
  3: '#8B5CF6',
  4: '#F59E0B',
}

const prevDay = computed(() => {
  const prev = sidebarDays.value.find((d: any) => d.day === currentDay.value - 1)
  return prev || null
})

const nextDay = computed(() => {
  const next = sidebarDays.value.find((d: any) => d.day === currentDay.value + 1)
  return next || null
})

useHead({
  title: () => page.value ? `Day ${String(page.value.day).padStart(2, '0')}: ${page.value.title} — ${course.value?.title || 'Course'}` : 'Lesson',
})

useSeoMeta({
  ogTitle: () => page.value ? `Day ${page.value.day}: ${page.value.title}` : '',
  ogDescription: () => page.value?.description || '',
})
</script>

<template>
  <div v-if="page" class="mx-auto flex max-w-[1100px]">
    <!-- Sidebar -->
    <LessonSidebar :days="sidebarDays" :current-day="currentDay" :course-slug="courseSlug" />

    <!-- Main content -->
    <main class="min-w-0 flex-1 px-6 py-10 sm:px-12">
      <!-- Breadcrumb -->
      <nav class="mb-8 flex items-center gap-1.5 text-xs text-text-muted">
        <NuxtLink to="/" class="text-text-muted hover:text-text-main no-underline">Home</NuxtLink>
        <span class="opacity-40">›</span>
        <NuxtLink :to="`/${courseSlug}/`" class="text-text-muted hover:text-text-main no-underline">
          {{ course?.title || courseSlug }}
        </NuxtLink>
        <span class="opacity-40">›</span>
        <NuxtLink :to="`/${courseSlug}/#weeks`" class="text-text-muted hover:text-text-main no-underline">
          Week {{ page.week }}: {{ weekMeta.name }}
        </NuxtLink>
        <span class="opacity-40">›</span>
        <span class="text-text-dim">Day {{ currentDay }}</span>
      </nav>

      <!-- Lesson header -->
      <div class="mb-4 flex items-center gap-2.5">
        <span
          class="rounded px-2.5 py-1 text-[0.72rem] font-bold uppercase tracking-wider"
          :style="{
            color: weekColorMap[page.week],
            background: weekColorMap[page.week] + '14',
          }"
        >
          Day {{ String(page.day).padStart(2, '0') }}
        </span>
        <span class="text-xs text-text-muted">
          Week {{ page.week }} — {{ weekMeta.name }}
        </span>
      </div>

      <h1 class="mb-8 font-display text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
        {{ page.title }}
      </h1>

      <!-- Prose content -->
      <div class="prose prose-invert max-w-[720px]">
        <ContentRenderer :value="page" />
      </div>

      <!-- Prev/Next nav -->
      <LessonNav :prev-day="prevDay" :next-day="nextDay" :course-slug="courseSlug" />
    </main>
  </div>
</template>
