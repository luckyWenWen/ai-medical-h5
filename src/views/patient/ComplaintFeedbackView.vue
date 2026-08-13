<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { showToast } from 'vant'
import AppNavBar from '@/components/AppNavBar.vue'
import {
  getMyPreconsultFeedbackList,
  submitPreconsultFeedback,
  type PreconsultFeedbackCategory,
  type PreconsultFeedbackItem
} from '@/api/consultation'

const submitting = ref(false)
const loading = ref(false)
const records = ref<PreconsultFeedbackItem[]>([])

const categoryOptions: Array<{ label: string; value: PreconsultFeedbackCategory }> = [
  { label: '建议', value: 'SUGGESTION' },
  { label: '投诉', value: 'COMPLAINT' },
  { label: '其他', value: 'OTHER' }
]

const categoryText: Record<PreconsultFeedbackCategory, string> = {
  COMPLAINT: '投诉',
  SUGGESTION: '建议',
  OTHER: '其他'
}

const form = reactive({
  title: '',
  category: 'SUGGESTION' as PreconsultFeedbackCategory,
  content: '',
  attachmentUrls: '',
  phone: '',
  patientName: ''
})

const totalCount = computed(() => records.value.length)
const complaintCount = computed(() => records.value.filter((item) => item.category === 'COMPLAINT').length)

function getFeedbackId(item: PreconsultFeedbackItem) {
  return String(item.feedbackNo || item.feedbackId || item.id || item.createTime || item.createdAt || '')
}

function getCategoryText(category?: string) {
  const key = String(category || 'OTHER').toUpperCase() as PreconsultFeedbackCategory
  return categoryText[key] || '其他'
}

function getDisplayTime(item: PreconsultFeedbackItem) {
  return item.createdAt || item.createTime || item.updatedAt || item.updateTime || '暂无时间'
}

function getStatusText(item: PreconsultFeedbackItem) {
  const status = String(item.status || '').toUpperCase()
  if (item.statusText || item.statusName) return item.statusText || item.statusName || ''
  if (status === 'PENDING' || status === 'WAITING' || status === 'TODO') return '待处理'
  if (status === 'PROCESSING' || status === 'IN_PROGRESS') return '处理中'
  if (status === 'REPLIED' || status === 'FINISHED' || status === 'RESOLVED') return '已反馈'
  if (status === 'CLOSED') return '已关闭'
  return '已提交'
}

function getStatusType(item: PreconsultFeedbackItem): 'primary' | 'success' | 'warning' | 'danger' {
  const text = getStatusText(item)
  if (text.includes('反馈') || text.includes('完成') || text.includes('关闭')) return 'success'
  if (text.includes('处理')) return 'warning'
  if (text.includes('投诉')) return 'danger'
  return 'primary'
}

function resetForm() {
  form.title = ''
  form.category = 'SUGGESTION'
  form.content = ''
  form.attachmentUrls = ''
  form.phone = ''
  form.patientName = ''
}

async function loadRecords() {
  loading.value = true
  try {
    records.value = await getMyPreconsultFeedbackList()
  } catch (error) {
    records.value = []
    showToast(error instanceof Error ? error.message : '历史反馈加载失败')
  } finally {
    loading.value = false
  }
}

async function submitFeedback() {
  if (submitting.value) return

  const title = form.title.trim()
  const content = form.content.trim()
  if (!title) {
    showToast('请填写反馈标题')
    return
  }
  if (!content) {
    showToast('请填写反馈内容')
    return
  }

  submitting.value = true
  try {
    await submitPreconsultFeedback({
      title,
      category: form.category,
      content,
      attachmentUrls: form.attachmentUrls.trim() || undefined,
      phone: form.phone.trim() || undefined,
      patientName: form.patientName.trim() || undefined
    })
    showToast('反馈已提交')
    resetForm()
    await loadRecords()
  } catch (error) {
    showToast(error instanceof Error ? error.message : '反馈提交失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

onMounted(loadRecords)
</script>

<template>
  <div class="page feedback-page">
    <AppNavBar title="投诉与反馈" back />

    <main class="feedback-body">
      <!-- <section class="feedback-summary">
        <div>
          <span>历史反馈</span>
          <strong>{{ totalCount }}</strong>
        </div>
        <div>
          <span>投诉记录</span>
          <strong>{{ complaintCount }}</strong>
        </div>
      </section> -->

      <section class="feedback-card">
        <van-field
          v-model="form.title"
          label="标题"
          maxlength="60"
          required
          clearable
          placeholder="例如：建议优化问诊题目"
        />

        <van-field label="类型" required>
          <template #input>
            <van-radio-group v-model="form.category" direction="horizontal" class="category-group">
              <van-radio
                v-for="item in categoryOptions"
                :key="item.value"
                :name="item.value"
              >
                {{ item.label }}
              </van-radio>
            </van-radio-group>
          </template>
        </van-field>

        <van-field
          v-model="form.content"
          class="feedback-field"
          type="textarea"
          rows="5"
          maxlength="500"
          show-word-limit
          required
          label="内容"
          placeholder="请描述您遇到的问题、发生时间或希望改进的地方"
        />

        <van-field
          v-model="form.attachmentUrls"
          label="附件"
          type="textarea"
          rows="2"
          maxlength="500"
          autosize
          placeholder="可填写图片或文档链接，多个用逗号分隔"
        />
        <van-field v-model="form.patientName" label="姓名" maxlength="30" clearable placeholder="可选" />
        <van-field v-model="form.phone" type="tel" label="电话" maxlength="20" clearable placeholder="可选" />

        <van-button
          class="submit-button"
          type="primary"
          block
          :loading="submitting"
          :disabled="submitting"
          @click="submitFeedback"
        >
          提交反馈
        </van-button>
      </section>

      <section class="records-section">
        <h2>历史反馈</h2>
        <van-pull-refresh v-model="loading" @refresh="loadRecords">
          <van-empty v-if="!loading && !records.length" description="暂无反馈记录" />

          <div v-else class="record-list">
            <article
              v-for="(record, index) in records"
              :key="getFeedbackId(record) || index"
              class="record-card"
            >
              <div class="record-card__head">
                <div>
                  <strong>{{ record.title || getCategoryText(record.category) }}</strong>
                  <span>{{ getCategoryText(record.category) }} · {{ getDisplayTime(record) }}</span>
                </div>
                <van-tag :type="getStatusType(record)" round>{{ getStatusText(record) }}</van-tag>
              </div>
              <p>{{ record.content || '暂无反馈内容' }}</p>
              <p v-if="record.replyContent" class="record-card__reply">
                回复：{{ record.replyContent }}
              </p>
              <div v-if="record.attachmentUrls" class="record-card__foot">
                附件：{{ record.attachmentUrls }}
              </div>
            </article>
          </div>
        </van-pull-refresh>
      </section>
    </main>
  </div>
</template>

<style scoped>
.feedback-page {
  min-height: 100vh;
  background: #f6f8fb;
}

.feedback-body {
  width: min(100%, 520px);
  margin: 0 auto;
  padding: 12px 12px calc(32px + env(safe-area-inset-bottom));
}

.feedback-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

.feedback-summary div {
  min-width: 0;
  border-radius: 8px;
  background: linear-gradient(135deg, #2488fa 0%, #57b7ff 100%);
  padding: 14px;
  color: #fff;
}

.feedback-summary div:last-child {
  background: linear-gradient(135deg, #12b981 0%, #60d394 100%);
}

.feedback-summary span {
  display: block;
  font-size: 12px;
  opacity: 0.9;
}

.feedback-summary strong {
  display: block;
  margin-top: 8px;
  font-size: 25px;
  line-height: 1;
}

.feedback-card,
.record-card {
  border: 1px solid #e8eef7;
  border-radius: 8px;
  background: #fff;
}

.feedback-card {
  overflow: hidden;
  box-shadow: 0 8px 20px rgba(24, 39, 75, 0.06);
}

.feedback-card :deep(.van-field__label) {
  width: 64px;
  color: #17233c;
  font-size: 14px;
}

.category-group {
  gap: 14px;
}

.feedback-field :deep(.van-field__control) {
  min-height: 108px;
  color: #17233c;
  font-size: 14px;
  line-height: 1.65;
}

.feedback-field :deep(.van-field__word-limit) {
  color: #667085;
  font-size: 11px;
}

.submit-button {
  height: 40px;
  margin: 14px 12px 13px;
  width: calc(100% - 24px);
  border-radius: 8px;
  font-size: 16px;
  font-weight: 700;
}

.records-section {
  margin-top: 16px;
}

.records-section h2 {
  margin: 18px 0 10px;
  color: #1a2b45;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.35;
}

.record-list {
  display: grid;
  gap: 10px;
}

.record-card {
  padding: 13px;
  box-shadow: 0 8px 20px rgba(24, 39, 75, 0.06);
}

.record-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.record-card strong {
  display: block;
  color: #13233b;
  font-size: 14px;
  line-height: 1.35;
  word-break: break-word;
}

.record-card span {
  display: block;
  margin-top: 4px;
  color: #8b9bb0;
  font-size: 12px;
}

.record-card :deep(.van-tag) {
  flex: 0 0 auto;
  max-width: 72px;
  min-height: 24px;
  justify-content: center;
  padding: 0 8px;
  text-align: center;
  white-space: normal;
  color:#fff;
  line-height: 24px;
}

.record-card p {
  margin: 10px 0 0;
  color: #243954;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.record-card__reply {
  border-radius: 8px;
  background: #f6f8fb;
  padding: 9px 10px;
}

.record-card__foot {
  margin-top: 10px;
  color: #667085;
  font-size: 12px;
  line-height: 1.55;
  word-break: break-all;
}
</style>
