/**
 * Builds pre-filled messages and deep links. No backend: every "order" or
 * "reservation" is a message the guest sends by WhatsApp / Viber / SMS / phone.
 */
export type Channel = 'whatsapp' | 'viber' | 'sms' | 'call';

export interface Phone { intl: string; whatsapp: string } // "+381605210606", "381605210606"

export function channelHref(channel: Channel, phone: Phone, text: string): string {
  const body = encodeURIComponent(text);
  switch (channel) {
    case 'whatsapp': return `https://wa.me/${phone.whatsapp}?text=${body}`;
    case 'viber': return `viber://chat?number=${encodeURIComponent(phone.intl)}`;
    case 'sms': return `sms:${phone.intl}?&body=${body}`;
    case 'call': return `tel:${phone.intl}`;
  }
}

/** Fill "{name}" placeholders; lines whose placeholders are all empty are dropped. */
export function fillTemplate(tpl: string, vars: Record<string, string | number | undefined | null>): string {
  return tpl
    .split('\n')
    .map((line) => {
      const keys = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      if (keys.length && keys.every((k) => vars[k] == null || String(vars[k]).trim() === '')) return null;
      return line.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '').trim());
    })
    .filter((l): l is string => l !== null)
    .join('\n')
    .trim();
}

/** "субота 14.11." / "Saturday 14 Nov" from an ISO yyyy-mm-dd string. */
export function formatDay(iso: string, lang: 'sr' | 'lat' | 'en', weekdays: string[]): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const wd = weekdays[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  if (lang === 'en') {
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
    return `${wd} ${d} ${mon}`;
  }
  return `${wd} ${d}.${m}.`;
}

/** Today in Europe/Belgrade as yyyy-mm-dd, optionally + hours. */
export function belgradeISODate(addHours = 0, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Belgrade', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(now.getTime() + addHours * 3_600_000));
}
