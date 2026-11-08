import { describe, it, expect } from 'vitest';
import { t, pick, formatPrice, formatNumber, localePath, stripLocale } from '../src/lib/i18n';

describe('i18n', () => {
  it('serves Cyrillic, generated Latin and English', () => {
    expect(t('sr', 'nav.trpeza.lion')).toBe('Лав трпезе');
    expect(t('lat', 'nav.trpeza.lion')).toBe('Lav trpeze');
    expect(t('en', 'nav.trpeza.lion')).toBe('Lion of the Table');
  });
  it('interpolates', () => {
    expect(t('sr', 'status.open', { time: '23:00' })).toBe('Отворено · затварамо у 23:00');
    expect(t('lat', 'status.open', { time: '23:00' })).toBe('Otvoreno · zatvaramo u 23:00');
  });
  it('picks data fields', () => {
    const v = { sr: 'Јунећи гулаш', en: 'Beef goulash' };
    expect(pick('lat', v)).toBe('Juneći gulaš');
    expect(pick('en', v)).toBe('Beef goulash');
    expect(pick('lat', { sr: '{=Wine country burger=}' })).toBe('Wine country burger');
  });
  it('formats prices and numbers', () => {
    expect(formatPrice('sr', 1250)).toBe('1.250 дин.');
    expect(formatPrice('lat', 1250)).toBe('1.250 din.');
    expect(formatPrice('en', 1250)).toBe('1.250 RSD');
    expect(formatPrice('sr', null)).toBe('');
    expect(formatNumber('sr', 4.5, 1)).toBe('4,5');
    expect(formatNumber('en', 1233)).toBe('1,233');
  });
  it('builds locale paths', () => {
    expect(localePath('lat', '/meni/')).toBe('/lat/meni/');
    expect(localePath('sr', '/')).toBe('/');
    expect(stripLocale('/en/meni/')).toBe('/meni/');
    expect(stripLocale('/en')).toBe('/');
  });
});
