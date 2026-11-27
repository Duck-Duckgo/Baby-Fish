import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Custom domain dirtykiki.com is served from the site root.
// Source entry is index.vite.html; `npm run build` publishes index.html + assets/
// at the repo root so legacy GitHub Pages (main /) can serve the aquarium.
export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: resolve(import.meta.dirname, 'index.vite.html'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 47823,
    strictPort: true,
    open: '/index.vite.html',
  },
  preview: {
    host: '127.0.0.1',
    port: 47824,
    strictPort: true,
  },
})
