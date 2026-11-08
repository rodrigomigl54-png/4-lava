import { belgradeNow } from './belgrade-time';

/** Opening hours per ISO weekday ("1" = Monday … "7" = Sunday); [] = closed. */
export type WeekHours = Record<string, [string, string][]>;

export interface OpenStatus {
  open: boolean;
  /** "23:00" when open */
  closesAt?: string;
  /** "08:00" when closed and a next opening exists */
  opensAt?: string;
  /** 0 = later today, 1 = tomorrow, n = in n days */
  opensInDays?: number;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

export function getOpenStatus(week: WeekHours, date: Date = new Date()): OpenStatus {
  const now = belgradeNow(date);
  const dayRanges = (wd: number) => week[String(((wd - 1 + 7) % 7) + 1)] ?? [];

  // Open now? (also checks yesterday's ranges that run past midnight)
  for (const [o, c] of dayRanges(now.weekday)) {
    const open = toMin(o), close = toMin(c);
    if (close > open ? now.minutes >= open && now.minutes < close : now.minutes >= open) {
      return { open: true, closesAt: c };
    }
  }
  for (const [o, c] of dayRanges(now.weekday - 1)) {
    if (toMin(c) <= toMin(o) && now.minutes < toMin(c)) return { open: true, closesAt: c };
  }

  // Next opening within a week
  for (let d = 0; d <= 7; d++) {
    const ranges = [...dayRanges(now.weekday + d)].sort((a, b) => toMin(a[0]) - toMin(b[0]));
    for (const [o] of ranges) {
      if (d > 0 || toMin(o) > now.minutes) return { open: false, opensAt: o, opensInDays: d };
    }
  }
  return { open: false };
}
