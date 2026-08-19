export function getAsrWebSocketUrl(mode = '1') {
  const configured = import.meta.env.VITE_ASR_WS_URL || '/ws/asr'
  const currentProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const normalized = configured.trim()

  let urlText: string
  if (/^https?:\/\//i.test(normalized)) {
    urlText = normalized.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:')
  } else if (/^wss?:\/\//i.test(normalized)) {
    urlText = normalized
  } else {
    const path = normalized.startsWith('/') ? normalized : `/${normalized}`
    urlText = `${currentProtocol}//${window.location.host}${path}`
  }

  const url = new URL(urlText)
  url.searchParams.set('mode', mode)
  return url.toString()
}
