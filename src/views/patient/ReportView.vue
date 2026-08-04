<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showImagePreview, showToast } from 'vant'
import AppNavBar from '@/components/AppNavBar.vue'
import { useConsultationStore } from '@/stores/consultation'
import type { UploadMaterial } from '@/types/consultation'

const router = useRouter()
const store = useConsultationStore()
const report = computed(() => store.report)
const hasRiskTips = computed(() => Boolean(report.value?.riskTips?.length))
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

onMounted(async () => {
  if (store.readOnly || store.consultationNo) {
    // 已提交：只读查看，仍需拉取报告内容展示
    if (!store.report) {
      await store.buildReport()
    }
    return
  }
  if (store.hasUnansweredRequiredQuestions) {
    showToast('还有未回答的题目，请继续回答')
    router.replace('/consultation')
    return
  }
  if (!store.report) {
    const reportReady = await store.buildReport()
    if (!reportReady) {
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

async function submit() {
  if (store.readOnly || store.consultationNo) {
    showToast('本次预问诊已经提交，无法重复提交')
    return
  }
  if (store.hasUnansweredRequiredQuestions) {
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
          <h1>基本信息</h1>
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
          <div class="visit-meta">
            <span>{{ store.visitInfo.visitType === 'first' ? '初诊' : '复诊' }}</span>
            <span v-if="store.visitInfo.doctor">{{ store.visitInfo.doctor }}</span>
            <span v-if="store.visitInfo.visitTime">{{ store.visitInfo.visitTime }}</span>
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
          <h2>上传资料摘要：</h2>
          <p>{{ report?.materialSummary || '未上传检查资料' }}</p>

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
  padding: 22px 16px 16px;
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

.basic-panel h1 {
  position: relative;
  z-index: 1;
  margin: 0 0 18px;
  color: #102135;
  font-size: 20px;
  font-weight: 800;
}

.basic-info {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  row-gap: 18px;
  column-gap: 14px;
  border: 1px solid rgba(190, 202, 220, 0.78);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.94);
  padding: 20px;
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
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  color: #365178;
  font-size: 13px;
}

.visit-meta span {
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.68);
  padding: 3px 9px;
}

.record-section {
  position: relative;
  padding: 18px 8px 0 30px;
}

.record-section::before {
  position: absolute;
  top: 26px;
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
