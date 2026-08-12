<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showToast } from 'vant'
import AppNavBar from '@/components/AppNavBar.vue'
import {
  getMyPreconsultRecords,
  getPreconsultRecordDetail,
  type MyPreconsultRecordItem
} from '@/api/consultation'

const loading = ref(false)
const detailLoading = ref(false)
const records = ref<MyPreconsultRecordItem[]>([])
const showDetail = ref(false)
const currentRecord = ref<MyPreconsultRecordItem | null>(null)
const recordDetail = ref<Record<string, any> | null>(null)

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

function getDisplayTime(item: Record<string, any>) {
  return item.submitTime || item.submittedAt || item.updatedAt || item.createTime || item.createdAt || '暂无时间'
}

function getDepartment(item: Record<string, any>) {
  return item.departmentName || item.department || item.deptName || '未填写科室'
}

function getPatientName(item: Record<string, any>) {
  return item.patientName || item.name || item.patientSnapshot?.name || '就诊人'
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

const detailSections = computed(() => [
  {
    title: '主诉',
    content: getDetailValue('chiefComplaint', 'result.chiefComplaint', 'report.chiefComplaint', 'summary', 'chiefComplaintText')
  },
  {
    title: '现病史',
    content: getDetailValue('presentIllness', 'result.presentIllness', 'report.presentIllness', 'presentIllnessText')
  },
  {
    title: '既往史',
    content: getDetailValue('pastHistory', 'result.pastHistory', 'report.pastHistory', 'pastHistoryText')
  },
  {
    title: '过敏史',
    content: getDetailValue('allergyHistory', 'result.allergyHistory', 'report.allergyHistory', 'allergyHistoryText')
  }
])

const answerList = computed(() => {
  return getArrayValue('answers', 'answerList', 'answerItems', 'questionAnswers')
})

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
  showDetail.value = true
  detailLoading.value = true
  recordDetail.value = null
  try {
    recordDetail.value = await getPreconsultRecordDetail(recordId)
  } catch (error) {
    showToast(error instanceof Error ? error.message : '记录详情加载失败')
  } finally {
    detailLoading.value = false
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
              <van-icon name="arrow" />
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
            <van-button v-if="currentRecord" size="small" plain type="primary" @click="refreshDetail">刷新</van-button>
          </div>
        </header>

        <van-loading v-if="detailLoading" class="detail-loading" size="24px">加载中</van-loading>

        <template v-else>
          <div class="detail-info">
            <div>
              <span>记录编号</span>
              <strong>{{ currentRecord ? currentRecord.consultationNo || getRecordId(currentRecord) : '-' }}</strong>
            </div>
            <div>
              <span>就诊人</span>
              <strong>{{ currentRecord ? getPatientName(currentRecord) : '-' }}</strong>
            </div>
          </div>

          <section class="detail-section" v-for="section in detailSections" :key="section.title">
            <h3>{{ section.title }}</h3>
            <p>{{ section.content || '暂无内容' }}</p>
          </section>

          <section v-if="answerList.length" class="detail-section">
            <h3>问答记录</h3>
            <div class="answer-list">
              <div v-for="(answer, index) in answerList" :key="index" class="answer-item">
                <strong>{{ answer.questionTitle || answer.title || `问题 ${index + 1}` }}</strong>
                <span>{{ answer.displayText || answer.answerText || answer.value?.text || '已回答' }}</span>
              </div>
            </div>
          </section>
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
</style>
