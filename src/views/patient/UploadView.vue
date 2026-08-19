<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showImagePreview } from 'vant'
import { uploadPreconsultOcrApi } from '@/api/consultation'
import AppNavBar from '@/components/AppNavBar.vue'
import { useConsultationStore } from '@/stores/consultation'
import type { UploadMaterial, UploadOcrStatus } from '@/types/consultation'

interface VantFile {
  file?: File
  content?: string
  url?: string
  message?: string
}

const router = useRouter()
const store = useConsultationStore()
const fileList = ref<VantFile[]>([])
const submitting = ref(false)
const expandedOcrIds = ref<Record<string, boolean>>({})

interface OcrDisplayRow {
  seq: string
  code: string
  name: string
  result: string
  unit: string
  reference: string
  abnormal: boolean
}

const bloodRoutineCodeSeq: Record<string, string> = {
  WBC: '1',
  RBC: '2',
  HGB: '3',
  HCT: '4',
  MCV: '5',
  MCH: '6',
  MCHC: '7',
  PLT: '8',
  LYMPHP: '9',
  NEUTP: '10',
  MONOP: '11',
  EOP: '12',
  E0P: '12',
  BASOP: '13',
  LYMPHN: '14',
  NEUT: '15',
  MONON: '16',
  EON: '17',
  BASON: '18',
  'RDW-CV': '19',
  'RDW-SD': '20',
  PDW: '21',
  MPV: '22',
  PCT: '23',
  'P-LCR': '24',
  ESR: '25'
}

const question = computed(() => store.currentQuestion)
const hasMaterials = computed(() => store.materials.length > 0)
const uploadedMaterials = computed(() =>
  store.materials.filter((material) => material.status === 'uploaded')
)
const ocrRecognizingCount = computed(() =>
  store.materials.filter((material) => material.ocrStatus === 'recognizing').length
)
const ocrSuccessCount = computed(() =>
  store.materials.filter((material) => material.ocrStatus === 'success').length
)
const ocrFailedCount = computed(() =>
  store.materials.filter((material) => material.ocrStatus === 'failed').length
)
const actionText = computed(() => {
  if (!hasMaterials.value) return '暂不上传'
  if (!uploadedMaterials.value.length) return '跳过失败项并继续'
  if (ocrRecognizingCount.value) return '识别中，可稍后提交'
  if (ocrFailedCount.value) return '跳过失败项并继续'
  return '确认资料并继续'
})
const maxFiles = computed(() => question.value?.maxFiles || 9)
const maxFileSizeBytes = computed(() => question.value?.maxFileSizeBytes || 10 * 1024 * 1024)
const accept = computed(() => question.value?.acceptedMimeTypes?.join(',') || 'image/*,.pdf')

onMounted(() => {
  if (question.value?.type !== 'upload') {
    router.replace('/consultation')
    return
  }

  // 恢复已有的上传列表到 van-uploader 缩略图视图
  fileList.value = store.materials.map((m) => ({
    url: m.url || '',
    name: m.name,
    isImage: m.type === 'image'
  }))
})

function onUploaderDelete(_file: VantFile, detail: { index: number }) {
  if (detail && typeof detail.index === 'number' && store.materials[detail.index]) {
    const target = store.materials[detail.index]
    store.removeMaterial(target.id)
    showToast(`已移除 ${target.name}`)
  }
}

function deleteMaterial(id: string) {
  const index = store.materials.findIndex((m) => m.id === id)
  if (index >= 0) {
    const target = store.materials[index]
    store.removeMaterial(id)
    fileList.value = fileList.value.filter((_, i) => i !== index)
    showToast(`已删除 ${target.name}`)
  }
}

function previewMaterial(item: UploadMaterial) {
  if (item.type === 'image' && item.url) {
    showImagePreview({
      images: [item.url],
      closeable: true,
      closeOnClickOverlay: true,
      closeOnClickImage: true
    })
  } else if (item.name) {
    showToast(`文件：${item.name}`)
  }
}

function normalizeOcrStatus(value: unknown, fallback: UploadOcrStatus): UploadOcrStatus {
  const status = String(value || '').toUpperCase()
  if (status === 'SUCCESS' || status === 'DONE' || status === 'FINISHED') return 'success'
  if (status === 'FAILED' || status === 'ERROR') return 'failed'
  if (status === 'RECOGNIZING' || status === 'PROCESSING' || status === 'RUNNING') return 'recognizing'
  if (status === 'PENDING' || status === 'WAITING') return 'pending'
  return fallback
}

function getOcrTextFromResponse(response: Record<string, any>) {
  return String(
    response?.ocrText ||
    response?.text ||
    response?.ocrResult?.text ||
    response?.data?.ocrText ||
    response?.data?.text ||
    response?.data?.ocrResult?.text ||
    ''
  )
}

function getOcrSummaryFromResponse(response: Record<string, any>) {
  return String(
    response?.ocrSummary ||
    response?.ocrResult?.summary ||
    response?.data?.ocrSummary ||
    response?.data?.ocrResult?.summary ||
    ''
  )
}

function getOcrErrorFromResponse(response: Record<string, any>) {
  return String(
    response?.ocrError ||
    response?.ocrResult?.error ||
    response?.data?.ocrError ||
    response?.data?.ocrResult?.error ||
    ''
  )
}

function getOcrStatusFromResponse(response: Record<string, any>, hasOcrText: boolean): UploadOcrStatus {
  const rawStatus =
    response?.ocrStatus ||
    response?.status ||
    response?.ocrResult?.status ||
    response?.data?.ocrStatus ||
    response?.data?.status ||
    response?.data?.ocrResult?.status
  if (hasOcrText) return normalizeOcrStatus(rawStatus, 'success')
  return normalizeOcrStatus(rawStatus, 'pending')
}

function getOcrIdFromResponse(response: Record<string, any>) {
  return String(
    response?.id ||
    response?.ocrId ||
    response?.ocrResultId ||
    response?.data?.id ||
    response?.data?.ocrId ||
    response?.data?.ocrResultId ||
    ''
  )
}

function getFileNameFromResponse(response: Record<string, any>, fallback: string) {
  return String(
    response?.fileName ||
    response?.data?.fileName ||
    fallback
  )
}

function getFileUrlFromResponse(response: Record<string, any>) {
  return String(
    response?.fileUrl ||
    response?.url ||
    response?.data?.fileUrl ||
    response?.data?.url ||
    ''
  )
}

function normalizeOcrLines(text?: string) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function isReportHeader(line: string) {
  return /^(序号|代码|项目名称|项目|结果|单位|参考值)$/.test(line)
}

function isLikelyCode(line: string) {
  return /^[A-Z][A-Z0-9-]{1,}$/.test(line) || /^[A-Z]-[A-Z]+$/.test(line)
}

function isLikelyResult(line: string) {
  return /^[↑↓+\-]?\d+(?:\.\d+)?$/.test(line)
}

function isLikelyUnit(line: string) {
  return /^(%|fL|pg|g\/L|mg\/L|mmol\/L|umol\/L|10\^?\d+\/L|10\d+\/L)$/i.test(line)
}

function isLikelyReference(line: string) {
  return /^[男女]?[：:]?\s*[↑↓]?\d+(?:\.\d+)?\s*[-—~－]+\s*\d+(?:\.\d+)?$/.test(line)
    || /^[↑↓]?\d+(?:\.\d+)?\s*[-—~－]+\s*\d+(?:\.\d+)?$/.test(line)
}

function splitSequenceAndCode(line: string) {
  const matched = line.match(/^(\d{1,2})\s*([A-Za-z][A-Za-z0-9-]*)?$/)
  if (!matched) return null
  return {
    seq: matched[1],
    code: matched[2] || ''
  }
}

function getRowStart(lines: string[], index: number, inferredSeq: number) {
  const current = lines[index]
  const sequenceStart = splitSequenceAndCode(current)
  if (sequenceStart) return sequenceStart

  const previous = lines[index - 1] || ''
  const next = lines[index + 1] || ''
  if (
    isLikelyCode(current) &&
    !splitSequenceAndCode(previous) &&
    /[\u4e00-\u9fa5]/.test(next || '')
  ) {
    return {
      seq: bloodRoutineCodeSeq[current.toUpperCase()] || String(inferredSeq),
      code: current
    }
  }

  return null
}

function splitNameAndInlineResult(line: string) {
  const matched = line.match(/^(.+?)([↑↓]?\d+(?:\.\d+)?)$/)
  if (!matched || !/[\u4e00-\u9fa5]/.test(matched[1])) {
    return { name: line, result: '' }
  }
  return {
    name: matched[1].trim(),
    result: matched[2]
  }
}

function getOcrDisplay(text?: string) {
  const lines = normalizeOcrLines(text)
  const title = lines.find((line) => /报告单|报告$/.test(line)) || ''
  const metaKeys = ['姓名', '性别', '年龄', '标本编号', '标本种类', '申请科室', '送检医师', '条码编号', '临床诊断', '核收时间', '报告时间']
  const meta: Array<{ label: string; value: string }> = []

  lines.forEach((line, index) => {
    const inline = line.match(/^(.{2,8}?)[：:]\s*(.+)$/)
    if (inline && metaKeys.includes(inline[1].trim()) && inline[2].trim()) {
      meta.push({ label: inline[1].trim(), value: inline[2].trim() })
      return
    }

    const splitLabel = line.match(/^(.{2,8}?)[：:]$/)
    const next = lines[index + 1] || ''
    if (
      splitLabel &&
      metaKeys.includes(splitLabel[1].trim()) &&
      next &&
      !isReportHeader(next) &&
      !splitSequenceAndCode(next)
    ) {
      meta.push({ label: splitLabel[1].trim(), value: next })
    }
  })

  const rows: OcrDisplayRow[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i]
    const start = getRowStart(lines, i, rows.length + 1)
    if (!start) continue

    let cursor = i + 1
    let code = start.code
    if (!code && isLikelyCode(lines[cursor] || '')) {
      code = lines[cursor]
      cursor += 1
    }
    if (!code) continue

    const nameLine = lines[cursor] || ''
    if (!nameLine || isReportHeader(nameLine) || splitSequenceAndCode(nameLine)) continue

    const nameInfo = splitNameAndInlineResult(nameLine)
    let name = nameInfo.name
    let result = nameInfo.result
    cursor += 1

    if (!result && isLikelyResult(lines[cursor] || '')) {
      result = lines[cursor]
      cursor += 1
    }
    if (!result) continue

    let unit = ''
    let reference = ''
    const maybeUnit = lines[cursor] || ''
    if (isLikelyUnit(maybeUnit)) {
      unit = maybeUnit
      cursor += 1
    }

    const maybeReference = lines[cursor] || ''
    if (isLikelyReference(maybeReference)) {
      reference = maybeReference
    }

    rows.push({
      seq: start.seq,
      code,
      name,
      result,
      unit,
      reference,
      abnormal: result.includes('↑') || result.includes('↓') || reference.includes('↑') || reference.includes('↓')
    })
  }

  const uniqRows = Array.from(
    new Map(rows.map((row) => [`${row.seq}-${row.code}-${row.name}`, row])).values()
  ).sort((a, b) => Number(a.seq) - Number(b.seq))

  const usedMeta = new Set(meta.map((item) => `${item.label}:${item.value}`))
  const uniqMeta = meta.filter((item) => {
    const key = `${item.label}:${item.value}`
    if (!usedMeta.has(key)) return false
    usedMeta.delete(key)
    return true
  })

  return {
    title,
    meta: uniqMeta.slice(0, 8),
    rows: uniqRows,
    lines: lines.filter((line) => !isReportHeader(line)).slice(0, 80)
  }
}

function isOcrExpanded(id: string) {
  return Boolean(expandedOcrIds.value[id])
}

function toggleOcrExpanded(id: string) {
  expandedOcrIds.value = {
    ...expandedOcrIds.value,
    [id]: !expandedOcrIds.value[id]
  }
}

function ocrStatusText(item: UploadMaterial) {
  if (item.status !== 'uploaded') return '上传失败'
  if (item.ocrStatus === 'recognizing') return 'OCR识别中'
  if (item.ocrStatus === 'success') return 'OCR识别完成'
  if (item.ocrStatus === 'failed') return 'OCR识别失败'
  if (item.ocrStatus === 'pending') return '待接入识别服务'
  return '待识别'
}

function ocrTagType(item: UploadMaterial): 'primary' | 'success' | 'warning' | 'danger' {
  if (item.status !== 'uploaded' || item.ocrStatus === 'failed') return 'danger'
  if (item.ocrStatus === 'success') return 'success'
  if (item.ocrStatus === 'recognizing') return 'primary'
  return 'warning'
}

async function afterRead(item: VantFile | VantFile[]) {
  const files = Array.isArray(item) ? item : [item]
  const currentQuestion = question.value

  if (!store.recordId || !currentQuestion || currentQuestion.type !== 'upload') {
    showToast('问诊记录尚未就绪，暂时无法上传')
    return
  }

  for (const fileItem of files) {
    const file = fileItem.file
    if (!file) continue

    if (store.materials.length >= maxFiles.value) {
      showToast(`最多上传 ${maxFiles.value} 份资料`)
      break
    }
    if (file.size > maxFileSizeBytes.value) {
      showToast(`单个文件不能超过 ${Math.ceil(maxFileSizeBytes.value / 1024 / 1024)}MB`)
      continue
    }

    const localId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
    let attachmentId = localId
    let uploadStatus: 'local' | 'uploaded' = 'local'
    let ocrStatus: UploadOcrStatus = 'idle'
    let ocrText = ''
    let ocrSummary = ''
    let ocrError = ''
    let response: Record<string, any> = {}

    try {
      response = await uploadPreconsultOcrApi(store.recordId, currentQuestion.id, file)
      const backendId = getOcrIdFromResponse(response)
      if (!backendId) {
        throw new Error('OCR接口未返回结果ID')
      }
      attachmentId = backendId
      uploadStatus = 'uploaded'
      ocrText = getOcrTextFromResponse(response)
      ocrSummary = getOcrSummaryFromResponse(response)
      ocrError = getOcrErrorFromResponse(response)
      ocrStatus = getOcrStatusFromResponse(response, Boolean(ocrText || ocrSummary))
    } catch (error) {
      console.warn('上传附件到后端接口失败:', error)
      showToast(`${file.name} 上传失败，请重试`)
      ocrStatus = 'failed'
      ocrError = '资料上传失败，无法识别'
    }

    store.addMaterial({
      id: attachmentId,
      name: uploadStatus === 'uploaded' ? getFileNameFromResponse(response || {}, file.name) : file.name,
      type: file.type.startsWith('image/') ? 'image' : 'file',
      url: uploadStatus === 'uploaded'
        ? (getFileUrlFromResponse(response || {}) || fileItem.content || fileItem.url || '')
        : (fileItem.content || fileItem.url || ''),
      status: uploadStatus,
      ocrStatus,
      ocrText,
      ocrSummary,
      ocrError
    })
  }
}

async function finishUpload() {
  if (submitting.value) return
  submitting.value = true
  try {
    const attachmentIds = uploadedMaterials.value.map((material) => material.id)
    if (!attachmentIds.length && hasMaterials.value) {
      showToast('没有上传成功的资料，本题将按未上传处理')
    }

    await store.answerCurrent(attachmentIds.length ? attachmentIds : null)
    if (!store.currentQuestion) {
      const reportReady = await store.buildReport()
      if (!reportReady) return
      await router.replace('/report')
      return
    }
    await router.replace('/consultation')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page">
    <AppNavBar title="上传资料" back />
    <main class="page-body upload-page-body">
      <section class="surface upload-panel">
        <p class="upload-panel__tip">
          可上传检查报告、检验单、处方或患处照片。上传后系统会自动识别文字，您可确认后提交。
        </p>
        <p class="upload-panel__subtip">支持图片/PDF，识别结果仅作预问诊参考。</p>
        <van-uploader
          v-model="fileList"
          multiple
          :max-count="maxFiles"
          :after-read="afterRead"
          @delete="onUploaderDelete"
          :accept="accept"
        />
      </section>

      <div class="section-header">
        <p class="section-title">已选择资料（{{ store.materials.length }} 份）</p>
        <span v-if="hasMaterials" class="ocr-count">已识别 {{ ocrSuccessCount }} 份</span>
      </div>
      <van-empty v-if="!hasMaterials" description="暂无资料，可直接跳过" />
      <div v-else class="materials-list">
        <article
          v-for="item in store.materials"
          :key="item.id"
          class="material-card"
        >
          <div class="material-card__head">
            <button type="button" class="material-thumb" @click="previewMaterial(item)">
              <img v-if="item.type === 'image' && item.url" :src="item.url" alt="资料预览" />
              <van-icon v-else name="description" />
            </button>
            <div class="material-card__meta">
              <strong>{{ item.name }}</strong>
              <span>{{ item.status === 'uploaded' ? '上传成功' : '上传失败，未提交' }} · {{ ocrStatusText(item) }}</span>
              <div class="material-card__tags">
                <van-tag :type="item.status === 'uploaded' ? 'success' : 'danger'">
                  {{ item.type === 'image' ? '图片' : '文件' }}
                </van-tag>
                <van-tag :type="ocrTagType(item)">{{ ocrStatusText(item) }}</van-tag>
              </div>
            </div>
            <van-button
              class="material-delete-button"
              size="small"
              type="danger"
              plain
              @click="deleteMaterial(item.id)"
            >
              删除
            </van-button>
          </div>

          <section class="ocr-panel">
            <div class="ocr-panel__head">
              <div>
                <strong>识别结果</strong>
                <span v-if="item.ocrSummary">{{ item.ocrSummary }}</span>
              </div>
              <van-button
                v-if="item.ocrText"
                size="mini"
                plain
                type="primary"
                @click="toggleOcrExpanded(item.id)"
              >
                {{ isOcrExpanded(item.id) ? '收起' : '查看' }}
              </van-button>
            </div>
            <template
              v-if="item.ocrText && isOcrExpanded(item.id)"
              v-for="display in [getOcrDisplay(item.ocrText)]"
              :key="`${item.id}-ocr-display`"
            >
              <div class="ocr-display">
                <h3 v-if="display.title">{{ display.title }}</h3>

                <div v-if="display.meta.length" class="ocr-meta-grid">
                  <div
                    v-for="meta in display.meta"
                    :key="`${meta.label}-${meta.value}`"
                    class="ocr-meta-item"
                  >
                    <span>{{ meta.label }}</span>
                    <strong>{{ meta.value }}</strong>
                  </div>
                </div>

                <div v-if="display.rows.length" class="ocr-result-list">
                  <div class="ocr-result-list__header">
                    <span>项目</span>
                    <span>结果</span>
                    <span>参考值</span>
                  </div>
                  <div
                    v-for="row in display.rows"
                    :key="`${row.seq}-${row.code}-${row.name}`"
                    class="ocr-result-row"
                    :class="{ 'ocr-result-row--abnormal': row.abnormal }"
                  >
                    <div class="ocr-result-row__name">
                      <strong>{{ row.name }}</strong>
                      <span>{{ row.seq }} {{ row.code }}</span>
                    </div>
                    <div class="ocr-result-row__value">
                      <strong>{{ row.result }}</strong>
                      <span v-if="row.unit">{{ row.unit }}</span>
                    </div>
                    <div class="ocr-result-row__reference">
                      {{ row.reference || '-' }}
                    </div>
                  </div>
                </div>

                <div v-else class="ocr-lines">
                  <p
                    v-for="(line, index) in display.lines"
                    :key="`${index}-${line}`"
                  >
                    {{ line }}
                  </p>
                </div>
              </div>
            </template>
            <p v-else-if="!item.ocrText" class="ocr-empty">暂未识别到文字</p>
            <p v-if="item.ocrError" class="ocr-error">{{ item.ocrError }}</p>
          </section>
        </article>
      </div>

      <section v-if="hasMaterials" class="ocr-summary">
        <div class="ocr-summary__head">
          <h2>识别结果汇总</h2>
          <span>{{ ocrSuccessCount }} / {{ store.materials.length }}</span>
        </div>
        <p v-if="ocrRecognizingCount">还有 {{ ocrRecognizingCount }} 份资料正在识别，您也可以稍后提交。</p>
        <p v-else-if="ocrFailedCount">有 {{ ocrFailedCount }} 份资料识别失败，医生仍可查看原件。</p>
        <!-- <p v-else>请确认识别内容是否准确，可直接编辑后继续。</p> -->
      </section>
    </main>

    <div class="fixed-action upload-fixed-action">
      <div class="fixed-action__inner">
        <van-button type="primary" block :loading="submitting" @click="finishUpload">
          {{ actionText }}
        </van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.upload-panel {
  padding: 14px;
}

.upload-page-body {
  padding-bottom: calc(104px + env(safe-area-inset-bottom));
}

.upload-panel__tip {
  margin: 0 0 12px;
  color: var(--theme-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.upload-panel__subtip {
  margin: -4px 0 12px;
  color: #8b9bb0;
  font-size: 12px;
  line-height: 1.5;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 16px 0 8px;
}

.section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--theme-text-secondary);
}

.ocr-count {
  color: #6f8098;
  font-size: 12px;
}

.materials-list {
  display: grid;
  gap: 10px;
}

.material-card {
  border: 1px solid #e8eef7;
  border-radius: 8px;
  background: #fff;
  padding: 12px;
  box-shadow: 0 8px 20px rgba(24, 39, 75, 0.06);
}

.material-card__head {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
}

.material-thumb {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  overflow: hidden;
  border: 0;
  border-radius: 8px;
  background: #f1f5fb;
  color: #91a0b5;
  font-size: 24px;
}

.material-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.material-card__meta {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.material-card__meta strong {
  overflow: hidden;
  color: #1a2b45;
  font-size: 14px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-card__meta span {
  color: #7b8ca5;
  font-size: 12px;
  line-height: 1.35;
}

.material-card__tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.material-delete-button {
  align-self: start;
  margin-top: 16px;
  padding: 0 10px;
}

.ocr-panel {
  margin-top: 12px;
  border: 1px solid #eef2f7;
  border-radius: 8px;
  background: #fbfcff;
  padding: 10px;
}

.ocr-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ocr-panel__head > div {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.ocr-panel__head > div > strong {
  color: #1a2b45;
  font-size: 13px;
}

.ocr-panel__head > div > span {
  min-width: 0;
  color: #6f8098;
  font-size: 12px;
  line-height: 1.4;
}

.ocr-display {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.ocr-display h3 {
  margin: 0;
  color: #17233c;
  font-size: 14px;
  line-height: 1.45;
}

.ocr-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.ocr-meta-item {
  min-width: 0;
  border-radius: 6px;
  background: #f1f5fb;
  padding: 7px 8px;
}

.ocr-meta-item span,
.ocr-result-list__header {
  color: #7b8ca5;
  font-size: 11px;
  line-height: 1.35;
}

.ocr-meta-item strong {
  display: block;
  overflow: hidden;
  margin-top: 3px;
  color: #1a2b45;
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ocr-result-list {
  overflow: hidden;
  border: 1px solid #e4ebf5;
  border-radius: 8px;
  background: #fff;
}

.ocr-result-list__header,
.ocr-result-row {
  display: grid;
  grid-template-columns: minmax(118px, 1.4fr) minmax(72px, 0.8fr) minmax(80px, 1fr);
  gap: 8px;
  align-items: center;
}

.ocr-result-list__header {
  background: #f5f8fc;
  padding: 7px 8px;
  font-weight: 600;
}

.ocr-result-row {
  padding: 9px 8px;
  border-top: 1px solid #eef2f7;
}

.ocr-result-row--abnormal {
  background: #fff8f0;
}

.ocr-result-row__name,
.ocr-result-row__value {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.ocr-result-row__name strong,
.ocr-result-row__value strong {
  overflow-wrap: anywhere;
  color: #17233c;
  font-size: 12px;
  line-height: 1.35;
}

.ocr-result-row--abnormal .ocr-result-row__value strong {
  color: #d46b08;
}

.ocr-result-row__name span,
.ocr-result-row__value span {
  overflow-wrap: anywhere;
  color: #7b8ca5;
  font-size: 11px;
  line-height: 1.25;
}

.ocr-result-row__reference {
  overflow-wrap: anywhere;
  color: #5d6f86;
  font-size: 12px;
  line-height: 1.35;
}

.ocr-lines {
  display: grid;
  gap: 6px;
}

.ocr-lines p {
  margin: 0;
  border-radius: 6px;
  background: #f5f8fc;
  padding: 7px 8px;
  color: #17233c;
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.ocr-empty {
  margin: 10px 0 0;
  border-radius: 6px;
  background: #f5f8fc;
  padding: 8px;
  color: #7b8ca5;
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 360px) {
  .ocr-meta-grid {
    grid-template-columns: 1fr;
  }

  .ocr-result-list__header,
  .ocr-result-row {
    grid-template-columns: minmax(104px, 1.3fr) minmax(58px, 0.7fr) minmax(68px, 0.9fr);
    gap: 6px;
  }
}

.ocr-error {
  margin: 8px 0 0;
  color: #d64545;
  font-size: 12px;
  line-height: 1.5;
}

.ocr-summary {
  margin-top: 12px;
  border: 1px solid #dce8ff;
  border-radius: 8px;
  background: #f3f8ff;
  padding: 12px;
}

.ocr-summary__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ocr-summary h2 {
  margin: 0;
  color: #1a2b45;
  font-size: 14px;
}

.ocr-summary span {
  color: #2f6df6;
  font-size: 12px;
  font-weight: 700;
}

.ocr-summary p {
  margin: 8px 0 0;
  color: #607084;
  font-size: 12px;
  line-height: 1.6;
}

.upload-fixed-action {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  margin-top: 0;
  padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
  border-top: 1px solid rgba(232, 238, 247, 0.9);
}
</style>
