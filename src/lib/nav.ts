import type { LionVariant } from '../components/LionIcon.astro';

export interface NavLion {
  key: 'trpeza' | 'podrum' | 'kuca' | 'kapija';
  anchor: string;
  variant: LionVariant;
}

/** The four lions — each guards a section of the homepage. */
export const NAV_LIONS: NavLion[] = [
  { key: 'trpeza', anchor: 'jelovnik', variant: 'trpeza' },
  { key: 'podrum', anchor: 'podrum', variant: 'podrum' },
  { key: 'kuca', anchor: 'kuca', variant: 'kuca' },
  { key: 'kapija', anchor: 'kapija', variant: 'kapija' },
];
