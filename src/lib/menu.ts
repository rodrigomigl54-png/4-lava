import menu from '../data/menu.json';
import wines from '../data/wines.json';
import { t, pick, formatPrice, type Locale } from './i18n';

export type MenuItem = (typeof menu.items)[number] & {
  hidden?: boolean; note?: string; pairingRakija?: string; subcategory?: string; easterEgg?: string; pairingSource?: string; wineId?: string;
};
export const ITEMS = (menu.items as MenuItem[]).filter((i) => !i.hidden);
export const CATEGORIES = [...menu.categories].sort((a, b) => a.order - b.order);

/** Filter chips from the brief, mapped to categories / tags; empty chips are dropped. */
const CHIP_DEFS: { id: string; cats?: string[]; tag?: string }[] = [
  { id: 'dorucak', cats: ['dorucak'] },
  { id: 'corbe', cats: ['corbe'] },
  { id: 'kuvana', cats: ['kuvana', 'po-porudzbini'] },
  { id: 'specijaliteti', cats: ['specijaliteti'] },
  { id: 'rostilj', cats: ['rostilj'] },
  { id: 'riba', cats: ['riba'] },
  { id: 'paste', cats: ['paste'] },
  { id: 'salate', cats: ['salate'] },
  { id: 'posno', tag: 'fasting' },
  { id: 'dezerti', cats: ['dezerti'] },
  { id: 'pica', cats: ['pica'] },
];
export const CHIPS = CHIP_DEFS.filter((c) => ITEMS.some((i) => (c.tag ? i.tags.includes(c.tag) : c.cats!.includes(i.category))));

/** Chip ids an item belongs to (space separated, for data-chips). */
export function chipsOf(i: MenuItem): string {
  return CHIP_DEFS.filter((c) => (c.tag ? i.tags.includes(c.tag) : c.cats!.includes(i.category))).map((c) => c.id).join(' ');
}

/** Time-of-day highlight (jutro / podne / vece). */
const HL: Record<string, string[]> = {
  jutro: ['karlovacki-dorucak', 'domaca-kafa', 'pofezne'],
  podne: ['juneci-gulas', 'rozin-paprikas', 'prebranac', 'vojvodjanski-rucak'],
  vece: ['bermet', 'juneci-repovi', 'ramstek-bermet', 'katin-kuglof'],
};
export const timeHighlight = (id: string) => Object.entries(HL).filter(([, ids]) => ids.includes(id)).map(([m]) => m).join(' ');

/** "First time here?" picks (featured, shown with a pulse). */
export const FIRST_TIME = ['karlovacki-dorucak', 'rozin-paprikas', 'karlovacka-snicla', 'katin-kuglof'];

export function priceText(l: Locale, i: MenuItem): string {
  if (i.price == null) return '';
  const p = formatPrice(l, i.price);
  if (i.priceAlt != null) return p.replace(/(\S+) /, `$1 / ${formatPrice(l, i.priceAlt).split(' ')[0]} `);
  if (i.unit === 'kg') return `${p} / ${t(l, 'menu.perKg')}`;
  return p;
}

export const unitText = (i: MenuItem) => (i.unit && i.unit !== 'kg' ? i.unit : '');

/** All drinks of the cellar: wines + rakije (same shape, `kind` tells them apart). */
export type Drink = (typeof wines.wines)[number] & { kind: 'wine' | 'rakija'; producer?: string | null; winery?: string | null; image?: string | null };
export const DRINKS = [...wines.wines, ...wines.rakije] as unknown as Drink[];
export const PAIRING_REASONS = wines.pairingReasons as Record<string, { sr: string; en: string }>;

export function wineName(l: Locale, id: string | null | undefined): string {
  if (!id) return '';
  const w = DRINKS.find((x) => x.id === id);
  return w ? pick(l, w.name).split(' — ')[0] : '';
}

/** Dishes that pair with a drink (wine via `pairing`, rakija via `pairingRakija`). */
export function dishesFor(drinkId: string) {
  return ITEMS.filter((i) => i.category !== 'pica' && (i.pairing === drinkId || (i as { pairingRakija?: string }).pairingRakija === drinkId));
}

export const MENU_UPDATED = menu.updated;
export const SUBCATS = menu.subcategories as Record<string, { sr: string; en: string }>;
