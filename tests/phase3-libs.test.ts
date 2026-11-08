import { describe, it, expect } from 'vitest';
import { orthodoxEaster, fastingInfo } from '../src/lib/fasting';
import { timeModeForHour, getTimeMode } from '../src/lib/time-mode';
import { channelHref, fillTemplate, formatDay, belgradeISODate } from '../src/lib/message';

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe('orthodoxEaster', () => {
  it.each([
    [2024, '2024-05-05'], [2025, '2025-04-20'], [2026, '2026-04-12'],
    [2027, '2027-05-02'], [2028, '2028-04-16'], [2030, '2030-04-28'],
  ])('%i → %s', (y, d) => expect(iso(orthodoxEaster(y))).toBe(d));
});

describe('fastingInfo', () => {
  it('Christmas fast across the new year', () => {
    expect(fastingInfo(2026, 11, 28).fast).toBe('bozicni');
    expect(fastingInfo(2027, 1, 6).fast).toBe('bozicni');
    expect(fastingInfo(2027, 1, 7).fast).toBe(null);
    expect(fastingInfo(2026, 11, 27).fast).not.toBe('bozicni');
  });
  it('Great Lent 2026: 23 Feb – 11 Apr', () => {
    expect(fastingInfo(2026, 2, 22).fast).toBe(null);
    expect(fastingInfo(2026, 2, 23).fast).toBe('veliki');
    expect(fastingInfo(2026, 4, 11).fast).toBe('veliki');
    expect(fastingInfo(2026, 4, 12).fast).toBe(null);
  });
  it('Apostles fast 2026: 8 Jun – 11 Jul', () => {
    expect(fastingInfo(2026, 6, 7).fast).toBe(null);
    expect(fastingInfo(2026, 6, 8).fast).toBe('petrovski');
    expect(fastingInfo(2026, 7, 11).fast).toBe('petrovski');
    expect(fastingInfo(2026, 7, 12).fast).toBe(null);
  });
  it('Dormition fast', () => {
    expect(fastingInfo(2026, 8, 14).fast).toBe('gospojinski');
    expect(fastingInfo(2026, 8, 27).fast).toBe('gospojinski');
    expect(fastingInfo(2026, 8, 28).fast).toBe(null);
  });
  it('Wednesdays and Fridays', () => {
    expect(fastingInfo(2026, 11, 11).weeklyDay).toBe(true); // Wednesday
    expect(fastingInfo(2026, 11, 13).weeklyDay).toBe(true); // Friday
    expect(fastingInfo(2026, 11, 8).weeklyDay).toBe(false); // Sunday
  });
});

describe('time mode', () => {
  it('maps hours', () => {
    expect(timeModeForHour(5)).toBe('vece');
    expect(timeModeForHour(6)).toBe('jutro');
    expect(timeModeForHour(11)).toBe('podne');
    expect(timeModeForHour(17)).toBe('vece');
  });
  it('uses Belgrade time', () => {
    expect(getTimeMode(new Date('2026-11-08T06:30:00Z'))).toBe('jutro'); // 07:30 CET
  });
});

describe('messages', () => {
  const phone = { intl: '+381605210606', whatsapp: '381605210606' };
  it('builds channel links', () => {
    expect(channelHref('whatsapp', phone, 'Ћао 1')).toBe('https://wa.me/381605210606?text=%D0%8B%D0%B0%D0%BE%201');
    expect(channelHref('viber', phone, 'x')).toBe('viber://chat?number=%2B381605210606');
    expect(channelHref('sms', phone, 'a b')).toBe('sms:+381605210606?&body=a%20b');
    expect(channelHref('call', phone, '')).toBe('tel:+381605210606');
  });
  it('fills templates and drops empty lines', () => {
    expect(fillTemplate('Добар дан!\nИме: {name}\nНапомена: {note}', { name: 'Ана', note: ' ' }))
      .toBe('Добар дан!\nИме: Ана');
  });
  it('formats days', () => {
    const wd = ['недеља', 'понедељак', 'уторак', 'среда', 'четвртак', 'петак', 'субота'];
    expect(formatDay('2026-11-14', 'sr', wd)).toBe('субота 14.11.');
    expect(formatDay('2026-11-14', 'en', ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Saturday'])).toBe('Saturday 14 Nov');
  });
  it('Belgrade date', () => {
    expect(belgradeISODate(0, new Date('2026-11-08T23:30:00Z'))).toBe('2026-11-09');
    expect(belgradeISODate(24, new Date('2026-11-08T10:00:00Z'))).toBe('2026-11-09');
  });
});
