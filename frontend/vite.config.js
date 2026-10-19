import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // In development the static app calls the local backend through /api.
    proxy: { '/api': 'http://localhost:4000' },
  },
  test: {
    include: ['test/**/*.{test,spec}.{js,jsx}'],
    environment: 'jsdom',
  },
})
