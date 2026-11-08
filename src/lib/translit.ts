/**
 * Serbian Cyrillic → Latin transliteration (Gaj's Latin alphabet).
 *
 * - Only Cyrillic letters are converted; digits, punctuation, Latin text,
 *   URLs, e-mail addresses and phone numbers pass through untouched.
 * - Segments wrapped in {= … =} are "explicitly latin / keep as is" brand
 *   strings: they are never transliterated and the markers are stripped.
 * - Capital digraphs are handled by context: Љубав → Ljubav, ЉУБАВ → LJUBAV.
 */

const MAP: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'đ', е: 'e', ж: 'ž', з: 'z',
  и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o',
  п: 'p', р: 'r', с: 's', т: 't', ћ: 'ć', у: 'u', ф: 'f', х: 'h', ц: 'c',
  ч: 'č', џ: 'dž', ш: 'š',
};

const KEEP = /\{=([\s\S]*?)=\}/g;
const PROTECTED = /(https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s/-]{5,}\d)/g;

const isUpper = (ch: string | undefined) =>
  !!ch && ch !== ch.toLowerCase() && ch === ch.toUpperCase();
const isLetter = (ch: string | undefined) => !!ch && /\p{L}/u.test(ch);

function convertPlain(text: string): string {
  const chars = Array.from(text);
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const lower = ch.toLowerCase();
    const lat = MAP[lower];
    if (lat === undefined) {
      out += ch;
      continue;
    }
    if (ch === lower) {
      out += lat;
      continue;
    }
    // Uppercase letter
    if (lat.length === 1) {
      out += lat.toUpperCase();
      continue;
    }
    // Digraph (Lj, Nj, Dž): full caps if the word around it is in caps.
    const next = chars[i + 1];
    const prev = chars[i - 1];
    const allCaps = isLetter(next) ? isUpper(next) : isUpper(prev);
    out += allCaps ? lat.toUpperCase() : lat[0].toUpperCase() + lat.slice(1);
  }
  return out;
}

/** Transliterate Serbian Cyrillic text to Latin. */
export function toLatin(text: string): string {
  if (!text) return text;
  // 1) split out {= keep =} segments
  let result = '';
  let last = 0;
  for (const m of text.matchAll(KEEP)) {
    result += convertUnprotected(text.slice(last, m.index));
    result += m[1];
    last = (m.index ?? 0) + m[0].length;
  }
  result += convertUnprotected(text.slice(last));
  return result;
}

function convertUnprotected(text: string): string {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(PROTECTED)) {
    out += convertPlain(text.slice(last, m.index));
    out += m[0];
    last = (m.index ?? 0) + m[0].length;
  }
  return out + convertPlain(text.slice(last));
}

/** Strip {= =} markers without transliterating (for the Cyrillic locale). */
export function stripKeep(text: string): string {
  return text ? text.replace(KEEP, '$1') : text;
}

/** Recursively transliterate every string in a JSON-like value. */
export function toLatinDeep<T>(value: T): T {
  if (typeof value === 'string') return toLatin(value) as T;
  if (Array.isArray(value)) return value.map(toLatinDeep) as T;
  if (value && typeof value === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) o[k] = toLatinDeep(v);
    return o as T;
  }
  return value;
}
