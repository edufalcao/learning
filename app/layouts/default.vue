<template>
  <div class="min-h-dvh flex flex-col bg-bg">
    <SiteNav />
    <main class="flex-1">
      <slot />
    </main>
    <SiteFooter />
  </div>
</template>
