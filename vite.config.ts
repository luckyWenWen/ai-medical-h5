import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // http://47.113.122.118:9118/preconsult/ 
  //  http://192.168.1.88:9120/
  server: {
    port: 5183,
    proxy: {
      '/api': {
        target: 'http://192.168.1.88:9120/',
        // target: 'http://47.113.122.118:9118/preconsult',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
