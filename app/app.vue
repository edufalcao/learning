<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
/* ── Base ── */
body {
  background: #0D0D0D;
  color: #F5F5F5;
  font-family: 'DM Sans', 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

/* Noise texture overlay */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  opacity: 0.015;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 256px 256px;
}

/* Radial gradient background mesh */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 20% 50%, rgba(0, 229, 204, 0.06), transparent 60%),
    radial-gradient(ellipse at 80% 80%, rgba(255, 0, 110, 0.04), transparent 60%);
}

/* Page transitions */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #8B8B8B;
}

/* Selection */
::selection {
  background: rgba(0, 229, 204, 0.25);
  color: #fff;
}

/* Gradient text utility */
.gradient-text {
  background: linear-gradient(135deg, #00E5CC, #FF006E);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Glow utilities */
.glow-accent {
  box-shadow: 0 0 20px rgba(0, 229, 204, 0.15);
}
.glow-accent-2 {
  box-shadow: 0 0 20px rgba(255, 0, 110, 0.15);
}
.hover-glow:hover {
  box-shadow: 0 0 30px rgba(0, 229, 204, 0.15);
}
</style>
