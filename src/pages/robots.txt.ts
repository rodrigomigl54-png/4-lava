import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const demo = import.meta.env.PUBLIC_DEMO !== 'false';
  const body = demo
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', site).href}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
