/** Wall-clock time in Europe/Belgrade, independent of the visitor's time zone. */
export interface BelgradeNow {
  year: number;
  month: number; // 1–12
  day: number;
  weekday: number; // ISO: 1 = Monday … 7 = Sunday
  hour: number;
  minute: number;
  minutes: number; // minutes since midnight
}

const WD: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
let fmt: Intl.DateTimeFormat | null = null;

export function belgradeNow(date: Date = new Date()): BelgradeNow {
  fmt ??= new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Belgrade',
    year: 'numeric', month: 'numeric', day: 'numeric',
    weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) p[part.type] = part.value;
  const hour = Number(p.hour) % 24;
  const minute = Number(p.minute);
  return {
    year: Number(p.year), month: Number(p.month), day: Number(p.day),
    weekday: WD[p.weekday] ?? 1, hour, minute, minutes: hour * 60 + minute,
  };
}
