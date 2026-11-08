import sr from '../i18n/sr.json';
import en from '../i18n/en.json';
import { toLatin, stripKeep } from './translit';
import { BASE, stripBase } from './base';

export type Locale = 'sr' | 'lat' | 'en';
export const LOCALES: Locale[] = ['sr', 'lat', 'en'];
export const HTML_LANG: Record<Locale, string> = { sr: 'sr-Cyrl', lat: 'sr-Latn', en: 'en' };
export const OG_LOCALE: Record<Locale, string> = { sr: 'sr_RS', lat: 'sr_RS', en: 'en_GB' };
export const SWITCH_LABEL: Record<Locale, string> = { sr: '{=ЋИР=}', lat: 'LAT', en: 'EN' };

type Dict = Record<string, string>;
const SR = sr as Dict;
const EN = en as Dict;

/** Path prefix for a locale: "" | "/lat" | "/en". */
export const prefix = (l: Locale) => (l === 'sr' ? '' : `/${l}`);

/** Build a localized path; `path` must start with "/". */
export const localePath = (l: Locale, path = '/') => `${BASE}${prefix(l)}${path}`.replace(/\/{2,}/g, '/');

/** Remove the locale prefix from a pathname. */
export function stripLocale(pathname: string): string {
  const p = stripBase(pathname).replace(/^\/(lat|en)(?=\/|$)/, '');
  return p === '' ? '/' : p;
}

/** Localize a Serbian Cyrillic string for the sr / lat locale. */
export const sr2 = (l: Locale, s: string) => (l === 'lat' ? toLatin(s) : stripKeep(s));

/** Pick from a { sr, en } object: sr is Cyrillic, lat is transliterated. */
export function pick(l: Locale, v: { sr?: string; en?: string } | string | null | undefined): string {
  if (v == null) return '';
  if (typeof v === 'string') return sr2(l, v);
  if (l === 'en') return v.en ?? sr2('sr', v.sr ?? '');
  return sr2(l, v.sr ?? '');
}

/** UI string lookup with {placeholder} interpolation. */
export function t(l: Locale, key: string, vars: Record<string, string | number> = {}): string {
  const raw = l === 'en' ? EN[key] ?? SR[key] : SR[key];
  if (raw === undefined) {
    if (import.meta.env?.DEV) console.warn(`[i18n] missing key: ${key}`);
    return key;
  }
  let s = l === 'en' ? stripKeep(raw) : sr2(l, raw);
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Number formatting: 1.250 (sr) / 1,250 (en). */
export function formatNumber(l: Locale, n: number, digits = 0): string {
  return new Intl.NumberFormat(l === 'en' ? 'en-GB' : 'de-DE', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(n);
}

/** Price: "1.250 дин." / "1.250 din." / "1.250 RSD" (EN keeps the dot style used on the printed menu). */
export function formatPrice(l: Locale, n: number | null | undefined): string {
  if (n == null) return '';
  const num = new Intl.NumberFormat('de-DE').format(n);
  return `${num} ${t(l, 'price.currency')}`;
}

/** Strings bundle for client scripts (only the given keys). */
export function clientStrings(l: Locale, keys: string[]): Dict {
  return Object.fromEntries(keys.map((k) => [k, t(l, k)]));
}
