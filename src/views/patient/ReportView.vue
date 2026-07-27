<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppNavBar from '@/components/AppNavBar.vue'
import { useConsultationStore } from '@/stores/consultation'

const router = useRouter()
const store = useConsultationStore()
const report = computed(() => store.report)
const sectionItems = computed(() => [
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
  },
  {
    title: '上传资料摘要',
    content: report.value?.materialSummary,
    color: 'cyan'
  }
])
const genderText = computed(() => {
  if (store.profile.gender === 'male') return '男'
  if (store.profile.gender === 'female') return '女'
  return '未填写'
})

onMounted(async () => {
  if (!store.report) {
    await store.buildReport()
  }
})

function submit() {
  store.submitReport()
  router.push('/success')
}
</script>

<template>
  <div class="page report-page">
    <AppNavBar title="报告确认" back />
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
          v-for="item in sectionItems"
          :key="item.title"
          class="record-section"
          :class="`record-section--${item.color}`"
        >
          <h2>{{ item.title }}：</h2>
          <p>{{ item.content || '未填写' }}</p>
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
      <div class="fixed-action__inner action-row">
        <van-button class="report-action report-action--secondary" @click="router.push('/consultation')">
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
  padding: 14px 12px 20px;
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
  margin-top: 0;
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

@supports not (color: color-mix(in srgb, red 10%, transparent)) {
  .record-section::before {
    box-shadow: none;
  }
}
</style>
