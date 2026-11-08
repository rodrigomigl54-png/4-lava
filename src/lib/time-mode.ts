import { belgradeNow } from './belgrade-time';

/** Јутро 06–11 · Подне 11–17 · Вече 17–06 (Europe/Belgrade). */
export type TimeMode = 'jutro' | 'podne' | 'vece';
export const TIME_MODES: TimeMode[] = ['jutro', 'podne', 'vece'];

export function timeModeForHour(hour: number): TimeMode {
  if (hour >= 6 && hour < 11) return 'jutro';
  if (hour >= 11 && hour < 17) return 'podne';
  return 'vece';
}

export const getTimeMode = (date: Date = new Date()): TimeMode => timeModeForHour(belgradeNow(date).hour);
