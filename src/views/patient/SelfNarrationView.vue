<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { savePreconsultFreeTextApi } from '@/api/consultation'
import AppNavBar from '@/components/AppNavBar.vue'
import { useConsultationStore } from '@/stores/consultation'
import { getAsrWebSocketUrl } from '@/utils/asr'

type SpeechStatus = 'idle' | 'connecting' | 'recording' | 'stopping' | 'error'

interface AsrMessage {
  text?: string
  is_final?: boolean
  mode?: string
  speaker?: string
}

const router = useRouter()
const store = useConsultationStore()
const submitting = ref(false)
const text = ref(store.selfNarration?.mode === 'text' ? store.selfNarration.text : '')
const speechStatus = ref<SpeechStatus>('idle')
const interimText = ref('')
const speechError = ref('')
const recordedSeconds = ref(0)
const segmentCount = ref(0)
const textLength = computed(() => text.value.trim().length)
const isSpeechActive = computed(() => speechStatus.value === 'connecting' || speechStatus.value === 'recording')
const speechButtonText = computed(() => {
  if (speechStatus.value === 'connecting') return '连接中'
  if (speechStatus.value === 'recording') return '停止语音输入'
  if (speechStatus.value === 'stopping') return '整理识别中'
  return '开始语音输入'
})
const speechStatusText = computed(() => {
  if (speechStatus.value === 'connecting') return '正在连接语音识别服务'
  if (speechStatus.value === 'recording') return interimText.value || '正在听您说话'
  if (speechStatus.value === 'stopping') return '正在整理最后一句'
  if (speechStatus.value === 'error') return speechError.value || '语音识别暂不可用'
  return '点击开始后，说出的内容会自动转成文字'
})
const timerText = computed(() => {
  const minute = Math.floor(recordedSeconds.value / 60)
  const second = recordedSeconds.value % 60
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
})

let ws: WebSocket | null = null
let audioContext: AudioContext | null = null
let mediaStream: MediaStream | null = null
let processor: ScriptProcessorNode | null = null
let timer: number | undefined

function getMicrophoneStream(constraints: MediaStreamConstraints) {
  if (navigator.mediaDevices?.getUserMedia) {
    return navigator.mediaDevices.getUserMedia(constraints)
  }

  const legacyNavigator = navigator as Navigator & {
    webkitGetUserMedia?: (
      constraints: MediaStreamConstraints,
      successCallback: (stream: MediaStream) => void,
      errorCallback: (error: DOMException) => void
    ) => void
    mozGetUserMedia?: (
      constraints: MediaStreamConstraints,
      successCallback: (stream: MediaStream) => void,
      errorCallback: (error: DOMException) => void
    ) => void
  }
  const legacyGetUserMedia = legacyNavigator.webkitGetUserMedia || legacyNavigator.mozGetUserMedia
  if (legacyGetUserMedia) {
    return new Promise<MediaStream>((resolve, reject) => {
      legacyGetUserMedia.call(navigator, constraints, resolve, reject)
    })
  }

  return Promise.reject(new Error(window.isSecureContext ? 'UNSUPPORTED_MEDIA' : 'INSECURE_CONTEXT'))
}

function appendRecognizedText(value: string) {
  const cleanText = value.trim()
  if (!cleanText) return
  const current = text.value.trim()
  if (!current) {
    text.value = cleanText
    return
  }
  text.value = `${current}${/[。！？!?，,；;]$/.test(current) ? '' : '，'}${cleanText}`
}

function handleAsrMessage(data: AsrMessage) {
  const recognizedText = String(data.text || '').trim()
  if (!recognizedText) {
    if (data.is_final) interimText.value = ''
    return
  }

  if (data.is_final === false) {
    interimText.value = recognizedText
    return
  }

  segmentCount.value += 1
  interimText.value = ''
  appendRecognizedText(recognizedText)
}

async function startSpeechInput() {
  if (isSpeechActive.value) return
  if (!window.isSecureContext) {
    speechStatus.value = 'error'
    speechError.value = '麦克风需要 HTTPS 或 localhost 环境'
    showToast(speechError.value)
    return
  }

  try {
    speechError.value = ''
    interimText.value = ''
    segmentCount.value = 0
    recordedSeconds.value = 0
    speechStatus.value = 'connecting'

    mediaStream = await getMicrophoneStream({
      audio: {
        channelCount: 1,
        sampleRate: 16000
      }
    })

    ws = new WebSocket(getAsrWebSocketUrl())
    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      speechStatus.value = 'recording'
      const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextConstructor) {
        speechStatus.value = 'error'
        speechError.value = '当前浏览器不支持音频采集'
        showToast(speechError.value)
        ws?.close()
        cleanupSpeechResources()
        return
      }
      audioContext = new AudioContextConstructor({ sampleRate: 16000 })
      const source = audioContext.createMediaStreamSource(mediaStream as MediaStream)
      processor = audioContext.createScriptProcessor(4096, 1, 1)
      source.connect(processor)
      processor.connect(audioContext.destination)

      processor.onaudioprocess = (event) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return
        const inputData = event.inputBuffer.getChannelData(0)
        const pcm16 = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i += 1) {
          const sample = Math.max(-1, Math.min(1, inputData[i]))
          pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
        }
        ws.send(pcm16.buffer)
      }

      timer = window.setInterval(() => {
        recordedSeconds.value += 1
      }, 1000)
    }

    ws.onmessage = (event) => {
      try {
        handleAsrMessage(JSON.parse(String(event.data)))
      } catch {
        // 非 JSON 消息忽略，测试页也只消费 JSON 文本结果。
      }
    }

    ws.onerror = () => {
      speechStatus.value = 'error'
      speechError.value = '语音识别连接失败，请稍后重试'
      showToast(speechError.value)
      ws?.close()
      cleanupSpeechResources()
    }

    ws.onclose = () => {
      cleanupSpeechResources()
      if (speechStatus.value !== 'error') {
        speechStatus.value = 'idle'
      }
    }
  } catch (error) {
    speechStatus.value = 'error'
    const message = error instanceof Error && error.message === 'UNSUPPORTED_MEDIA'
      ? '当前浏览器不支持麦克风录音'
      : '无法获取麦克风权限'
    speechError.value = message
    showToast(speechError.value)
    cleanupSpeechResources()
  }
}

function cleanupSpeechResources() {
  if (timer) {
    window.clearInterval(timer)
    timer = undefined
  }
  if (processor) {
    processor.disconnect()
    processor = null
  }
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop())
    mediaStream = null
  }
  ws = null
}

function stopSpeechInput(sendFlush = true) {
  if (!ws && !mediaStream) {
    speechStatus.value = 'idle'
    return
  }
  speechStatus.value = 'stopping'
  if (sendFlush && ws?.readyState === WebSocket.OPEN) {
    ws.send('flush')
  }
  if (ws && ws.readyState <= WebSocket.OPEN) {
    window.setTimeout(() => {
      ws?.close()
      cleanupSpeechResources()
      speechStatus.value = 'idle'
    }, 400)
    return
  }
  cleanupSpeechResources()
  speechStatus.value = 'idle'
}

function toggleSpeechInput() {
  if (isSpeechActive.value) {
    stopSpeechInput()
    return
  }
  startSpeechInput()
}

async function next() {
  if (submitting.value) return
  if (isSpeechActive.value) {
    stopSpeechInput()
  }
  const content = text.value.trim()
  if (!content) {
    showToast('请先描述您的病情')
    return
  }

  submitting.value = true
  try {
    store.saveSelfNarration({
      mode: 'text',
      text: content
    })
    if (!store.recordId) {
      await store.loadQuestions()
    }
    if (!store.recordId) {
      throw new Error('问诊记录尚未创建，请稍后重试')
    }
    await savePreconsultFreeTextApi(store.recordId, { freeText: content })
    const reportReady = await store.buildReport()
    if (!reportReady) return
    router.push('/report')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '进入问诊失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

onBeforeUnmount(() => {
  stopSpeechInput(false)
})
</script>

<template>
  <div class="page narration-page">
    <AppNavBar title="自由描述" back />

    <main class="page-body narration-body">
      <section class="narration-card">
        <h1>请用自己的话描述病情</h1>
        <div class="speech-panel" :class="{ 'speech-panel--active': isSpeechActive }">
          <button
            type="button"
            class="speech-button"
            :disabled="speechStatus === 'connecting' || speechStatus === 'stopping'"
            @click="toggleSpeechInput"
          >
            <van-icon :name="isSpeechActive ? 'pause-circle-o' : 'volume-o'" />
          </button>
          <div class="speech-panel__info">
            <strong>{{ speechButtonText }}</strong>
            <span>{{ speechStatusText }}</span>
          </div>
          <div class="speech-panel__meta">
            <span>{{ timerText }}</span>
            <span v-if="segmentCount">{{ segmentCount }} 句</span>
          </div>
        </div>
        <van-field
          v-model="text"
          class="narration-textarea"
          type="textarea"
          rows="10"
          maxlength="1000"
          show-word-limit
          autofocus
          placeholder="例如：哪里不舒服、持续多久、疼痛程度、是否发热、用过什么药、以前有没有类似情况。"
        />
        <div class="narration-prompts">
          <span>主要不适</span>
          <span>持续时间</span>
          <span>伴随症状</span>
          <span>用药情况</span>
        </div>
      </section>
    </main>

    <div class="fixed-action">
      <div class="fixed-action__inner">
        <van-button type="primary" block :loading="submitting" :disabled="submitting || !textLength" @click="next">
          确认并生成报告
        </van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.narration-page {
  min-height: 100vh;
  background: #f6f8fb;
}

.narration-body {
  padding-bottom: calc(104px + env(safe-area-inset-bottom));
}

.narration-card {
  overflow: hidden;
  border: 1px solid #e8eef7;
  border-radius: 8px;
  background: #fff;
  padding: 16px;
  box-shadow: 0 8px 20px rgba(24, 39, 75, 0.06);
}

.narration-card h1 {
  margin: 0 0 14px;
  color: #1a2b45;
  font-size: 17px;
  line-height: 1.35;
}

.speech-panel {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
  border: 1px solid #dce8ff;
  border-radius: 8px;
  background: #f4f8ff;
  padding: 10px;
}

.speech-panel--active {
  border-color: #3a93ff;
  background: #eef5ff;
}

.speech-button {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 0;
  border-radius: 50%;
  background: #328bf6;
  color: #fff;
  font-size: 25px;
}

.speech-button:disabled {
  opacity: 0.65;
}

.speech-panel__info {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.speech-panel__info strong {
  color: #17233c;
  font-size: 14px;
  line-height: 1.3;
}

.speech-panel__info span {
  overflow: hidden;
  color: #61738c;
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.speech-panel__meta {
  display: grid;
  justify-items: end;
  gap: 4px;
  color: #2f6df6;
  font-size: 12px;
  font-weight: 700;
}

.narration-textarea {
  border: 1px solid #eef2f7;
  border-radius: 8px;
  background: #fbfcff;
  padding: 0;
}

.narration-textarea :deep(.van-field__control) {
  min-height: 210px;
  color: #17233c;
  font-size: 14px;
  line-height: 1.7;
}

.narration-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.narration-prompts span {
  border-radius: 999px;
  background: #eef5ff;
  color: #2f6df6;
  padding: 5px 10px;
  font-size: 12px;
}

.narration-page .fixed-action {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  margin-top: 0;
  padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(232, 238, 247, 0.9);
}

@media (max-width: 360px) {
  .speech-panel {
    grid-template-columns: 44px minmax(0, 1fr);
  }

  .speech-button {
    width: 44px;
    height: 44px;
  }

  .speech-panel__meta {
    grid-column: 2;
    grid-auto-flow: column;
    justify-content: start;
  }
}
</style>
