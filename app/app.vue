<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style>
/* ── Theme Variables ── */
:root {
  --color-bg: #0d0d0d;
  --color-surface: #1a1a1a;
  --color-elevated: #242424;
  --color-text: #f5f5f5;
  --color-muted: #8b8b8b;
  --color-dim: #999999;
  --color-headings: #ffffff;
  --color-accent: #00e5cc;
  --color-accent-dim: #005c52;
  --color-accent-2: #ff006e;
  --color-accent-2-dim: #660029;
  --color-border: hsla(0, 0%, 100%, 0.08);
  --color-prose-body: #c9c9c9;
  --color-code-inline-bg: rgba(255, 255, 255, 0.06);
  --color-blockquote-bg: rgba(0, 229, 204, 0.05);
  --glow-accent: rgba(0, 229, 204, 0.15);
  --glow-accent-2: rgba(255, 0, 110, 0.15);
  --noise-opacity: 0.015;
  --gradient-bg-1: rgba(0, 229, 204, 0.06);
  --gradient-bg-2: rgba(255, 0, 110, 0.04);
  --scrollbar-thumb: rgba(255, 255, 255, 0.08);
  --scrollbar-hover: #8b8b8b;
  --selection-bg: rgba(0, 229, 204, 0.25);
  --selection-color: #fff;
  --shadow-color: rgba(0, 0, 0, 0.4);
}

.light {
  --color-bg: #fafafa;
  --color-surface: #ffffff;
  --color-elevated: #f0f0f0;
  --color-text: #1a1a1a;
  --color-muted: #6b6b6b;
  --color-dim: #888888;
  --color-headings: #0d0d0d;
  --color-accent: #00b39e;
  --color-accent-dim: #e0f7f4;
  --color-accent-2: #e0005f;
  --color-accent-2-dim: #fce0ec;
  --color-border: hsla(0, 0%, 0%, 0.08);
  --color-prose-body: #374151;
  --color-code-inline-bg: rgba(0, 0, 0, 0.04);
  --color-blockquote-bg: rgba(0, 179, 158, 0.05);
  --glow-accent: rgba(0, 179, 158, 0.1);
  --glow-accent-2: rgba(224, 0, 95, 0.1);
  --noise-opacity: 0.03;
  --gradient-bg-1: rgba(0, 179, 158, 0.04);
  --gradient-bg-2: rgba(224, 0, 95, 0.03);
  --scrollbar-thumb: rgba(0, 0, 0, 0.1);
  --scrollbar-hover: #6b6b6b;
  --selection-bg: rgba(0, 179, 158, 0.25);
  --selection-color: #000;
  --shadow-color: rgba(0, 0, 0, 0.1);
}

/* ── Base ── */
body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: 'DM Sans', 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  transition: background 0.15s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Noise texture overlay */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  opacity: var(--noise-opacity);
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
    radial-gradient(ellipse at 20% 50%, var(--gradient-bg-1), transparent 60%),
    radial-gradient(ellipse at 80% 80%, var(--gradient-bg-2), transparent 60%);
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
  background: var(--scrollbar-thumb);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-hover);
}

/* Selection */
::selection {
  background: var(--selection-bg);
  color: var(--selection-color);
}

/* Gradient text utility */
.gradient-text {
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Glow utilities */
.glow-accent {
  box-shadow: 0 0 20px var(--glow-accent);
}
.glow-accent-2 {
  box-shadow: 0 0 20px var(--glow-accent-2);
}
.hover-glow:hover {
  box-shadow: 0 0 30px var(--glow-accent);
}
</style>
