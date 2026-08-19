<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  initPreconsultAudioChunkApi,
  mergePreconsultAudioChunksApi,
  savePreconsultFreeTextApi,
  uploadPreconsultAudioChunkApi
} from '@/api/consultation'
import AppNavBar from '@/components/AppNavBar.vue'
import { useConsultationStore } from '@/stores/consultation'
import { getAsrWebSocketUrl } from '@/utils/asr'

type VoiceStatus = 'idle' | 'initializing' | 'recording' | 'processing' | 'error'

interface AsrMessage {
  text?: string
  result?: string
  content?: string
  transcript?: string
  is_final?: boolean
  isFinal?: boolean
  final?: boolean
  type?: string
  mode?: string
  speaker?: string
}

interface UploadTaskResult {
  ok: boolean
  chunkNumber: number
  error?: unknown
}

interface UploadSession {
  uploadId: string
  fileName: string
  mimeType: string
  chunkNumber: number
  chunks: Blob[]
  tasks: Array<Promise<UploadTaskResult>>
  failedMessage: string
}

const RECORDING_TIMESLICE_MS = 2000

const router = useRouter()
const store = useConsultationStore()
store.setConsultationMode('voice')
const submitting = ref(false)
const recording = ref(false)
const processing = ref(false)
const recordedSeconds = ref(store.selfNarration?.mode === 'voice' ? store.selfNarration.recordedSeconds || 0 : 0)
const text = ref(store.selfNarration?.mode === 'voice' ? store.selfNarration.text : '')
const audioUrl = ref(store.selfNarration?.mode === 'voice' ? store.selfNarration.audioUrl || '' : '')
const audioReady = ref(Boolean(audioUrl.value))
const speechStatus = ref<VoiceStatus>('idle')
const speechError = ref('')
const stageHint = ref('点击开始后，录音会分片上传并实时转成文字。')
const interimText = ref('')
const segmentCount = ref(0)
const uploadedChunks = ref(0)
const totalChunks = ref(0)
const mediaRecorder = ref<MediaRecorder | null>(null)
const mediaStream = ref<MediaStream | null>(null)

let timer: number | undefined
let finalizeResolve: (() => void) | null = null
let uploadSession: UploadSession | null = null
let ws: WebSocket | null = null
let audioContext: AudioContext | null = null
let processor: ScriptProcessorNode | null = null

const textLength = computed(() => text.value.trim().length)
const hasRecordedAudio = computed(() => audioReady.value)
const timerText = computed(() => {
  const minute = Math.floor(recordedSeconds.value / 60)
  const second = recordedSeconds.value % 60
  return `${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`
})
const titleText = computed(() => {
  if (speechStatus.value === 'initializing') return '正在准备录音'
  if (processing.value) return '正在生成文字'
  if (recording.value) return '录音中'
  if (audioUrl.value) return '录音已完成'
  return '点击开始录音'
})
const statusText = computed(() => {
  if (speechStatus.value === 'error') return speechError.value || '语音识别暂不可用'
  if (speechStatus.value === 'initializing') return stageHint.value || '正在初始化分片上传'
  if (processing.value) return stageHint.value || '正在合并分片并识别'
  if (recording.value) return interimText.value || stageHint.value || '再次点击可结束录音'
  return stageHint.value
})
const canSubmit = computed(() => !recording.value && !processing.value && hasRecordedAudio.value)

function getMediaStream(constraints: MediaStreamConstraints) {
  if (navigator.mediaDevices?.getUserMedia) {
    return navigator.mediaDevices.getUserMedia(constraints)
  }
  return Promise.reject(new Error(window.isSecureContext ? 'UNSUPPORTED_MEDIA' : 'INSECURE_CONTEXT'))
}

function createRecorder(stream: MediaStream) {
  const preferredTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4'
  ]
  const mimeType = preferredTypes.find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type))
  return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
}

function stopStream() {
  mediaStream.value?.getTracks().forEach((track) => track.stop())
  mediaStream.value = null
}

function stopTimer() {
  if (timer) {
    window.clearInterval(timer)
    timer = undefined
  }
}

function cleanupRealtimeAsr() {
  if (processor) {
    processor.disconnect()
    processor = null
  }
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
  ws = null
  interimText.value = ''
}

function stopRealtimeAsr(sendFlush = true) {
  if (sendFlush && ws?.readyState === WebSocket.OPEN) {
    ws.send('flush')
  }
  if (ws && ws.readyState <= WebSocket.OPEN) {
    window.setTimeout(() => {
      ws?.close()
      cleanupRealtimeAsr()
    }, 400)
    return
  }
  cleanupRealtimeAsr()
}

function revokeAudioUrl() {
  if (!audioUrl.value) return
  try {
    URL.revokeObjectURL(audioUrl.value)
  } catch {
    // ignore invalid or already revoked object urls
  }
  audioUrl.value = ''
}

function resetState() {
  stopTimer()
  stopRealtimeAsr(false)
  recording.value = false
  processing.value = false
  speechStatus.value = 'idle'
  speechError.value = ''
  stageHint.value = '点击开始后，录音会分片上传并实时转成文字。'
  interimText.value = ''
  segmentCount.value = 0
  uploadedChunks.value = 0
  totalChunks.value = 0
  audioReady.value = Boolean(audioUrl.value)
  uploadSession = null
}

function extractTranscriptText(response: unknown): string {
  if (typeof response === 'string') return response.trim()
  if (!response || typeof response !== 'object') return ''

  const source = response as Record<string, any>
  const candidates = [
    source.freeText,
    source.text,
    source.asrText,
    source.transcript,
    source.transcription,
    source.content,
    source.result,
    source.asrResult,
    source.ocrText,
    source.data,
    source.data?.freeText,
    source.data?.text,
    source.data?.asrText,
    source.data?.transcript,
    source.data?.transcription,
    source.data?.content,
    source.data?.result,
    source.data?.asrResult,
    source.data?.ocrText
  ]

  for (const item of candidates) {
    if (typeof item === 'string' && item.trim()) return item.trim()
  }

  return ''
}

function appendRecognizedText(value: string) {
  const cleanText = value.trim()
  if (!cleanText) return
  const current = text.value.trim()
  if (!current) {
    text.value = cleanText
    return
  }
  text.value = `${current}${/[。！？!?；;，,]$/.test(current) ? '' : '，'}${cleanText}`
}

function getAsrMessageText(data: AsrMessage) {
  return String(data.text || data.result || data.content || data.transcript || '').trim()
}

function isFinalAsrMessage(data: AsrMessage) {
  const type = String(data.type || '').toLowerCase()
  if (data.is_final !== undefined) return data.is_final !== false
  if (data.isFinal !== undefined) return data.isFinal !== false
  if (data.final !== undefined) return data.final !== false
  if (type) return type === 'final' || type === 'sentence' || type === 'completed'
  return true
}

function handleAsrMessage(data: AsrMessage) {
  const recognizedText = getAsrMessageText(data)
  const isFinal = isFinalAsrMessage(data)
  if (!recognizedText) {
    if (isFinal) interimText.value = ''
    return
  }

  if (!isFinal) {
    interimText.value = recognizedText
    return
  }

  segmentCount.value += 1
  interimText.value = ''
  appendRecognizedText(recognizedText)
}
function startRealtimeAsr(stream: MediaStream) {
  try {
    ws = new WebSocket(getAsrWebSocketUrl())
    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      const AudioContextConstructor = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextConstructor) {
        stopRealtimeAsr(false)
        return
      }

      audioContext = new AudioContextConstructor({ sampleRate: 16000 })
      const source = audioContext.createMediaStreamSource(stream)
      processor = audioContext.createScriptProcessor(4096, 1, 1)
      const silentOutput = audioContext.createGain()
      silentOutput.gain.value = 0
      source.connect(processor)
      processor.connect(silentOutput)
      silentOutput.connect(audioContext.destination)

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
    }

    ws.onmessage = (event) => {
      try {
        handleAsrMessage(JSON.parse(String(event.data)))
      } catch {
        const recognizedText = String(event.data || '').trim()
        if (recognizedText) appendRecognizedText(recognizedText)
      }
    }

    ws.onerror = () => {
      stageHint.value = '实时识别连接失败，可继续录音'
      stopRealtimeAsr(false)
    }

    ws.onclose = () => {
      cleanupRealtimeAsr()
    }
  } catch {
    stageHint.value = '实时识别连接失败，可继续录音'
    cleanupRealtimeAsr()
  }
}

function createIdentifier() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `voice-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getAudioFileName(mimeType = '') {
  const extension = mimeType.includes('mp4') ? 'm4a' : 'webm'
  return `voice-${Date.now()}.${extension}`
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function ensureRecordId() {
  if (!store.recordId) {
    await store.loadQuestions()
  }
  if (!store.recordId) {
    throw new Error('问诊记录尚未创建，请稍后重试')
  }
}

function buildPreviewAudio(session: UploadSession) {
  if (!session.chunks.length) return
  revokeAudioUrl()
  const audioBlob = new Blob(session.chunks, { type: session.mimeType || 'audio/webm' })
  audioUrl.value = URL.createObjectURL(audioBlob)
}

function markUploadFailed(session: UploadSession, error: unknown) {
  if (session.failedMessage) return
  session.failedMessage = getErrorMessage(error, '录音分片上传失败，请重新录音')
  speechStatus.value = 'error'
  speechError.value = session.failedMessage
  stageHint.value = session.failedMessage
  showToast(session.failedMessage)

  if (mediaRecorder.value && mediaRecorder.value.state === 'recording') {
    mediaRecorder.value.stop()
  }
}

function queueChunkUpload(blob: Blob) {
  if (!blob.size || !uploadSession || !store.recordId) return

  const session = uploadSession
  const recordId = store.recordId
  const chunkNumber = session.chunkNumber + 1
  session.chunkNumber = chunkNumber
  session.chunks.push(blob)
  uploadedChunks.value = chunkNumber
  totalChunks.value = chunkNumber
  stageHint.value = `正在上传分片 ${chunkNumber}`

  const task = uploadPreconsultAudioChunkApi(
    recordId,
    {
      uploadId: session.uploadId,
      chunkNumber
    },
    blob
  )
    .then(() => ({ ok: true, chunkNumber }))
    .catch((error) => {
      markUploadFailed(session, error)
      return { ok: false, chunkNumber, error }
    })

  session.tasks.push(task)
}

async function finishAndTranscribe(session: UploadSession) {
  if (!store.recordId) {
    throw new Error('问诊记录尚未创建，请稍后重试')
  }

  const chunkCount = session.chunkNumber
  totalChunks.value = chunkCount
  if (!chunkCount) {
    throw new Error('未采集到有效录音，请重新录音')
  }

  buildPreviewAudio(session)
  stageHint.value = `正在等待分片上传完成 ${chunkCount}/${chunkCount}`
  const uploadResults = await Promise.all(session.tasks)
  const failed = uploadResults.find((item) => !item.ok)
  if (failed || session.failedMessage) {
    throw new Error(session.failedMessage || `第 ${failed?.chunkNumber || ''} 个分片上传失败，请重新录音`)
  }

  stageHint.value = '正在合并分片并识别文字'
  const mergeRes = await mergePreconsultAudioChunksApi(store.recordId, {
    uploadId: session.uploadId,
    fileName: session.fileName,
    totalChunks: chunkCount
  })
  const finalText = extractTranscriptText(mergeRes)
  if (finalText) {
    text.value = finalText
  }
  audioReady.value = true

  store.saveSelfNarration({
    mode: 'voice',
    text: text.value.trim(),
    audioUrl: audioUrl.value,
    recordedSeconds: recordedSeconds.value
  })
  stageHint.value = finalText || text.value.trim()
    ? '识别完成，可直接修改后提交'
    : '识别完成，也可以直接生成报告'
  speechStatus.value = 'idle'
}

async function startRecord() {
  if (recording.value || processing.value || speechStatus.value === 'initializing') return
  if (!window.isSecureContext) {
    speechStatus.value = 'error'
    speechError.value = '麦克风需要 HTTPS 或 localhost 环境'
    stageHint.value = speechError.value
    showToast(speechError.value)
    return
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    speechStatus.value = 'error'
    speechError.value = '当前浏览器不支持录音'
    stageHint.value = speechError.value
    showToast(speechError.value)
    return
  }

  try {
    await ensureRecordId()
    revokeAudioUrl()
    text.value = ''
    audioReady.value = false
    interimText.value = ''
    segmentCount.value = 0
    recordedSeconds.value = 0
    uploadedChunks.value = 0
    totalChunks.value = 0
    speechError.value = ''
    speechStatus.value = 'initializing'
    stageHint.value = '正在准备麦克风'

    mediaStream.value = await getMediaStream({
      audio: {
        channelCount: 1,
        sampleRate: 16000
      }
    })
    const recorder = createRecorder(mediaStream.value)
    mediaRecorder.value = recorder

    const fileName = getAudioFileName(recorder.mimeType)
    const identifier = createIdentifier()
    stageHint.value = '正在初始化分片上传'
    const uploadId = await initPreconsultAudioChunkApi(store.recordId, {
      fileName,
      fileSize: 0,
      totalChunks: 0,
      identifier
    })
    if (!uploadId) {
      throw new Error('录音上传初始化失败，请稍后重试')
    }

    uploadSession = {
      uploadId,
      fileName,
      mimeType: recorder.mimeType || 'audio/webm',
      chunkNumber: 0,
      chunks: [],
      tasks: [],
      failedMessage: ''
    }

    recorder.ondataavailable = (event) => {
      if (event.data?.size) {
        queueChunkUpload(event.data)
      }
    }
    recorder.onstop = async () => {
      stopTimer()
      stopRealtimeAsr()
      stopStream()
      recording.value = false
      processing.value = true
      speechStatus.value = 'processing'

      const session = uploadSession
      try {
        if (!session) {
          throw new Error('录音上传任务不存在，请重新录音')
        }
        await finishAndTranscribe(session)
      } catch (error) {
        const message = getErrorMessage(error, '语音识别失败，请稍后重试')
        speechStatus.value = 'error'
        speechError.value = message
        stageHint.value = message
        showToast(message)
      } finally {
        processing.value = false
        mediaRecorder.value = null
        uploadSession = null
        finalizeResolve?.()
        finalizeResolve = null
      }
    }

    startRealtimeAsr(mediaStream.value)
    recorder.start(RECORDING_TIMESLICE_MS)
    recording.value = true
    processing.value = false
    speechStatus.value = 'recording'
    stageHint.value = '正在录音并识别文字，系统会自动分片上传'
    timer = window.setInterval(() => {
      recordedSeconds.value += 1
    }, 1000)
  } catch (error) {
    const message = error instanceof Error && error.message === 'UNSUPPORTED_MEDIA'
      ? '当前浏览器不支持麦克风录音'
      : getErrorMessage(error, '无法获取麦克风权限')
    speechStatus.value = 'error'
    speechError.value = message
    stageHint.value = message
    showToast(message)
    stopRealtimeAsr(false)
    stopStream()
    stopTimer()
    recording.value = false
    processing.value = false
    mediaRecorder.value = null
    uploadSession = null
  }
}

function stopRecord() {
  if (!recording.value) return Promise.resolve()
  if (!mediaRecorder.value || mediaRecorder.value.state === 'inactive') {
    recording.value = false
    return Promise.resolve()
  }

  const stopPromise = new Promise<void>((resolve) => {
    finalizeResolve = resolve
  })
  stageHint.value = '正在结束录音并整理分片'
  recording.value = false
  processing.value = true
  speechStatus.value = 'processing'
  mediaRecorder.value.stop()
  return stopPromise
}

async function toggleRecord() {
  if (processing.value || speechStatus.value === 'initializing') return
  if (recording.value) {
    await stopRecord()
    return
  }
  await startRecord()
}

async function resetRecord() {
  if (recording.value) {
    await stopRecord()
  }
  recordedSeconds.value = 0
  text.value = ''
  audioReady.value = false
  revokeAudioUrl()
  resetState()
}

async function next() {
  if (submitting.value) return
  if (recording.value) {
    await stopRecord()
  }
  if (processing.value) {
    showToast('录音处理中，请稍后提交')
    return
  }
  if (!hasRecordedAudio.value) {
    showToast('请先完成录音')
    return
  }

  const content = text.value.trim()
  submitting.value = true
  try {
    store.saveSelfNarration({
      mode: 'voice',
      text: content,
      audioUrl: audioUrl.value,
      recordedSeconds: recordedSeconds.value
    })
    await ensureRecordId()
    await savePreconsultFreeTextApi(store.recordId, { freeText: content })
    const reportReady = await store.buildReport()
    if (!reportReady) return
    router.push('/report')
  } catch (error) {
    showToast(getErrorMessage(error, '进入报告失败，请稍后重试'))
  } finally {
    submitting.value = false
  }
}

onBeforeUnmount(() => {
  if (recording.value) {
    void stopRecord()
    return
  }
  stopRealtimeAsr(false)
  stopStream()
  stopTimer()
})
</script>

<template>
  <div class="page voice-page">
    <AppNavBar title="语音自诉" back />

    <main class="page-body voice-body">
      <section class="voice-card">
        <h1>请用自己的话描述病情</h1>
        <div class="record-stage" :class="{ 'record-stage--active': recording || processing }">
          <button
            type="button"
            class="record-button"
            :disabled="processing || speechStatus === 'initializing'"
            @click="toggleRecord"
          >
            <van-icon :name="recording ? 'pause-circle-o' : 'volume-o'" />
          </button>
          <div class="record-stage__info">
            <strong>{{ titleText }}</strong>
            <span>{{ statusText }}</span>
          </div>
          <small>
            {{ timerText }}
            <template v-if="totalChunks"> · {{ totalChunks }} 片</template>
            <template v-if="segmentCount"> · {{ segmentCount }} 句</template>
          </small>
        </div>

        <div v-if="audioUrl" class="audio-preview">
          <div class="audio-preview__title">
            <van-icon name="music-o" />
            <span>录音预览</span>
          </div>
          <audio :src="audioUrl" controls />
        </div>

        <van-field
          v-model="text"
          class="voice-textarea"
          type="textarea"
          rows="8"
          maxlength="1000"
          show-word-limit
          placeholder="例如：哪里不舒服、持续多久、疼痛程度、是否发热、用过什么药、以前有没有类似情况。"
        />

        <div class="voice-prompts">
          <span>主要不适</span>
          <span>持续时间</span>
          <span>伴随症状</span>
          <span>用药情况</span>
        </div>

        <div class="voice-actions">
          <van-button size="small" plain type="primary" :disabled="recording || processing" @click="resetRecord">
            重新录音
          </van-button>
        </div>
      </section>
    </main>

    <div class="fixed-action voice-fixed-action">
      <div class="fixed-action__inner">
        <van-button type="primary" block :loading="submitting" :disabled="submitting || !canSubmit" @click="next">
          确认并生成报告
        </van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.voice-page {
  min-height: 100vh;
  background: #f6f8fb;
}

.voice-body {
  padding-bottom: calc(104px + env(safe-area-inset-bottom));
}

.voice-card {
  overflow: hidden;
  border: 1px solid #e8eef7;
  border-radius: 8px;
  background: #fff;
  padding: 16px;
  box-shadow: 0 8px 20px rgba(24, 39, 75, 0.06);
}

.voice-card h1 {
  margin: 0 0 16px;
  color: #1a2b45;
  font-size: 17px;
  line-height: 1.35;
}

.record-stage {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  border: 1px solid #e8eef7;
  border-radius: 8px;
  background: #f7faff;
  padding: 14px 12px;
}

.record-stage--active {
  border-color: #3a93ff;
  background: #eef5ff;
}

.record-button {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border: 0;
  border-radius: 50%;
  background: #328bf6;
  color: #fff;
  font-size: 30px;
}

.record-button:disabled {
  opacity: 0.7;
}

.record-stage__info {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.record-stage strong {
  color: #15243b;
  font-size: 16px;
}

.record-stage span {
  overflow: hidden;
  color: #6b7d94;
  font-size: 13px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-stage small {
  color: #2f6df6;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.audio-preview {
  display: grid;
  gap: 8px;
  margin-top: 12px;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  background: #fbfcff;
  padding: 10px;
}

.audio-preview__title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #17233c;
  font-size: 13px;
  font-weight: 700;
}

.audio-preview audio {
  display: block;
  width: 100%;
  height: 38px;
}

.voice-textarea {
  margin-top: 12px;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  background: #fbfcff;
  padding: 0;
}

.voice-textarea :deep(.van-field__control) {
  min-height: 190px;
  color: #17233c;
  font-size: 14px;
  line-height: 1.7;
}

.voice-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.voice-prompts span {
  border-radius: 999px;
  background: #eef5ff;
  color: #2f6df6;
  padding: 5px 10px;
  font-size: 12px;
}

.voice-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.voice-fixed-action {
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
  .record-stage {
    grid-template-columns: 50px minmax(0, 1fr);
  }

  .record-button {
    width: 50px;
    height: 50px;
  }

  .record-stage small {
    grid-column: 2;
  }
}
</style>

