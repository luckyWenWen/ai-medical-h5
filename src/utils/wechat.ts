type JsApiName =
  | 'chooseImage'
  | 'previewImage'
  | 'uploadImage'
  | 'scanQRCode'
  | 'updateAppMessageShareData'
  | 'updateTimelineShareData'

interface WeChatConfig {
  appId: string
  timestamp: number
  nonceStr: string
  signature: string
  jsApiList?: JsApiName[]
}

const defaultJsApiList: JsApiName[] = [
  'chooseImage',
  'previewImage',
  'uploadImage',
  'scanQRCode',
  'updateAppMessageShareData',
  'updateTimelineShareData'
]

export async function setupWeChat(config: WeChatConfig) {
  const wx = await import('weixin-js-sdk')

  wx.default.config({
    debug: false,
    appId: config.appId,
    timestamp: config.timestamp,
    nonceStr: config.nonceStr,
    signature: config.signature,
    jsApiList: config.jsApiList || defaultJsApiList
  })

  return new Promise<void>((resolve, reject) => {
    wx.default.ready(() => resolve())
    wx.default.error((error: unknown) => reject(error))
  })
}
