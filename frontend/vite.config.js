import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, ['VITE_', 'DEV_'])
  // Keep browser requests same-origin so local development works with session cookies.
  // DEV_API_TARGET is server-only; teammates can still run their own local backend.
  const apiTarget = env.DEV_API_TARGET || 'http://localhost:4000'
  const apiProxy = {
    '/api': {
      target: apiTarget,
      changeOrigin: true,
      cookieDomainRewrite: '',
    },
  }
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: apiProxy,
    },
    preview: { proxy: apiProxy },
    test: {
      include: ['test/**/*.{test,spec}.{js,jsx}'],
      environment: 'jsdom',
    },
  }
})
