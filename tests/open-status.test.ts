import { describe, it, expect } from 'vitest';
import { getOpenStatus, type WeekHours } from '../src/lib/open-status';
import { belgradeNow } from '../src/lib/belgrade-time';

const every: WeekHours = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7].map((d) => [String(d), [['08:00', '23:00']]]),
) as WeekHours;

describe('belgradeNow', () => {
  it('converts UTC to Belgrade (winter, CET = UTC+1)', () => {
    const n = belgradeNow(new Date('2026-11-08T21:30:00Z')); // Sunday
    expect(n.hour).toBe(22);
    expect(n.weekday).toBe(7);
  });
  it('handles summer time (CEST = UTC+2)', () => {
    expect(belgradeNow(new Date('2026-07-01T06:00:00Z')).hour).toBe(8);
  });
});

describe('getOpenStatus', () => {
  it('is open during hours', () => {
    expect(getOpenStatus(every, new Date('2026-11-08T12:00:00Z')))
      .toEqual({ open: true, closesAt: '23:00' });
  });
  it('is closed after 23:00 and opens tomorrow', () => {
    expect(getOpenStatus(every, new Date('2026-11-08T22:10:00Z')))
      .toEqual({ open: false, opensAt: '08:00', opensInDays: 1 });
  });
  it('is closed early morning and opens today', () => {
    expect(getOpenStatus(every, new Date('2026-11-08T05:00:00Z')))
      .toEqual({ open: false, opensAt: '08:00', opensInDays: 0 });
  });
  it('skips closed days', () => {
    const w = { ...every, '1': [] } as WeekHours; // closed Monday
    // Sunday 23:30 Belgrade → next is Tuesday
    expect(getOpenStatus(w, new Date('2026-11-08T22:30:00Z')).opensInDays).toBe(2);
  });
  it('supports ranges past midnight', () => {
    const w = { ...every, '6': [['08:00', '01:00']] } as WeekHours; // Saturday until 01:00
    expect(getOpenStatus(w, new Date('2026-11-07T23:30:00Z')).open).toBe(true); // Sun 00:30
  });
});
