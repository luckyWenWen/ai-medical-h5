<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showImagePreview, showToast } from 'vant'
import AppNavBar from '@/components/AppNavBar.vue'
import OcrReportDisplay from '@/components/OcrReportDisplay.vue'
import { useConsultationStore } from '@/stores/consultation'
import type { UploadMaterial } from '@/types/consultation'

const router = useRouter()
const store = useConsultationStore()
const report = computed(() => store.report)
const materialSummaryExpanded = ref(false)
const hasRiskTips = computed(() => Boolean(report.value?.riskTips?.length))

interface MaterialOcrDisplay {
  id: string
  name: string
  type: UploadMaterial['type']
  url: string
  ocrText: string
  ocrSummary: string
  ocrError: string
}

const textSections = computed(() => [
  {
    title: '主诉',
    content: report.value?.chiefComplaint,
    color: 'pink'
  },
  {
    title: '现病史',
    content: report.value?.presentIllness,
    color: 'blue'
  },
  {
    title: '既往史',
    content: report.value?.pastHistory,
    color: 'green'
  },
  {
    title: '过敏史',
    content: report.value?.allergyHistory,
    color: 'orange'
  }
])
const genderText = computed(() => {
  if (store.profile.gender === 'male') return '男'
  if (store.profile.gender === 'female') return '女'
  return '未填写'
})
const materialCount = computed(() => {
  const fromStore = store.materials.length
  const fromSummary = report.value?.materialSummary.match(/已上传\s*(\d+)\s*[个份]?文件?/)?.[1]
  return fromStore || Number(fromSummary || 0)
})
const materialOcrDisplays = computed<MaterialOcrDisplay[]>(() => {
  const localDisplays = store.materials.map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    url: item.url,
    ocrText: item.ocrText || '',
    ocrSummary: item.ocrSummary || '',
    ocrError: item.ocrError || ''
  }))

  if (localDisplays.some((item) => item.ocrText || item.ocrError)) {
    return localDisplays
  }

  return parseMaterialSummary(report.value?.materialSummary || '')
})
const recognizedMaterialCount = computed(() =>
  materialOcrDisplays.value.filter((item) => item.ocrText).length
)
const materialSummaryText = computed(() => {
  if (!materialCount.value) return '未上传检查资料'
  const recognizedText = recognizedMaterialCount.value
    ? `，已识别 ${recognizedMaterialCount.value} 份`
    : ''
  return `已上传 ${materialCount.value} 份资料${recognizedText}`
})

onMounted(async () => {
  if (store.readOnly || store.consultationNo) {
    // 已提交：只读查看，仍需拉取报告内容展示
    if (!store.report) {
      await store.buildReport()
    }
    return
  }
  if (store.consultationMode === 'qa' && store.hasUnansweredRequiredQuestions) {
    showToast('还有未回答的题目，请继续回答')
    router.replace('/consultation')
    return
  }
  if (!store.report) {
    const reportReady = await store.buildReport()
    if (!reportReady && store.consultationMode === 'qa') {
      router.replace('/consultation')
    }
  }
})

function previewMaterial(item: UploadMaterial) {
  if (item.type === 'image' && item.url) {
    showImagePreview({
      images: [item.url],
      closeable: true,
      closeOnClickOverlay: true,
      closeOnClickImage: true
    })
  } else if (item.name) {
    showToast(`已归档资料：${item.name}`)
  }
}

function parseMaterialSummary(summary: string): MaterialOcrDisplay[] {
  if (!summary || summary === '未上传检查资料') return []
  return summary
    .split(/(?=【报告[：:]\s*[^】]+】)/g)
    .map<MaterialOcrDisplay | null>((part, index) => {
      const matched = part.match(/【报告[：:]\s*([^】]+)】/)
      if (!matched) return null
      const name = matched[1].trim()
      const ocrText = part
        .replace(matched[0], '')
        .replace(/^[；;，,\s]+/, '')
        .trim()

      return {
        id: `summary-${index}-${name}`,
        name,
        type: 'file' as const,
        url: '',
        ocrText: /^图片\s*OCR\s*识别异常/.test(ocrText) ? '' : ocrText,
        ocrSummary: '',
        ocrError: /^图片\s*OCR\s*识别异常/.test(ocrText) ? '图片 OCR 识别异常' : ''
      }
    })
    .filter((item): item is MaterialOcrDisplay => Boolean(item))
}

async function submit() {
  if (store.readOnly || store.consultationNo) {
    showToast('本次预问诊已经提交，无法重复提交')
    return
  }
  if (store.consultationMode === 'qa' && store.hasUnansweredRequiredQuestions) {
    showToast('还有未回答的题目，请继续回答')
    router.push('/consultation')
    return
  }
  // 必须等待后端确认提交成功再跳转，失败留在本页提示用户
  if (hasRiskTips.value) {
    try {
      await showConfirmDialog({
        title: '风险提示确认',
        message: '本次预问诊存在风险提示，请确认您已阅读并知晓相关风险。若症状严重或持续加重，请及时就医。',
        confirmButtonText: '已知晓，继续提交',
        cancelButtonText: '返回查看'
      })
    } catch {
      return
    }
  }

  const ok = await store.submitReport()
  if (ok) {
    router.push('/success')
  }
}

function revise() {
  if (store.readOnly || store.consultationNo) {
    showToast('本次预问诊已经提交，只能查看，无法修改')
    return
  }
  if (store.consultationMode === 'voice') {
    router.push('/voice-narration')
    return
  }
  if (store.consultationMode === 'text') {
    router.push('/self-narration')
    return
  }
  router.push({ path: '/consultation', query: { revise: '1' } })
}
</script>

<template>
  <div class="page report-page">
    <AppNavBar title="报告确认" back />
    <van-notice-bar
      v-if="store.readOnly || store.consultationNo"
      color="#059669"
      background="#ecfdf5"
      left-icon="info-o"
      :text="`本次预问诊已提交（单号：${store.consultationNo || '已归档'}），记录已归档为只读模式，无法修改。`"
    />
    <main class="page-body report-body">
      <article class="report-card">
        <section class="basic-panel">
          <div class="basic-panel__decor basic-panel__decor--one"></div>
          <div class="basic-panel__decor basic-panel__decor--two"></div>
          <div class="basic-panel__head">
            <h1>基本信息</h1>
            <div class="visit-meta">
              <span>{{ store.visitInfo.visitType === 'first' ? '初诊' : '复诊' }}</span>
              <span v-if="store.visitInfo.doctor">{{ store.visitInfo.doctor }}</span>
              <span v-if="store.visitInfo.visitTime">{{ store.visitInfo.visitTime }}</span>
            </div>
          </div>
          <div class="basic-info">
            <div>
              <span>姓名：</span>
              <strong>{{ store.profile.name || '未填写' }}</strong>
            </div>
            <div>
              <span>性别：</span>
              <strong>{{ genderText }}</strong>
            </div>
            <div>
              <span>年龄：</span>
              <strong>{{ store.profile.age || '未填写' }} 岁</strong>
            </div>
            <div>
              <span>科室：</span>
              <strong>{{ store.visitInfo.department || '未选择科室' }}</strong>
            </div>
          </div>
        </section>

        <section
          v-for="item in textSections"
          :key="item.title"
          class="record-section"
          :class="`record-section--${item.color}`"
        >
          <h2>{{ item.title }}：</h2>
          <p>{{ item.content || '未填写' }}</p>
        </section>

        <section class="record-section record-section--cyan">
          <div class="material-summary-head">
            <div>
              <h2>上传资料摘要：</h2>
              <p>{{ materialSummaryText }}</p>
            </div>
            <van-button
              v-if="materialOcrDisplays.length"
              size="mini"
              plain
              type="primary"
              @click="materialSummaryExpanded = !materialSummaryExpanded"
            >
              {{ materialSummaryExpanded ? '收起' : '查看' }}
            </van-button>
          </div>

          <div v-if="store.materials.length" class="materials-preview-grid">
            <div
              v-for="item in store.materials"
              :key="item.id"
              class="material-preview-card"
              @click="previewMaterial(item)"
            >
              <img
                v-if="item.type === 'image' && item.url"
                :src="item.url"
                class="material-preview-card__img"
                alt="资料预览"
              />
              <div v-else class="material-preview-card__icon">📄</div>
              <div class="material-preview-card__info">
                <span class="material-preview-card__name">{{ item.name }}</span>
                <span class="material-preview-card__tag">{{ item.type === 'image' ? '点击放大预览' : '已上传' }}</span>
              </div>
            </div>
          </div>

          <div v-if="materialSummaryExpanded" class="material-ocr-list">
            <article
              v-for="item in materialOcrDisplays"
              :key="item.id"
              class="material-ocr-card"
            >
              <button
                type="button"
                class="material-ocr-card__head"
                @click="item.type === 'image' && item.url ? previewMaterial(item as UploadMaterial) : undefined"
              >
                <span>{{ item.name }}</span>
                <van-tag v-if="item.ocrText" type="success">OCR识别完成</van-tag>
                <van-tag v-else type="warning">无识别文本</van-tag>
              </button>

              <OcrReportDisplay v-if="item.ocrText" :ocr-text="item.ocrText" />

              <p v-else class="material-ocr-empty">
                {{ item.ocrError || '暂未识别到文字' }}
              </p>
            </article>
          </div>
        </section>

        <section v-if="report?.riskTips.length" class="record-section record-section--risk">
          <h2>风险提醒：</h2>
          <p v-for="tip in report.riskTips" :key="tip">{{ tip }}</p>
        </section>
        <section v-else class="record-section record-section--risk">
          <h2>风险提醒：</h2>
          <p>暂未触发高危提醒，仍需医生结合现场问诊确认。</p>
        </section>
      </article>
    </main>

    <div class="fixed-action report-fixed-action">
      <div v-if="store.readOnly || store.consultationNo" class="fixed-action__inner">
        <van-button class="report-action" type="primary" block disabled>
          本次预问诊已经提交（仅供查看）
        </van-button>
      </div>
      <div v-else class="fixed-action__inner action-row">
        <van-button class="report-action report-action--secondary" @click="revise">
          返回修改
        </van-button>
        <van-button class="report-action" type="primary" @click="submit">确认提交</van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.report-page {
  background:
    radial-gradient(circle at 12px 12px, rgba(0, 135, 121, 0.04) 1px, transparent 0),
    #ffffff;
  background-size: 18px 18px;
}

.report-body {
  padding: 14px 12px calc(92px + env(safe-area-inset-bottom));
}

.report-card {
  overflow: hidden;
  border-radius: 10px;
  background: var(--theme-surface);
}

.basic-panel {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  padding: 10px;
  background: linear-gradient(135deg, #eef5ff 0%, #d8e7ff 48%, #9fc1ff 100%);
}

.basic-panel__decor {
  position: absolute;
  pointer-events: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.34);
}

.basic-panel__decor--one {
  right: 46px;
  top: 18px;
  width: 90px;
  height: 54px;
}

.basic-panel__decor--two {
  right: 16px;
  top: 30px;
  width: 90px;
  height: 76px;
  border: 8px solid rgba(255, 255, 255, 0.48);
  background: transparent;
}

.basic-panel__head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.basic-panel h1 {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  margin: 0;
  color: #102135;
  font-size: 16px;
  font-weight: 800;
}

.basic-info {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  row-gap: 10px;
  column-gap: 4px;
  border: 1px solid rgba(190, 202, 220, 0.78);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.94);
  padding: 10px;
}

.basic-info div {
  min-width: 0;
  color: #34405c;
  font-size: 16px;
  line-height: 1.35;
}

.basic-info span {
  color: #425071;
}

.basic-info strong {
  color: #0d1d34;
  font-weight: 700;
  word-break: break-word;
}

.visit-meta {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  color: #365178;
  font-size: 13px;
}

.visit-meta span {
  max-width: 100%;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.68);
  padding: 3px 9px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.record-section {
  position: relative;
  padding: 10px 8px 0 30px;
}

.record-section::before {
  position: absolute;
  top: 18px;
  left: 10px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  content: "";
  background: var(--section-dot);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--section-dot) 18%, transparent);
}

.record-section h2 {
  margin: 0 0 10px;
  color: #0d2450;
  font-size: 17px;
  font-weight: 800;
}

.record-section p {
  margin: 0;
  color: #12233d;
  font-size: 16px;
  line-height: 1.75;
  text-align: justify;
  white-space: pre-wrap;
}

.record-section--pink {
  --section-dot: #ff3d92;
}

.record-section--blue {
  --section-dot: #4b75ff;
}

.record-section--green {
  --section-dot: #18a67c;
}

.record-section--orange {
  --section-dot: #f59e0b;
}

.record-section--cyan {
  --section-dot: #16a6c8;
}

.record-section--risk {
  --section-dot: #ff9f1a;
  margin-top: 18px;
  border: 1px solid var(--theme-warning-border);
  border-radius: 8px;
  background: var(--theme-warning-bg);
  padding: 15px 14px 15px 32px;
}

.record-section--risk::before {
  top: 23px;
  left: 14px;
}

.record-section--risk h2 {
  color: var(--theme-warning-strong);
}

.record-section--risk p {
  color: var(--theme-warning-text);
  font-size: 15px;
}

.material-summary-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.material-summary-head > div {
  min-width: 0;
}

.material-summary-head h2 {
  margin-bottom: 8px;
}

.material-summary-head p {
  color: #425071;
  font-size: 15px;
  line-height: 1.55;
}

.material-ocr-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.material-ocr-card {
  border: 1px solid #e4ebf5;
  border-radius: 8px;
  background: #fbfcff;
  padding: 10px;
}

.material-ocr-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 0;
  text-align: left;
}

.material-ocr-card__head span {
  min-width: 0;
  overflow: hidden;
  color: #17233c;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-ocr-empty {
  margin: 10px 0 0;
  border-radius: 6px;
  background: #f5f8fc;
  padding: 7px 8px;
  color: #7b8ca5;
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
  white-space: normal;
  text-align: left;
}

.report-fixed-action {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  margin-top: 0;
  border-top: 1px solid var(--theme-border);
  padding: 10px 14px calc(10px + env(safe-area-inset-bottom));
}

.action-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.report-action {
  min-height: 44px;
  border-radius: var(--theme-radius);
  font-weight: 700;
}

.report-action :deep(.van-button__text) {
  color: var(--theme-on-primary);
}

.report-action--secondary {
  border: 1px solid var(--theme-primary);
  background: var(--theme-primary-muted);
  box-shadow: none;
}

.report-action--secondary :deep(.van-button__text) {
  color: var(--theme-primary);
}

.materials-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.material-preview-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--theme-border, #e5e7eb);
  border-radius: 8px;
  background: var(--theme-surface, #f9fafb);
  cursor: pointer;
  transition: background 0.2s;
}

.material-preview-card:active {
  background: #eef2ff;
}

.material-preview-card__img {
  width: 36px;
  height: 36px;
  object-fit: cover;
  border-radius: 4px;
}

.material-preview-card__icon {
  font-size: 24px;
  line-height: 1;
}

.material-preview-card__info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.material-preview-card__name {
  font-size: 12px;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.material-preview-card__tag {
  font-size: 10px;
  color: #059669;
}

@supports not (color: color-mix(in srgb, red 10%, transparent)) {
  .record-section::before {
    box-shadow: none;
  }
}
</style>
