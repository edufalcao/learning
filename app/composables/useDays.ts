export interface DayInfo {
  day: number
  title: string
  slug: string
  week: number
  weekName: string
  tag: string
  description: string
}

export interface WeekInfo {
  number: number
  name: string
  subtitle: string
  color: string
  days: DayInfo[]
}

const weekMeta: Record<number, { name: string; subtitle: string; color: string }> = {
  1: { name: 'Foundations', subtitle: 'What Is an Agent?', color: 'week1' },
  2: { name: 'Architecture', subtitle: 'Designing Agent Systems', color: 'week2' },
  3: { name: 'Implementation', subtitle: 'Building Real Agents', color: 'week3' },
  4: { name: 'Production', subtitle: 'Advanced & Real-World', color: 'week4' },
}

export function getWeekMeta(weekNum: number) {
  return weekMeta[weekNum] || weekMeta[1]
}

export function groupByWeek(days: DayInfo[]): WeekInfo[] {
  const weeks: WeekInfo[] = []
  for (const [num, meta] of Object.entries(weekMeta)) {
    const weekNum = Number(num)
    weeks.push({
      number: weekNum,
      ...meta,
      days: days.filter(d => d.week === weekNum).sort((a, b) => a.day - b.day),
    })
  }
  return weeks
}

export function formatDayNum(day: number): string {
  return String(day).padStart(2, '0')
}
