import { defineConfig } from 'vite';

// `base: './'` keeps every asset path relative so the build works on
// GitHub Pages (served from /<repo-name>/) and when opened from any folder.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5173,
    host: true,
  },
});
