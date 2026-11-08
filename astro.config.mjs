// @ts-check
import { defineConfig } from 'astro/config';

// PUBLIC_SITE_URL may include a sub-path, e.g. GitHub Pages:
//   https://rodrigomigl54-png.github.io/4-lava  → site = origin, base = /4-lava
// TODO_VERIFY: set it to the real domain before launch.
const url = new URL(process.env.PUBLIC_SITE_URL || 'https://www.example.com');
const base = url.pathname.replace(/\/+$/, '') || '/';

export default defineConfig({
  site: url.origin,
  base,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  compressHTML: true,
  devToolbar: { enabled: false },
  vite: {
    build: { assetsInlineLimit: 2048 },
  },
});
