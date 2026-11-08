import type { APIRoute } from 'astro';
import { LOCALES, HTML_LANG, localePath } from '../lib/i18n';

const PAGES = ['/', '/meni/'];

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://www.example.com');
  const abs = (p: string) => new URL(p, base).href;
  const urls = PAGES.flatMap((p) =>
    LOCALES.map((l) => {
      const alts = LOCALES.map((a) => `    <xhtml:link rel="alternate" hreflang="${HTML_LANG[a]}" href="${abs(localePath(a, p))}"/>`).join('\n');
      return `  <url>\n    <loc>${abs(localePath(l, p))}</loc>\n${alts}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(p)}"/>\n    <changefreq>${p === '/meni/' ? 'weekly' : 'monthly'}</changefreq>\n  </url>`;
    }),
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
