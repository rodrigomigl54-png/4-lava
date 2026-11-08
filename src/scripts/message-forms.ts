/**
 * Every <form data-msg-form> becomes a "send as message" form:
 * validates, builds the pre-filled text from data-template and opens
 * WhatsApp / Viber / SMS / phone. Shared by reservation, events and sač pre-order.
 */
import { channelHref, fillTemplate, formatDay, type Channel } from '../lib/message';
import { toast, copyText } from './toast';

interface Cfg {
  template: string;
  phone: { intl: string; whatsapp: string };
  weekdays: string[];
  lang: 'sr' | 'lat' | 'en';
  words?: { one: string; few: string; many: string };
  s: Record<string, string>;
}

function plural(n: number, w: Cfg['words'], lang: Cfg['lang']) {
  if (!w) return '';
  if (lang === 'en') return n === 1 ? w.one : w.many;
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return w.one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return w.few;
  return w.many;
}

function vars(form: HTMLFormElement, cfg: Cfg) {
  const v: Record<string, string> = {};
  for (const el of Array.from(form.elements) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[]) {
    if (!el.name || el.name === 'channel') continue;
    if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
      if (el.checked) v[el.name] = el.dataset.text || el.value;
      continue;
    }
    if (el instanceof HTMLSelectElement) {
      const o = el.selectedOptions[0];
      v[el.name] = o && o.value ? (o.dataset.text || o.textContent || '').trim() : '';
      continue;
    }
    v[el.name] = el.value;
    if (el instanceof HTMLInputElement && el.type === 'date' && el.value) v[el.name] = formatDay(el.value, cfg.lang, cfg.weekdays);
  }
  const n = Number(v.people || v.guests || 0);
  if (n) v.peopleWord = plural(n, cfg.words, cfg.lang);
  return v;
}

function validate(form: HTMLFormElement, cfg: Cfg): boolean {
  let ok = true;
  for (const el of Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[required], input[type=date]'))) {
    const err = form.querySelector<HTMLElement>(`[data-err-for="${el.name}"]`);
    let msg = '';
    if (el.hasAttribute('required') && !el.value.trim()) msg = cfg.s.required;
    else if (el instanceof HTMLInputElement && el.type === 'date' && el.value && el.min && el.value < el.min) msg = cfg.s.date;
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) err.textContent = msg;
    if (msg && ok) { ok = false; el.focus(); }
  }
  return ok;
}

export function initMessageForms(root: ParentNode = document) {
  root.querySelectorAll<HTMLFormElement>('form[data-msg-form]').forEach((form) => {
    if (form.dataset.ready) return;
    form.dataset.ready = '1';
    const cfg = JSON.parse(form.dataset.cfg || '{}') as Cfg;
    const preview = form.querySelector<HTMLElement>('[data-preview]');
    const text = () => fillTemplate(cfg.template, vars(form, cfg));
    const update = () => { if (preview) preview.textContent = text(); };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    update();

    // steppers
    form.querySelectorAll<HTMLElement>('[data-stepper]').forEach((st) => {
      const input = st.querySelector('input')!;
      st.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b) =>
        b.addEventListener('click', () => {
          const min = Number(input.min || 1), max = Number(input.max || 99);
          input.value = String(Math.min(max, Math.max(min, Number(input.value || min) + Number(b.dataset.step))));
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }),
      );
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const channel = ((e as SubmitEvent).submitter as HTMLButtonElement | null)?.value as Channel || 'whatsapp';
      if (channel !== 'call' && !validate(form, cfg)) { toast(cfg.s.check); return; }
      const msg = text();
      if (channel === 'viber') {
        const copied = await copyText(msg);
        if (copied) toast(cfg.s.viberCopied, 6000);
      } else if (channel !== 'call') {
        toast(cfg.s.ok);
      }
      const href = channelHref(channel, cfg.phone, msg);
      if (channel === 'whatsapp') window.open(href, '_blank', 'noopener');
      else window.location.href = href;
    });
  });
}
