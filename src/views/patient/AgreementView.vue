<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { http } from '@/api/request'

const route = useRoute()
const router = useRouter()
const isPrivacy = computed(() => route.name === 'privacy-agreement')
const title = computed(() => (isPrivacy.value ? '隐私协议' : '服务协议'))

interface AgreementData {
  title?: string
  content?: string
  htmlContent?: string
  agreementContent?: string
  body?: string
  updatedAt?: string
  updateTime?: string
  publishTime?: string
  version?: string
  [key: string]: unknown
}

const loading = ref(false)
const agreement = ref<AgreementData | null>(null)

const agreementType = computed(() => (isPrivacy.value ? 'PRIVACY_POLICY' : 'SERVICE_AGREEMENT'))
const apiPath = computed(() => `/preconsult/client/agreements/${agreementType.value}`)
const agreementTitle = computed(() => agreement.value?.title || title.value)
const updatedText = computed(() => {
  const data = agreement.value
  return data?.updatedAt || data?.updateTime || data?.publishTime || '更新日期：暂无'
})
const agreementHtml = computed(() => {
  const data = agreement.value
  const raw = data?.content || data?.htmlContent || data?.agreementContent || data?.body || ''
  return raw || fallbackHtml.value
})

const fallbackHtml = computed(() =>
  isPrivacy.value
    ? `<h2>一、我们如何收集信息</h2><p>为了向您提供智能预问诊服务，我们可能收集您的手机号、姓名、性别、年龄、就诊信息、症状描述及您主动上传的检查资料。</p><h2>二、我们如何使用信息</h2><p>我们仅在提供预问诊、生成就诊前信息摘要、改善服务及保障系统安全所必需的范围内使用相关信息。</p>`
    : `<h2>一、服务说明</h2><p>智能预问诊用于就诊前收集和整理健康信息，帮助医务人员更高效地了解您的情况。本服务不能替代医生面诊、检查或诊断。</p><h2>二、用户使用规范</h2><p>您应当使用本人真实、准确的信息，不得冒用他人身份，不得提交虚假、违法或侵害他人权益的内容。</p>`
)

async function loadAgreement() {
  loading.value = true
  try {
    agreement.value = await http.get<AgreementData>(apiPath.value)
  } catch (error) {
    agreement.value = null
    showToast(error instanceof Error ? error.message : '协议加载失败，已显示默认内容')
  } finally {
    loading.value = false
  }
}

watch(apiPath, loadAgreement)
onMounted(loadAgreement)
</script>

<template>
  <div class="agreement-page">
    <van-nav-bar
      class="safe-top"
      :title="title"
      left-arrow
      fixed
      placeholder
      @click-left="router.back()"
    />

    <main class="agreement-content">
      <h1>{{ agreementTitle }}</h1>
      <p class="agreement-updated">{{ updatedText }}</p>
      <van-loading v-if="loading" class="agreement-loading" size="24px">加载中</van-loading>
      <article v-else class="agreement-html" v-html="agreementHtml"></article>
    </main>
  </div>
</template>

<style scoped>
.agreement-page {
  min-height: 100vh;
  background: #fff;
}

.agreement-content {
  width: min(100%, 620px);
  margin: 0 auto;
  padding: 22px 20px calc(32px + env(safe-area-inset-bottom));
}

.agreement-content h1 {
  margin: 0;
  color: #202b3f;
  font-size: 21px;
  line-height: 1.4;
}

.agreement-updated {
  margin: 8px 0 26px;
  color: #a5afbe;
  font-size: 12px;
}

.agreement-loading {
  margin-top: 20px;
  justify-content: center;
}

.agreement-html {
  color: #617084;
  font-size: 13px;
  line-height: 1.9;
  text-align: justify;
}

.agreement-html :deep(h2) {
  margin: 22px 0 9px;
  color: #26344a;
  font-size: 15px;
  line-height: 1.5;
}

.agreement-html :deep(p) {
  margin: 0;
}
</style>
