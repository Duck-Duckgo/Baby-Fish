import { defineConfig } from 'vite'

// Custom domain dirtykiki.com is served from the site root.
export default defineConfig({
  base: '/',
  server: {
    host: '127.0.0.1',
    port: 47823,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 47824,
    strictPort: true,
  },
})
