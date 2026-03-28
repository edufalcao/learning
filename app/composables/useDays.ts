export interface DayInfo {
  day: number,
  title: string,
  slug: string,
  week: number,
  weekName: string,
  tag: string,
  description: string
}

export interface WeekInfo {
  number: number,
  name: string,
  subtitle: string,
  color: string,
  days: DayInfo[]
}

const weekColors: Record<number, string> = {
  1: 'week1',
  2: 'week2',
  3: 'week3',
  4: 'week4'
};

export function getWeekMeta(weekNum: number): { name: string, subtitle: string, color: string } {
  return { name: `Week ${weekNum}`, subtitle: '', color: weekColors[weekNum] ?? 'week1' };
}

export function groupByWeek(days: DayInfo[], courseWeeks?: { number: number, name: string, subtitle: string }[]): WeekInfo[] {
  const weekNums = [...new Set(days.map(d => d.week))].sort((a, b) => a - b);
  return weekNums.map((weekNum) => {
    const courseMeta = courseWeeks?.find(w => w.number === weekNum);
    const firstDay = days.find(d => d.week === weekNum);
    return {
      number: weekNum,
      name: courseMeta?.name ?? firstDay?.weekName ?? `Week ${weekNum}`,
      subtitle: courseMeta?.subtitle ?? '',
      color: weekColors[weekNum] ?? 'week1',
      days: days.filter(d => d.week === weekNum).sort((a, b) => a.day - b.day)
    };
  });
}

export function formatDayNum(day: number): string {
  return String(day).padStart(2, '0');
}
