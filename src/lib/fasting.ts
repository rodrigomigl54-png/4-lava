/**
 * Serbian Orthodox fasting periods (dates in the Gregorian calendar, valid 1900–2099).
 *  - Божићни пост:    28 Nov – 6 Jan
 *  - Велики пост:     48 days before Orthodox Easter (Clean Monday … Holy Saturday)
 *  - Петровски пост:  Monday after All Saints' Sunday (Easter + 57) – 11 Jul
 *  - Госпојински пост: 14 – 27 Aug
 *  - plus every Wednesday and Friday as a light note
 */
export type FastId = 'bozicni' | 'veliki' | 'petrovski' | 'gospojinski';

export interface FastInfo {
  fast: FastId | null;
  /** Wednesday or Friday (ordinary weekly fasting day) */
  weeklyDay: boolean;
}

const DAY = 86_400_000;
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

/** Orthodox Easter Sunday as a Gregorian UTC date (Meeus' Julian algorithm + 13 days). */
export function orthodoxEaster(year: number): Date {
  const a = year % 4, b = year % 7, c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  return new Date(utc(year, month, day) + 13 * DAY);
}

/** `date` is interpreted by its calendar day in the given parts (use Belgrade time). */
export function fastingInfo(y: number, m: number, d: number): FastInfo {
  const t = utc(y, m, d);
  const weekday = new Date(t).getUTCDay(); // 0 Sun … 6 Sat
  const weeklyDay = weekday === 3 || weekday === 5;
  const easter = orthodoxEaster(y).getTime();
  let fast: FastId | null = null;

  if ((m === 11 && d >= 28) || m === 12 || (m === 1 && d <= 6)) fast = 'bozicni';
  else if (t >= easter - 48 * DAY && t < easter) fast = 'veliki';
  else if (t >= easter + 57 * DAY && t <= utc(y, 7, 11)) fast = 'petrovski';
  else if (m === 8 && d >= 14 && d <= 27) fast = 'gospojinski';

  return { fast, weeklyDay };
}

/** Fasting info for "now" in Europe/Belgrade. */
export function fastingNow(date: Date = new Date()): FastInfo {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(date).split('-').map(Number);
  return fastingInfo(p[0], p[1], p[2]);
}
