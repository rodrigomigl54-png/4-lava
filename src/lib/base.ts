/**
 * Base path of the deployment ("" at a domain root, "/4-lava" on GitHub Pages).
 * Every root-absolute URL to a page or a file in public/ goes through asset().
 */
export const BASE = (import.meta.env?.BASE_URL ?? '/').replace(/\/+$/, '');

/** "/fonts/x.woff2" → "/4-lava/fonts/x.woff2" (no-op at a domain root). */
export const asset = (p: string) => (p.startsWith('/') && !p.startsWith('//') ? `${BASE}${p}` : p);

/** Remove the base from a pathname. */
export const stripBase = (pathname: string) =>
  BASE && pathname.startsWith(BASE) ? pathname.slice(BASE.length) || '/' : pathname;

/** Deep-map every "/…" string in a JSON value through asset() (intro manifest etc.). */
export function assetDeep<T>(v: T): T {
  if (typeof v === 'string') return asset(v) as T;
  if (Array.isArray(v)) return v.map(assetDeep) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, assetDeep(x)])) as T;
  return v;
}
