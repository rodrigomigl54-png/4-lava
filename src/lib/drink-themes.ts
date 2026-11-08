/**
 * One custom background per drink (cellar section). Each theme: two background
 * colours, a soft glow colour and a gold line-art motif that hints at the fruit,
 * grape or spice. Clean and quiet: low-opacity line art over a deep gradient.
 */
export interface DrinkTheme { top: string; bottom: string; glow: string; line: string; motif: string; pos?: string; size?: string }

const dataUri = (body: string, vb = '0 0 240 240') =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb}' fill='none' stroke-linecap='round' stroke-linejoin='round'>${body}</svg>`)}`;
const svg = (body: string, vb = '0 0 240 240') => `url("${dataUri(body, vb)}")`;

const grapes = (c: string) => `<g stroke='${c}' stroke-width='1.4'><path d='M120 30c0 20-6 30-16 40M120 30c14 4 30 0 40-12'/>${[[104,78],[124,78],[144,78],[94,98],[114,98],[134,98],[154,98],[104,118],[124,118],[144,118],[114,138],[134,138],[124,158]].map(([x,y])=>`<circle cx='${x}' cy='${y}' r='11'/>`).join('')}<path d='M160 18c18-10 40-4 48 12-16 6-34 4-48-12z'/></g>`;
const fruit = (c: string, leaf = true, pear = false) => `<g stroke='${c}' stroke-width='1.4'>${pear
  ? `<path d='M120 60c-10 0-14 14-14 26 0 14-26 26-26 60 0 30 20 46 40 46s40-16 40-46c0-34-26-46-26-60 0-12-4-26-14-26z'/>`
  : `<circle cx='120' cy='132' r='54'/><path d='M120 78c-6 30-6 74 0 108' opacity='.6'/>`}<path d='M120 60c0-14 4-24 12-30'/>${leaf ? `<path d='M132 40c20-14 46-10 58 6-20 10-44 10-58-6zM140 42c14 0 30 2 42 4' />` : ''}</g>`;

export const THEMES: Record<string, DrinkTheme> = {
  rizling:   { top: '#2c3a1c', bottom: '#11180b', glow: 'rgb(214 226 140 / 0.22)', line: '#d9dc8e', motif: svg(grapes('#d9dc8e')) },
  podrum:    { top: '#3d0d18', bottom: '#14040a', glow: 'rgb(170 40 70 / 0.25)', line: '#c97a8a', motif: svg(`${grapes('#c97a8a')}<g stroke='#c97a8a' stroke-width='1.2'><ellipse cx='60' cy='200' rx='34' ry='22'/><path d='M26 200v-30M94 200v-30M26 170c0-14 68-14 68 0'/></g>`) },
  sila:      { top: '#33391d', bottom: '#14170b', glow: 'rgb(230 220 150 / 0.18)', line: '#e2d79a', motif: svg(grapes('#e2d79a')) },
  roze:      { top: '#4a1f27', bottom: '#1c0a0f', glow: 'rgb(240 160 160 / 0.22)', line: '#eab0b0', motif: svg(`<g stroke='#eab0b0' stroke-width='1.4'><path d='M120 70c-30 0-44 26-44 46 0 30 22 50 44 50s44-20 44-50c0-20-14-46-44-46z'/><path d='M120 90c-14 0-20 12-20 22s8 20 20 20 20-10 20-20-6-22-20-22zM120 166v50M120 196c-14-10-30-10-40 0M120 186c14-10 30-10 40 0'/></g>`) },
  probus:    { top: '#2a0b1f', bottom: '#0f030b', glow: 'rgb(150 50 120 / 0.24)', line: '#c08ab4', motif: svg(grapes('#c08ab4')) },
  portugizer:{ top: '#2b1022', bottom: '#10050c', glow: 'rgb(180 90 140 / 0.2)', line: '#c99cc0', motif: svg(`${grapes('#c99cc0')}<g stroke='#c99cc0' stroke-width='1.1'><path d='M30 40h40v30H30zM50 40v30M30 55h40'/></g>`) },
  bermet:    { top: '#3d1d0b', bottom: '#160903', glow: 'rgb(230 150 70 / 0.26)', line: '#e2b06a', motif: svg(`<g stroke='#e2b06a' stroke-width='1.3'><path d='M60 180c30-60 90-90 140-96M90 160c-6-14-20-20-34-16 4 14 18 20 34 16zM120 136c-4-14-16-22-30-20 2 14 14 22 30 20zM150 116c-2-14-12-24-26-24 0 14 10 24 26 24z'/><path d='M150 170l10-30 10 30-10 30z'/><circle cx='70' cy='70' r='6'/><circle cx='86' cy='60' r='4'/><path d='M180 50l6 12 13 2-10 9 3 13-12-7-12 7 3-13-10-9 13-2z'/></g>`) },
  sljiva:    { top: '#1d1735', bottom: '#0a0814', glow: 'rgb(130 110 220 / 0.24)', line: '#b2a6e6', motif: svg(`<g stroke='#b2a6e6' stroke-width='1.4'><ellipse cx='108' cy='138' rx='42' ry='50'/><path d='M108 88c-8 30-8 70 0 100' opacity='.6'/><ellipse cx='162' cy='150' rx='34' ry='42'/><path d='M108 88c4-16 14-26 26-30M134 56c16-12 40-8 50 6-18 8-38 8-50-6z'/></g>`) },
  orah:      { top: '#17261a', bottom: '#070d08', glow: 'rgb(120 180 110 / 0.2)', line: '#a9cf9a', motif: svg(`<g stroke='#a9cf9a' stroke-width='1.4'><circle cx='120' cy='140' r='44'/><path d='M120 96v88M96 108c10 10 10 54 0 64M144 108c-10 10-10 54 0 64'/><path d='M120 96c0-30 20-50 50-60M150 52c18-16 44-14 56 4-20 8-42 8-56-4zM140 70c20-6 40 2 50 16-20 4-38 0-50-16z'/></g>`) },
  dunja:     { top: '#3a2c0c', bottom: '#151004', glow: 'rgb(240 200 90 / 0.24)', line: '#ead07a', motif: svg(`<g stroke='#ead07a' stroke-width='1.4'><path d='M120 70c-36 0-60 30-56 66 4 38 30 60 58 58 30-2 54-26 52-62-2-36-22-62-54-62z'/><path d='M100 84c-10 10-14 24-12 38M120 70c0-16 6-28 16-34M136 36c18-10 42-4 52 12-20 6-40 4-52-12z'/></g>`) },
  kajsija:   { top: '#3d1d0c', bottom: '#170a04', glow: 'rgb(250 160 80 / 0.26)', line: '#f0ad73', motif: svg(fruit('#f0ad73')) },
  kruska:    { top: '#2a3011', bottom: '#0f1206', glow: 'rgb(200 220 110 / 0.22)', line: '#cfdc86', motif: svg(fruit('#cfdc86', true, true)) },
  loza:      { top: '#2f2412', bottom: '#120d06', glow: 'rgb(230 200 140 / 0.2)', line: '#e4cf9c', motif: svg(`${grapes('#e4cf9c')}<g stroke='#e4cf9c' stroke-width='1.2'><path d='M40 200h40l-6 30H46z'/></g>`) },
};

/** Inline style for a theme layer. */
export function themeStyle(key: string | null | undefined): string {
  const t = THEMES[key ?? ''] ?? THEMES.loza;
  return [
    `--line:${t.line}`,
    `background:` +
      `radial-gradient(55% 45% at 50% 30%, ${t.glow}, transparent 70%),` +
      `${t.motif} right 4% top 8% / min(34vw, 300px) no-repeat,` +
      `${t.motif} left -4% bottom -6% / min(26vw, 220px) no-repeat,` +
      `linear-gradient(180deg, ${t.top} 0%, ${t.bottom} 100%)`,
  ].join(';');
}

/** The motif as a plain data URI (for <image href> inside SVG, e.g. the pairing wheel). */
export function motifUri(key: string | null | undefined): string {
  const t = THEMES[key ?? ''] ?? THEMES.loza;
  return t.motif.slice(5, -2);
}
export const themeOf = (key: string | null | undefined) => THEMES[key ?? ''] ?? THEMES.loza;
