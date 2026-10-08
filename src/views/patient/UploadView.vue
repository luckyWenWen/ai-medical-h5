<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast, showImagePreview } from 'vant'
import type { UploaderFileListItem as VantFile } from 'vant'
import { uploadPreconsultOcrApi } from '@/api/consultation'
import AppNavBar from '@/components/AppNavBar.vue'
import OcrReportDisplay from '@/components/OcrReportDisplay.vue'
import { useConsultationStore } from '@/stores/consultation'
import type { UploadMaterial, UploadOcrStatus } from '@/types/consultation'

const router = useRouter()
const store = useConsultationStore()
const fileList = ref<VantFile[]>([])
const submitting = ref(false)
const ocrRequestCount = ref(0)
const isRecognizing = computed(() => ocrRequestCount.value > 0)
const expandedOcrIds = ref<Record<string, boolean>>({})

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
  if (isRecognizing.value) return '正在识别，请稍候'
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

    fileItem.status = 'uploading'
    fileItem.message = '正在识别...'
    ocrRequestCount.value += 1

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
      fileItem.status = 'done'
      fileItem.message = ''
    } catch (error) {
      console.warn('上传附件到后端接口失败:', error)
      showToast(`${file.name} 上传失败，请重试`)
      ocrStatus = 'failed'
      ocrError = '资料上传失败，无法识别'
      fileItem.status = 'failed'
      fileItem.message = '识别失败'
    } finally {
      ocrRequestCount.value -= 1
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
    if (ocrText) expandedOcrIds.value[attachmentId] = true
  }
}

async function finishUpload() {
  if (submitting.value || isRecognizing.value) return
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
          :disabled="isRecognizing || submitting"
          :deletable="!isRecognizing && !submitting"
          @delete="onUploaderDelete"
          :accept="accept"
        />
      </section>

      <div v-if="isRecognizing" class="ocr-loading" role="status" aria-live="polite">
        <van-loading size="20px" color="var(--van-primary-color)">
          正在识别资料，请稍候...
        </van-loading>
      </div>

      <div class="section-header">
        <p class="section-title">已选择资料（{{ fileList.length }} 份）</p>
        <span v-if="hasMaterials" class="ocr-count">已识别 {{ ocrSuccessCount }} 份</span>
      </div>
      <van-empty v-if="!hasMaterials && !isRecognizing" description="暂无资料，可直接跳过" />
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
              :disabled="isRecognizing || submitting"
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
            <OcrReportDisplay
              v-if="item.ocrText && isOcrExpanded(item.id)"
              :ocr-text="item.ocrText"
            />
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
        <van-button
          type="primary"
          block
          :loading="submitting || isRecognizing"
          :loading-text="isRecognizing ? '正在识别，请稍候' : '提交中...'"
          :disabled="isRecognizing"
          @click="finishUpload"
        >
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

.ocr-loading {
  margin-top: 16px;
  padding: 12px 0;
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
  border-top: 1px solid #eef2f7;
  padding-top: 12px;
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

.ocr-empty {
  margin: 10px 0 0;
  border-radius: 6px;
  background: #f5f8fc;
  padding: 8px;
  color: #7b8ca5;
  font-size: 12px;
  line-height: 1.5;
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
