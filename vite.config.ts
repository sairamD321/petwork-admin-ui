import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '')

  return {
    plugins: [react()],
    // In dev, API calls are same-origin (same path, no prefix) and forwarded to the backend here,
    // so the browser sends no CORS preflight (OPTIONS) requests — only GET / POST / PUT / DELETE.
    server: backend
      ? {
          proxy: {
            '/': {
              target: backend,
              changeOrigin: true,
              // Only API calls (fetch with Accept: application/json) go to the backend;
              // pages, scripts and assets are still served by Vite.
              bypass: (req) => (req.headers.accept?.includes('application/json') ? undefined : req.url),
            },
          },
        }
      : undefined,
  }
})
