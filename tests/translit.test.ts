import { describe, it, expect } from 'vitest';
import { toLatin, stripKeep, toLatinDeep } from '../src/lib/translit';

describe('toLatin', () => {
  it('maps every Serbian Cyrillic letter', () => {
    expect(toLatin('абвгдђежзијклљмнњопрстћуфхцчџш'))
      .toBe('abvgdđežzijklljmnnjoprstćufhcčdžš');
  });
  it('handles capital digraphs by context', () => {
    expect(toLatin('Љубав')).toBe('Ljubav');
    expect(toLatin('ЉУБАВ')).toBe('LJUBAV');
    expect(toLatin('Њива')).toBe('Njiva');
    expect(toLatin('ЊИВА')).toBe('NJIVA');
    expect(toLatin('Џем')).toBe('Džem');
    expect(toLatin('ЏЕМ')).toBe('DŽEM');
    expect(toLatin('КОЊ')).toBe('KONJ');
    expect(toLatin('Љ')).toBe('Lj');
  });
  it('converts real content', () => {
    expect(toLatin('Гостиона Код 4 Лава')).toBe('Gostiona Kod 4 Lava');
    expect(toLatin('Трг Бранка Радичевића 3, 21205 Сремски Карловци'))
      .toBe('Trg Branka Radičevića 3, 21205 Sremski Karlovci');
    expect(toLatin('Чесма „Четири лава“')).toBe('Česma „Četiri lava“');
    expect(toLatin('Шненокле, ћевапи, џезва')).toBe('Šnenokle, ćevapi, džezva');
  });
  it('never touches numbers, phone numbers, URLs or latin text', () => {
    expect(toLatin('Позовите 060 5210606')).toBe('Pozovite 060 5210606');
    expect(toLatin('+381 60 5210606')).toBe('+381 60 5210606');
    expect(toLatin('види https://wa.me/381605210606?text=Ћао'))
      .toBe('vidi https://wa.me/381605210606?text=Ћао');
    expect(toLatin('Wine country burger · 1.250 дин.')).toBe('Wine country burger · 1.250 din.');
  });
  it('keeps {= =} segments as-is and strips markers', () => {
    expect(toLatin('Бренд {=ЋИР=} остаје')).toBe('Brend ЋИР ostaje');
    expect(stripKeep('Бренд {=ЋИР=} остаје')).toBe('Бренд ЋИР остаје');
  });
  it('transliterates nested objects', () => {
    expect(toLatinDeep({ a: ['Лав', { b: 'Чесма' }], n: 3, x: null }))
      .toEqual({ a: ['Lav', { b: 'Česma' }], n: 3, x: null });
  });
});
