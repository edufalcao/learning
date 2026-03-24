const STORAGE_KEY = 'learning-progress'

type ProgressData = Record<string, string[]>

function readStorage(): ProgressData {
  if (!import.meta.client) return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeStorage(data: ProgressData) {
  if (!import.meta.client) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function useProgress() {
  const progress = reactive<ProgressData>(readStorage())

  function persist() {
    writeStorage(progress)
  }

  function markComplete(course: string, slug: string) {
    if (!progress[course]) progress[course] = []
    if (!progress[course].includes(slug)) {
      progress[course].push(slug)
      persist()
    }
  }

  function markIncomplete(course: string, slug: string) {
    if (!progress[course]) return
    const idx = progress[course].indexOf(slug)
    if (idx !== -1) {
      progress[course].splice(idx, 1)
      persist()
    }
  }

  function isComplete(course: string, slug: string): boolean {
    return progress[course]?.includes(slug) ?? false
  }

  function getCompletedCount(course: string): number {
    return progress[course]?.length ?? 0
  }

  function getCompletedSlugs(course: string): string[] {
    return progress[course] ?? []
  }

  return {
    markComplete,
    markIncomplete,
    isComplete,
    getCompletedCount,
    getCompletedSlugs,
  }
}
