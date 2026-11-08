// @ts-check
import { defineConfig } from 'astro/config';

// TODO_VERIFY: set PUBLIC_SITE_URL to the real domain before launch.
const site = process.env.PUBLIC_SITE_URL || 'https://www.example.com';

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory', inlineStylesheets: 'auto' },
  compressHTML: true,
  devToolbar: { enabled: false },
  vite: {
    build: { assetsInlineLimit: 2048 },
  },
});
