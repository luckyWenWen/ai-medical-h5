/// <reference types="vite/client" />

declare module 'weixin-js-sdk'

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_API_PROXY_TARGET?: string
  readonly VITE_ASR_WS_URL?: string
  readonly VITE_ASR_PROXY_TARGET?: string
  readonly VITE_DEV_PORT?: string
  readonly VITE_PREVIEW_PORT?: string
  readonly VITE_DEV_HTTPS?: string
  readonly VITE_DEV_HTTPS_KEY?: string
  readonly VITE_DEV_HTTPS_CERT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
