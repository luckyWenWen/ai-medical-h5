<script setup lang="ts">
import { reactive, ref } from 'vue'
import { showToast } from 'vant'
import AppNavBar from '@/components/AppNavBar.vue'

interface FeedbackRecord {
  id: string
  category: string
  content: string
  createdAt: string
  status: 'pending' | 'processing' | 'replied'
}

const submitting = ref(false)

const statusText: Record<FeedbackRecord['status'], string> = {
  pending: '待处理',
  processing: '处理中',
  replied: '已反馈'
}

const statusType: Record<FeedbackRecord['status'], 'danger' | 'warning' | 'success'> = {
  pending: 'danger',
  processing: 'warning',
  replied: 'success'
}

const form = reactive({
  content: ''
})

const records = ref<FeedbackRecord[]>([
  {
    id: 'FK20260812001',
    category: '资料上传',
    content: '上传检查报告后，希望可以在报告页看到更清晰的预览。',
    createdAt: '2026-08-12 09:20',
    status: 'processing'
  },
  {
    id: 'FK20260809003',
    category: '问诊服务',
    content: '问诊问题比较清楚，希望增加返回上一题的入口。',
    createdAt: '2026-08-09 15:48',
    status: 'replied'
  }
])

function submitFeedback() {
  if (submitting.value) return
  if (!form.content.trim()) {
    showToast('请填写反馈内容')
    return
  }

  submitting.value = true
  window.setTimeout(() => {
    records.value.unshift({
      id: `FK${Date.now().toString().slice(-10)}`,
      category: '反馈内容',
      content: form.content.trim(),
      createdAt: '刚刚',
      status: 'pending'
    })
    form.content = ''
    submitting.value = false
    showToast('反馈已提交')
  }, 350)
}
</script>

<template>
  <div class="page feedback-page">
    <AppNavBar title="投诉与反馈" back />

    <main class="feedback-body">
      <section class="feedback-card">
        <van-field
          v-model="form.content"
          class="feedback-field"
          type="textarea"
          rows="5"
          maxlength="500"
          show-word-limit
          label="反馈内容"
          placeholder="请描述您遇到的问题、发生时间或希望改进的地方"
        />

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
        <h2>最近反馈</h2>
        <article v-for="record in records" :key="record.id" class="record-card">
          <div class="record-card__head">
            <div>
              <strong>{{ record.category }}</strong>
              <span>{{ record.id }} · {{ record.createdAt }}</span>
            </div>
            <van-tag :type="statusType[record.status]" round>{{ statusText[record.status] }}</van-tag>
          </div>
          <p>{{ record.content }}</p>
        </article>
      </section>
    </main>
  </div>
</template>

<style scoped>
.feedback-page {
  min-height: 100vh;
  background:
    linear-gradient(180deg, #f3f7fd 0%, #f7f9fc 44%, #f7f9fc 100%);
}

.feedback-body {
  width: min(100%, 520px);
  margin: 0 auto;
  padding: 14px 16px calc(32px + env(safe-area-inset-bottom));
}

.feedback-card,
.record-card {
  border: 1px solid #e4ebf5;
  border-radius: 8px;
  background: #fff;
}

.feedback-card {
  padding: 10px 12px 13px;
  box-shadow: 0 14px 30px rgba(65, 154, 254, 0.08);
}

.records-section h2 {
  margin: 18px 0 10px;
  color: #1a2b45;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.35;
}

.feedback-field {
  overflow: hidden;
  min-height: 148px;
  border: 1px solid #dfe8f4;
  border-radius: 8px;
  padding-top: 7px;
  background: #fff;
}

.feedback-field :deep(.van-field__label) {
  width: 76px;
  color: #17233c;
  font-size: 14px;
}

.feedback-field :deep(.van-field__control) {
  min-height: 108px;
  color: #17233c;
  font-size: 14px;
  line-height: 1.65;
}

.feedback-field :deep(.van-field__word-limit) {
  color: #39475f;
  font-size: 11px;
}

.submit-button {
  height: 40px;
  margin-top: 14px;
  border-radius: 999px;
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 12px 22px rgba(36, 136, 250, 0.2);
}

.records-section {
  margin-top: 16px;
}

.record-card {
  position: relative;
  overflow: hidden;
  padding: 13px 52px 13px 13px;
}

.record-card + .record-card {
  margin-top: 10px;
}

.record-card__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.record-card strong {
  display: block;
  color: #13233b;
  font-size: 14px;
  line-height: 1.25;
}

.record-card span {
  display: block;
  margin-top: 4px;
  color: #666;
  font-size: 11px;
}

.record-card :deep(.van-tag) {
  position: absolute;
  top: 10px;
  right: 8px;
  width: 54px;
  height: 34px;
  line-height: 34px;
  justify-content: center;
  border-radius:8px;
  padding: 0;
  white-space: normal;
  text-align: center;
  font-size: 12px;
  color:#fff
}

.record-card p {
  margin: 10px 0 0;
  color: #243954;
  font-size: 13px;
  line-height: 1.65;
}
</style>
