import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

function resolveHttpsOptions(env: Record<string, string>) {
  if (env.VITE_DEV_HTTPS !== 'true') return undefined

  const keyPath = env.VITE_DEV_HTTPS_KEY
  const certPath = env.VITE_DEV_HTTPS_CERT
  if (!keyPath || !certPath) return true

  const keyFile = path.resolve(process.cwd(), keyPath)
  const certFile = path.resolve(process.cwd(), certPath)
  if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) return true

  return {
    key: fs.readFileSync(keyFile),
    cert: fs.readFileSync(certFile)
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue()],
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
      https: resolveHttpsOptions(env),
      proxy: {
        '/api': {
          target: 'http://192.168.1.88:9120/',
          // target: 'http://47.113.122.118:9118/preconsult',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    },
    preview: {
      host: '0.0.0.0',
      https: resolveHttpsOptions(env)
    }
  }
})
