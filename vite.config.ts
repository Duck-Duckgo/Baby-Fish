import { defineConfig } from 'vite'

export default defineConfig({
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
