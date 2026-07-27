/// <reference types="vite/client" />

declare module 'weixin-js-sdk'

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
