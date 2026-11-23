import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'

/** Tells the browser never to keep a copy of anything: every load comes from the server. */
const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
}

/**
 * Build mode used by `npm run start`: the minified production bundle (no readable source in the
 * browser), but API calls stay same-origin and go through the proxy below, like in dev.
 */
const PROXY_MODE = 'proxy'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '')

  // API calls are same-origin (same path, no prefix) and forwarded to the backend here,
  // so the browser sends no CORS preflight (OPTIONS) requests — only GET / POST / PATCH / DELETE.
  const proxy: Record<string, ProxyOptions> | undefined = backend
    ? {
        '/': {
          target: backend,
          changeOrigin: true,
          // Only API calls (fetch with Accept: application/json) go to the backend;
          // pages, scripts and assets are still served by Vite.
          bypass: (req) => (req.headers.accept?.includes('application/json') ? undefined : req.url),
          // Backend responses must not be cached either, whatever headers the backend sends.
          configure: (proxy) => {
            proxy.on('proxyRes', (res) => {
              delete res.headers.etag
              delete res.headers['last-modified']
              res.headers['cache-control'] = NO_CACHE['Cache-Control']
              res.headers.pragma = NO_CACHE.Pragma
              res.headers.expires = NO_CACHE.Expires
            })
          },
        },
      }
    : undefined

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_API_PROXY': JSON.stringify(mode === PROXY_MODE ? 'true' : ''),
    },
    build: {
      // Never ship source maps: the browser only gets the minified bundle.
      sourcemap: false,
    },
    server: { headers: NO_CACHE, proxy },
    // `npm run start` / `npm run preview` (the production build served locally) behave the same way.
    preview: { headers: NO_CACHE, proxy },
  }
})
