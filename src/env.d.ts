/// <reference types="vite/client" />

declare module 'weixin-js-sdk'

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_ASR_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
