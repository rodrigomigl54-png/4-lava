#!/usr/bin/env node
/**
 * make-qr.mjs — print-ready QR codes for the table menu.
 *
 *   node scripts/make-qr.mjs [--site https://www.domen.rs]
 *
 * Output (qr/):
 *   meni-sr.svg / .png, meni-lat.svg / .png, meni-en.svg / .png   QR with the half-lion in the centre
 *   stoni-karton-a6.html                                           A6 table cards (print → "Save as PDF", 100 %)
 *
 * Error correction level H (30 %) so the lion in the middle never breaks scanning.
 * Uses PUBLIC_SITE_URL (or --site). Re-run after the domain changes.
 */
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import sharp from 'sharp';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const argSite = process.argv.indexOf('--site');
const site = (argSite > -1 ? process.argv[argSite + 1] : process.env.PUBLIC_SITE_URL) || 'https://www.example.com';
if (site.includes('example.com')) console.warn('⚠  PUBLIC_SITE_URL is not set — QR codes point to example.com (demo only).');

const out = path.join(root, 'qr');
fs.mkdirSync(out, { recursive: true });

const lionSvg = fs.readFileSync(path.join(root, 'public/brand/logo-lion-half.svg'), 'utf8');
const lionInner = lionSvg.slice(lionSvg.indexOf('>') + 1, lionSvg.lastIndexOf('</svg>'));

const INK = '#272624', CREAM = '#F3EBDD', GOLD = '#B08D57', BORDEAUX = '#5E1A1F';

function qrSvg(url, { size = 1000, quiet = 4 } = {}) {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const total = n + quiet * 2;
  const cell = size / total;
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!qr.modules.get(y, x)) continue;
    // skip modules under the centre badge (≈ 22 % of the code — safe with level H)
    const cx = x - n / 2 + 0.5, cy = y - n / 2 + 0.5;
    if (Math.abs(cx) < n * 0.12 && Math.abs(cy) < n * 0.12) continue;
    d += `M${((x + quiet) * cell).toFixed(2)} ${((y + quiet) * cell).toFixed(2)}h${cell.toFixed(2)}v${cell.toFixed(2)}h-${cell.toFixed(2)}z`;
  }
  const badge = n * 0.24 * cell;
  const bx = size / 2 - badge / 2;
  const lionH = badge * 0.84, lionW = lionH * (750 / 1296);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="#fff"/>
  <path d="${d}" fill="${INK}"/>
  <rect x="${bx}" y="${bx}" width="${badge}" height="${badge}" rx="${badge * 0.12}" fill="${CREAM}" stroke="${GOLD}" stroke-width="${cell * 0.5}"/>
  <svg x="${size / 2 - lionW * 0.75}" y="${size / 2 - lionH / 2}" width="${lionW}" height="${lionH}" viewBox="0 0 750 1296" fill="${INK}">${lionInner}</svg>
</svg>`;
}

const LOCALES = [
  { id: 'sr', path: '/meni/', label: 'Јеловник', scan: 'Скенирајте за јеловник', name: 'Гостиона Код 4 Лава' },
  { id: 'lat', path: '/lat/meni/', label: 'Jelovnik', scan: 'Skenirajte za jelovnik', name: 'Gostiona Kod 4 Lava' },
  { id: 'en', path: '/en/meni/', label: 'Menu', scan: 'Scan for the menu', name: 'Gostiona Kod 4 Lava' },
];

const cards = [];
for (const l of LOCALES) {
  // keep a sub-path such as GitHub Pages' /4-lava
  const url = site.replace(/\/+$/, '') + l.path;
  const svg = qrSvg(url);
  fs.writeFileSync(path.join(out, `meni-${l.id}.svg`), svg);
  await sharp(Buffer.from(svg), { density: 300 }).resize(1200, 1200).png().toFile(path.join(out, `meni-${l.id}.png`));
  cards.push({ ...l, url, svg });
  console.log(`✓ ${l.id}: ${url}`);
}

// A6 table card: one card per page, all three languages listed, QR for the chosen locale
const card = (c) => `
<section class="card">
  <div class="frame">
    <svg class="lion" viewBox="0 0 750 1296" fill="${INK}">${lionInner}</svg>
    <p class="brand">${c.name}</p>
    <p class="place">${c.id === 'sr' ? 'Сремски Карловци · преко пута чесме' : c.id === 'lat' ? 'Sremski Karlovci · preko puta česme' : 'Sremski Karlovci · across from the fountain'}</p>
    <h1>${c.label}</h1>
    <div class="qr">${c.svg.replace('<svg ', '<svg class="code" ')}</div>
    <p class="scan">${c.scan}</p>
    <p class="langs">Ћирилица · Latinica · English</p>
    <p class="url">${c.url.replace(/^https?:\/\//, '')}</p>
  </div>
</section>`;
const html = `<!doctype html>
<html lang="sr"><head><meta charset="utf-8"><title>QR — стони картони A6</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,500&family=Lora:wght@400;600&display=swap">
<style>
  @page { size: A6; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #ddd; font-family: Lora, Georgia, serif; color: ${INK}; }
  .card { width: 105mm; height: 148mm; margin: 10mm auto; background: ${CREAM}; padding: 5mm; page-break-after: always; break-after: page; print-color-adjust: exact; -webkit-print-color-adjust: exact; position: relative; overflow: hidden; }
  .frame { height: 100%; border: 0.6mm solid ${GOLD}; outline: 0.2mm solid ${GOLD}; outline-offset: -1.6mm; display: flex; flex-direction: column; align-items: center; text-align: center; padding: 7mm 6mm 5mm; position: relative; }
  .lion { position: absolute; left: 0; top: 4mm; height: 30mm; opacity: .9; }
  .brand { margin: 0; font: 600 9pt Lora, serif; letter-spacing: .2em; text-transform: uppercase; color: #7A5F32; }
  .place { margin: 1mm 0 0; font: italic 500 10pt 'Cormorant Garamond', serif; color: #6B5D52; }
  h1 { margin: 3mm 0 3mm; font: 600 30pt/1 'Cormorant Garamond', serif; color: ${BORDEAUX}; }
  .qr { width: 62mm; height: 62mm; padding: 2mm; background: #fff; border: 0.3mm solid ${GOLD}; }
  .code { width: 100%; height: 100%; }
  .scan { margin: 4mm 0 1mm; font: italic 500 14pt 'Cormorant Garamond', serif; color: ${BORDEAUX}; }
  .langs { margin: 0; font-size: 7pt; letter-spacing: .14em; text-transform: uppercase; color: #7A5F32; }
  .url { margin: auto 0 0; font-size: 6.5pt; color: #6B5D52; }
  @media print { body { background: none; } .card { margin: 0; } }
</style></head><body>
${cards.map(card).join('\n')}
</body></html>`;
fs.writeFileSync(path.join(out, 'stoni-karton-a6.html'), html);
console.log(`✓ qr/stoni-karton-a6.html (A6, ${cards.length} cards) — open in a browser → Print → Save as PDF, scale 100 %`);
