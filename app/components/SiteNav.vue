<template>
  <nav class="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-md">
    <div class="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
      <NuxtLink to="/" class="flex items-center gap-2 font-display text-sm font-semibold text-text-main no-underline">
        <span class="h-2 w-2 rounded-full bg-accent" />
        <span class="gradient-text">Learning Hub</span>
      </NuxtLink>
      <ul class="flex items-center gap-6 list-none m-0 p-0">
        <li><NuxtLink to="/" class="text-sm text-text-muted hover:text-text-main transition-colors duration-150 ease-smooth">Courses</NuxtLink></li>
        <li><a href="https://edufalcao.com" target="_blank" class="text-sm text-accent hover:underline transition-colors duration-150 ease-smooth">edufalcao.com ↗</a></li>
      </ul>
    </div>
  </nav>
</template>
