import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

function resolveHttpsOptions(env: Record<string, string>) {
  if (env.VITE_DEV_HTTPS !== 'true') return undefined

  const keyPath = env.VITE_DEV_HTTPS_KEY
  const certPath = env.VITE_DEV_HTTPS_CERT
  if (!keyPath || !certPath) {
    throw new Error('VITE_DEV_HTTPS=true requires VITE_DEV_HTTPS_KEY and VITE_DEV_HTTPS_CERT.')
  }

  const keyFile = path.resolve(process.cwd(), keyPath)
  const certFile = path.resolve(process.cwd(), certPath)
  if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
    throw new Error(`HTTPS cert files not found: ${keyFile}, ${certFile}`)
  }

  return {
    key: fs.readFileSync(keyFile),
    cert: fs.readFileSync(certFile)
  }
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function normalizeBasePath(value: string) {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '/') return '/'

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${withLeadingSlash.replace(/\/+$/, '')}/`
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://192.168.1.88:9120/'
  const asrProxyTarget = stripTrailingSlash(env.VITE_ASR_PROXY_TARGET || 'ws://192.168.2.43:8000')
  const httpsOptions = resolveHttpsOptions(env)

  return {
    plugins: [vue()],
    base: normalizeBasePath(env.VITE_BASE_PATH || '/'),
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    // http://47.113.122.118:9118/preconsult/
    // http://192.168.1.88:9120/
    server: {
      port: Number(env.VITE_DEV_PORT || 5183),
      host: '0.0.0.0',
      https: httpsOptions,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          // target: 'http://47.113.122.118:9118/preconsult',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/ws': {
          target: asrProxyTarget,
          ws: true,
          changeOrigin: true
        }
      }
    },
    preview: {
      host: '0.0.0.0',
      port: Number(env.VITE_PREVIEW_PORT || 4173),
      https: httpsOptions,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/ws': {
          target: asrProxyTarget,
          ws: true,
          changeOrigin: true
        }
      }
    }
  }
})
