import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBase = env.VITE_API_BASE_URL ? new URL(env.VITE_API_BASE_URL) : undefined
  const apiPath = apiBase?.pathname.replace(/\/+$/, '') ?? ''

  return {
    plugins: [react()],
    server: apiBase
      ? {
          proxy: {
            '/__api': {
              target: apiBase.origin,
              changeOrigin: true,
              rewrite: (path) => `${apiPath}${path.replace(/^\/__api/, '')}`,
            },
          },
        }
      : undefined,
  }
})
