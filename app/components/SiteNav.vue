<script setup lang="ts">
const colorMode = useColorMode();

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark';
}
</script>

<template>
  <nav class="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-md">
    <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
      <NuxtLink
        to="/"
        class="flex items-center gap-2 font-display text-base font-semibold text-text-main no-underline"
      >
        <span class="h-2 w-2 rounded-full bg-accent" />
        <span class="gradient-text">Learning Hub</span>
      </NuxtLink>
      <div class="flex items-center gap-6">
        <NuxtLink
          to="/"
          class="text-base text-text-muted hover:text-text-main transition-colors duration-150 ease-smooth"
        >
          Courses
        </NuxtLink>
        <a
          href="https://edufalcao.com"
          target="_blank"
          class="text-base text-accent hover:underline transition-colors duration-150 ease-smooth"
        >
          edufalcao.com ↗
        </a>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-text-muted transition-colors duration-150 ease-smooth hover:text-text-main"
          aria-label="Toggle theme"
          @click="toggleTheme"
        >
          <!-- Sun icon (shown in dark mode) -->
          <svg
            v-if="colorMode.value === 'dark'"
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          <!-- Moon icon (shown in light mode) -->
          <svg
            v-else
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
        </button>
      </div>
    </div>
  </nav>
</template>
