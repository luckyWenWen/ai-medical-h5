<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import AppNavBar from '@/components/AppNavBar.vue'
import {
  getPreconsultResultApi,
  getMyPreconsultRecords,
  getPreconsultRecordDetail,
  type MyPreconsultRecordItem
} from '@/api/consultation'
import { useConsultationStore } from '@/stores/consultation'
import type { ConsultationReport } from '@/types/consultation'

const router = useRouter()
const store = useConsultationStore()
const loading = ref(false)
const detailLoading = ref(false)
const resumingRecordId = ref('')
const records = ref<MyPreconsultRecordItem[]>([])
const showDetail = ref(false)
const currentRecord = ref<MyPreconsultRecordItem | null>(null)
const recordDetail = ref<Record<string, any> | null>(null)
const resultDetail = ref<ConsultationReport | null>(null)
const activeDetailTab = ref<'result' | 'process'>('process')

const submittedCount = computed(() => records.value.filter((item) => normalizeStatus(item) === '已提交').length)
const totalCount = computed(() => records.value.length)

function getRecordId(item: Record<string, any>) {
  return String(item.recordId || item.id || item.preconsultRecordId || '')
}

function normalizeStatus(item: Record<string, any>) {
  const status = String(item.status || item.recordStatus || '').toUpperCase()
  if (status === 'SUBMITTED' || status === 'FINISHED' || item.consultationNo) return '已提交'
  if (status === 'DRAFT' || status === 'IN_PROGRESS' || status === 'PROCESSING') return '进行中'
  if (status === 'CANCELLED') return '已取消'
  return item.statusText || item.statusName || '待完善'
}

function statusType(status: string): 'primary' | 'success' | 'warning' | 'danger' {
  if (status === '已提交') return 'success'
  if (status === '进行中') return 'primary'
  if (status === '已取消') return 'danger'
  return 'warning'
}

function isSubmittedRecord(item: Record<string, any>) {
  const status = String(item.status || item.recordStatus || '').toUpperCase()
  return item.readOnly === true || Boolean(item.consultationNo) || status === 'SUBMITTED' || status === 'FINISHED'
}

function canResumeRecord(item: Record<string, any>) {
  const status = String(item.status || item.recordStatus || '').toUpperCase()
  if (item.readOnly === true || item.consultationNo) return false
  return status === 'DRAFT' || status === 'IN_PROGRESS' || status === 'PROCESSING' || normalizeStatus(item) === '进行中'
}

function getDisplayTime(item: Record<string, any>) {
  return item.submitTime || item.submittedAt || item.updatedAt || item.createTime || item.createdAt || '暂无时间'
}

function getDepartment(item: Record<string, any>) {
  return item.departmentName || item.department || item.deptName || '未填写科室'
}

function getPatientName(item: Record<string, any>) {
  return (
    item.patientName ||
    item.name ||
    item.patientSnapshot?.name ||
    item.patientSnapshot?.patientName ||
    store.profile.name ||
    store.patientAuth?.patientName ||
    store.patientAuth?.username ||
    '未填写'
  )
}

function getChiefComplaint(item: Record<string, any>) {
  return item.chiefComplaint || item.presentIllness || item.summary || item.reportSummary || '暂无问诊摘要'
}

function getDetailValue(...keys: string[]) {
  const source = recordDetail.value || {}
  for (const key of keys) {
    const value = key.split('.').reduce<any>((obj, field) => obj?.[field], source)
    if (value !== undefined && value !== null && value !== '') return value
  }
  return ''
}

function getArrayValue(...keys: string[]) {
  const value = getDetailValue(...keys)
  return Array.isArray(value) ? value : []
}

const resultSections = computed(() => [
  {
    title: '主诉',
    content: resultDetail.value?.chiefComplaint,
    color: 'pink'
  },
  {
    title: '现病史',
    content: resultDetail.value?.presentIllness,
    color: 'blue'
  },
  {
    title: '既往史',
    content: resultDetail.value?.pastHistory,
    color: 'green'
  },
  {
    title: '过敏史',
    content: resultDetail.value?.allergyHistory,
    color: 'orange'
  }
])

const hasRiskTips = computed(() => Boolean(resultDetail.value?.riskTips?.length))

const answerList = computed(() => {
  const answers = getArrayValue('answers', 'answerList', 'answerItems', 'questionAnswers')
  const questions = getArrayValue('questions', 'questionList', 'templateQuestions')
  const questionEntries: Array<[string, string]> = questions
    .map((question: Record<string, any>) => [
      String(question.templateQuestionId || question.questionId || question.id || ''),
      String(question.title || question.questionTitle || question.templateQuestionTitle || question.name || '')
    ])
    .filter(([id, title]) => Boolean(id && title)) as Array<[string, string]>
  const questionTitleById = new Map(questionEntries)

  return answers.map((answer: Record<string, any>, index: number) => {
    const questionId = String(answer.templateQuestionId || answer.questionId || answer.id || '')
    const title =
      answer.questionTitle ||
      answer.templateQuestionTitle ||
      answer.title ||
      questionTitleById.get(questionId) ||
      `问题 ${index + 1}`

    return {
      ...answer,
      questionTitle: title,
      answerText: formatAnswerText(answer)
    }
  })
})

function formatAnswerText(answer: Record<string, any>) {
  if (answer.displayText || answer.answerText) return String(answer.displayText || answer.answerText)
  const value = answer.value ?? answer.answerValue ?? answer.content

  if (value === null || value === undefined || value === '') return '未回答'
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) return value.map(String).join('、')

  if (value.text !== undefined) return String(value.text)
  if (value.optionValue !== undefined) return String(value.optionValue)
  if (Array.isArray(value.optionValues)) return value.optionValues.map(String).join('、')
  if (Array.isArray(value.bodyPartCodes)) return value.bodyPartCodes.map(String).join('、')
  if (Array.isArray(value.attachmentIds)) return `已上传 ${value.attachmentIds.length} 份资料`
  if (value.value !== undefined) return String(value.value)

  return '已回答'
}

async function loadRecords() {
  loading.value = true
  try {
    records.value = await getMyPreconsultRecords()
  } catch (error) {
    records.value = []
    showToast(error instanceof Error ? error.message : '问诊记录加载失败')
  } finally {
    loading.value = false
  }
}

async function openDetail(item: MyPreconsultRecordItem) {
  const recordId = getRecordId(item)
  if (!recordId) {
    showToast('记录ID不存在')
    return
  }

  currentRecord.value = item
  activeDetailTab.value = isSubmittedRecord(item) ? 'result' : 'process'
  showDetail.value = true
  detailLoading.value = true
  recordDetail.value = null
  resultDetail.value = null
  try {
    if (isSubmittedRecord(item)) {
      resultDetail.value = await getPreconsultResultApi(recordId)
    } else {
      recordDetail.value = await getPreconsultRecordDetail(recordId)
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : '记录详情加载失败')
  } finally {
    detailLoading.value = false
  }
}

async function resumeRecord(item: MyPreconsultRecordItem) {
  const recordId = getRecordId(item)
  if (!recordId) {
    showToast('记录ID不存在')
    return
  }
  if (!canResumeRecord(item)) {
    showToast('该记录已完成，无法继续问诊')
    return
  }

  resumingRecordId.value = recordId
  try {
    const detail = await getPreconsultRecordDetail(recordId)
    const status = String(detail.status || item.status || '').toUpperCase()
    if (detail.readOnly === true || status === 'SUBMITTED' || status === 'FINISHED') {
      showToast('该记录已提交，仅可查看')
      return
    }

    store.resumeRecordView({
      ...item,
      ...detail,
      recordId
    })
    showDetail.value = false
    await router.push('/consultation')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '恢复问诊失败，请稍后重试')
  } finally {
    resumingRecordId.value = ''
  }
}

async function refreshDetail() {
  if (!currentRecord.value) return
  await openDetail(currentRecord.value)
}

onMounted(loadRecords)
</script>

<template>
  <div class="page records-page">
    <AppNavBar title="我的问诊记录" back />

    <main class="records-body">
      <section class="records-summary">
        <div>
          <span>累计预问诊</span>
          <strong>{{ totalCount }}</strong>
        </div>
        <div>
          <span>已提交</span>
          <strong>{{ submittedCount }}</strong>
        </div>
      </section>

      <van-pull-refresh v-model="loading" @refresh="loadRecords">
        <van-empty v-if="!loading && !records.length" description="暂无问诊记录" />

        <section v-else class="record-list">
          <article
            v-for="item in records"
            :key="getRecordId(item)"
            class="record-card"
            @click="openDetail(item)"
          >
            <div class="record-card__head">
              <div>
                <h2>{{ getDepartment(item) }}</h2>
                <p>{{ getPatientName(item) }} · {{ getDisplayTime(item) }}</p>
              </div>
              <van-tag :type="statusType(normalizeStatus(item))" round>
                {{ normalizeStatus(item) }}
              </van-tag>
            </div>
            <p class="record-card__summary">{{ getChiefComplaint(item) }}</p>
            <div class="record-card__foot">
              <span>编号：{{ item.consultationNo || getRecordId(item) }}</span>
              <van-button
                v-if="canResumeRecord(item)"
                size="small"
                type="primary"
                plain
                :loading="resumingRecordId === getRecordId(item)"
                @click.stop="resumeRecord(item)"
              >
                继续问诊
              </van-button>
              <van-icon v-else name="arrow" />
            </div>
          </article>
        </section>
      </van-pull-refresh>
    </main>

    <van-popup v-model:show="showDetail" position="bottom" round :style="{ height: '86%' }">
      <section class="detail-panel">
        <header class="detail-panel__head">
          <div>
            <h2>{{ currentRecord ? getDepartment(currentRecord) : '问诊详情' }}</h2>
            <p>{{ currentRecord ? getDisplayTime(currentRecord) : '' }}</p>
          </div>
          <div class="detail-panel__tools">
            <van-tag v-if="currentRecord" :type="statusType(normalizeStatus(currentRecord))" round>
              {{ normalizeStatus(currentRecord) }}
            </van-tag>
            <van-button
              v-if="currentRecord && canResumeRecord(currentRecord)"
              size="small"
              type="primary"
              :loading="resumingRecordId === getRecordId(currentRecord)"
              @click="resumeRecord(currentRecord)"
            >
              继续问诊
            </van-button>
            <!-- <van-button v-if="currentRecord" size="small" plain type="primary" @click="refreshDetail">刷新</van-button> -->
          </div>
        </header>

        <van-loading v-if="detailLoading" class="detail-loading" size="24px">加载中</van-loading>

        <template v-else>
          <!-- <div class="detail-info">
            <div>
              <span>记录编号</span>
              <strong>{{ currentRecord ? currentRecord.consultationNo || getRecordId(currentRecord) : '-' }}</strong>
            </div>
            <div>
              <span>就诊人</span>
              <strong>{{ currentRecord ? getPatientName(currentRecord) : '-' }}</strong>
            </div>
          </div> -->

          <template v-if="activeDetailTab === 'result'">
            <article class="record-result-card">
              <section class="result-basic-panel">
                <div class="result-basic-panel__decor result-basic-panel__decor--one"></div>
                <div class="result-basic-panel__decor result-basic-panel__decor--two"></div>
                <h1>基本信息</h1>
                <div class="result-basic-info">
                  <div>
                    <span>姓名：</span>
                    <strong>{{ currentRecord ? getPatientName(currentRecord) : '未填写' }}</strong>
                  </div>
                  <div>
                    <span>科室：</span>
                    <strong>{{ currentRecord ? getDepartment(currentRecord) : '未选择科室' }}</strong>
                  </div>
                  <div>
                    <span>编号：</span>
                    <strong>{{ currentRecord ? currentRecord.consultationNo || getRecordId(currentRecord) : '-' }}</strong>
                  </div>
                  <div>
                    <span>时间：</span>
                    <strong>{{ currentRecord ? getDisplayTime(currentRecord) : '-' }}</strong>
                  </div>
                </div>
              </section>

              <section
                v-for="section in resultSections"
                :key="section.title"
                class="result-section"
                :class="`result-section--${section.color}`"
              >
                <h2>{{ section.title }}：</h2>
                <p>{{ section.content || '未填写' }}</p>
              </section>

              <section class="result-section result-section--cyan">
                <h2>上传资料摘要：</h2>
                <p>{{ resultDetail?.materialSummary || '未上传检查资料' }}</p>
              </section>

              <section class="result-section result-section--risk">
                <h2>风险提醒：</h2>
                <template v-if="hasRiskTips">
                  <p v-for="tip in resultDetail?.riskTips" :key="tip">{{ tip }}</p>
                </template>
                <p v-else>暂未触发高危提醒，仍需医生结合现场问诊确认。</p>
              </section>
            </article>
          </template>

          <template v-else>
            <section v-if="answerList.length" class="detail-section">
              <h3>问答记录</h3>
              <div class="answer-list">
                <div v-for="(answer, index) in answerList" :key="index" class="answer-item">
                  <strong>{{ answer.questionTitle }}</strong>
                  <span>{{ answer.answerText }}</span>
                </div>
              </div>
            </section>
            <van-empty v-else description="暂无答题过程" />
          </template>
        </template>
      </section>
    </van-popup>
  </div>
</template>

<style scoped>
.records-page {
  min-height: 100vh;
  background: #f6f8fb;
}

.records-body {
  width: min(100%, 520px);
  margin: 0 auto;
  padding: 12px 12px calc(24px + env(safe-area-inset-bottom));
}

.records-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.records-summary div {
  border-radius: 8px;
  background: linear-gradient(135deg, #2488fa 0%, #57b7ff 100%);
  padding: 14px;
  color: #fff;
}

.records-summary div:last-child {
  background: linear-gradient(135deg, #12b981 0%, #60d394 100%);
}

.records-summary span {
  display: block;
  font-size: 12px;
  opacity: 0.9;
}

.records-summary strong {
  display: block;
  margin-top: 8px;
  font-size: 25px;
  line-height: 1;
}

.record-list {
  display: grid;
  gap: 10px;
}

.record-card {
  border: 1px solid #e8eef7;
  border-radius: 8px;
  background: #fff;
  padding: 14px;
  box-shadow: 0 8px 20px rgba(24, 39, 75, 0.06);
}

.record-card__head,
.record-card__foot,
.detail-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.record-card h2,
.detail-panel h2 {
  margin: 0;
  color: #1d2939;
  font-size: 16px;
  line-height: 1.35;
}

.record-card__head p,
.detail-panel__head p {
  margin: 4px 0 0;
  color: #8b9bb0;
  font-size: 12px;
}

.record-card__summary {
  display: -webkit-box;
  margin: 12px 0;
  overflow: hidden;
  color: #405166;
  font-size: 13px;
  line-height: 1.65;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.record-card__foot {
  align-items: center;
  color: #8b9bb0;
  font-size: 12px;
}

.detail-panel__tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-panel {
  min-height: 100%;
  padding: 18px 16px calc(18px + env(safe-area-inset-bottom));
  overflow-y: auto;
}

.detail-loading {
  margin-top: 60px;
  justify-content: center;
}

.detail-info {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.detail-info div {
  min-width: 0;
  border-radius: 8px;
  background: #f7f9fc;
  padding: 10px;
}

.detail-info span {
  display: block;
  color: #8b9bb0;
  font-size: 12px;
}

.detail-info strong {
  display: block;
  margin-top: 5px;
  color: #1d2939;
  font-size: 13px;
  word-break: break-all;
}

.detail-section {
  margin-top: 18px;
}

.detail-section h3 {
  margin: 0 0 9px;
  color: #1d2939;
  font-size: 15px;
}

.detail-section p,
.answer-list {
  margin: 0;
  border-radius: 8px;
  background: #f7f9fc;
  padding: 12px;
  color: #405166;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.answer-item + .answer-item {
  margin-top: 10px;
  border-top: 1px solid #e8eef7;
  padding-top: 10px;
}

.answer-item strong {
  display: block;
  color: #1d2939;
  font-size: 13px;
}

.answer-item span {
  display: block;
  margin-top: 4px;
  color: #607084;
}

.record-result-card {
  overflow: hidden;
  margin-top: 16px;
  border-radius: 10px;
  background: var(--theme-surface);
}

.result-basic-panel {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  padding: 22px 16px 16px;
  background: linear-gradient(135deg, #eef5ff 0%, #d8e7ff 48%, #9fc1ff 100%);
}

.result-basic-panel__decor {
  position: absolute;
  pointer-events: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.34);
}

.result-basic-panel__decor--one {
  right: 46px;
  top: 18px;
  width: 90px;
  height: 54px;
}

.result-basic-panel__decor--two {
  right: 16px;
  top: 30px;
  width: 90px;
  height: 76px;
  border: 8px solid rgba(255, 255, 255, 0.48);
  background: transparent;
}

.result-basic-panel h1 {
  position: relative;
  z-index: 1;
  margin: 0 0 18px;
  color: #102135;
  font-size: 20px;
  font-weight: 800;
}

.result-basic-info {
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

.result-basic-info div {
  min-width: 0;
  color: #34405c;
  font-size: 14px;
  line-height: 1.35;
}

.result-basic-info span {
  color: #425071;
}

.result-basic-info strong {
  color: #0d1d34;
  font-weight: 700;
  word-break: break-word;
}

.result-section {
  position: relative;
  padding: 18px 8px 0 30px;
}

.result-section::before {
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

.result-section h2 {
  margin: 0 0 10px;
  color: #0d2450;
  font-size: 17px;
  font-weight: 800;
}

.result-section p {
  margin: 0;
  color: #12233d;
  font-size: 16px;
  line-height: 1.75;
  text-align: justify;
  white-space: pre-wrap;
}

.result-section--pink {
  --section-dot: #ff3d92;
}

.result-section--blue {
  --section-dot: #4b75ff;
}

.result-section--green {
  --section-dot: #18a67c;
}

.result-section--orange {
  --section-dot: #f59e0b;
}

.result-section--cyan {
  --section-dot: #16a6c8;
}

.result-section--risk {
  --section-dot: #ff9f1a;
  margin: 18px 0 8px;
  border: 1px solid var(--theme-warning-border);
  border-radius: 8px;
  background: var(--theme-warning-bg);
  padding: 15px 14px 15px 32px;
}

.result-section--risk::before {
  top: 23px;
  left: 14px;
}

.result-section--risk h2 {
  color: var(--theme-warning-strong);
}

.result-section--risk p {
  color: var(--theme-warning-text);
  font-size: 15px;
}

@supports not (color: color-mix(in srgb, red 10%, transparent)) {
  .result-section::before {
    box-shadow: none;
  }
}
</style>
