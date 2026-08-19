<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import AppNavBar from '@/components/AppNavBar.vue'
import { useConsultationStore } from '@/stores/consultation'
import type { ConsultationMode, PatientProfile } from '@/types/consultation'

const router = useRouter()
const store = useConsultationStore()
const submitting = ref(false)
const selectedMode = ref<ConsultationMode>(store.consultationMode || 'qa')
const form = reactive<PatientProfile>({
  ...store.profile,
  cardNo: store.profile.cardNo || createCardNo()
})

const modeOptions: Array<{
  value: ConsultationMode
  icon: string
  title: string
  desc: string
}> = [
  {
    value: 'qa',
    icon: 'chat-o',
    title: '智能问答',
    desc: '按问题逐步回答，生成结构化问诊记录'
  },
  {
    value: 'text',
    icon: 'edit',
    title: '自由描述',
    desc: '直接输入病情，系统辅助整理重点'
  },
  {
    value: 'voice',
    icon: 'volume-o',
    title: '语音自诉',
    desc: '录音描述病情，可转文字后确认'
  }
]

const actionText = computed(() => {
  if (selectedMode.value === 'text') return '开始自由描述'
  if (selectedMode.value === 'voice') return '开始语音自诉'
  return '进入智能问答'
})

function syncFormFromStore() {
  Object.assign(form, {
    ...store.profile,
    cardNo: store.profile.cardNo || form.cardNo || createCardNo()
  })
}

function createCardNo() {
  const seed = store.patientAuth?.patientId || store.patientAuth?.username || Date.now()
  let hash = 0
  for (const char of String(seed)) {
    hash = (hash * 31 + char.charCodeAt(0)) % 100000000
  }
  return `JZK${String(hash).padStart(8, '0')}`
}

async function next() {
  if (submitting.value) return

  if (!form.name || !form.gender || !form.age || !form.phone) {
    showToast('请完善姓名、性别、年龄和手机号')
    return
  }

  submitting.value = true
  try {
    if (!store.isLoggedIn) {
      router.push({ name: 'login', query: { redirect: '/profile' } })
      return
    }

    await store.saveProfile({ ...form })
    store.setConsultationMode(selectedMode.value)
    if (selectedMode.value === 'text') {
      router.push('/self-narration')
      return
    }
    if (selectedMode.value === 'voice') {
      router.push('/voice-narration')
      return
    }
    await store.loadQuestions()
    router.push('/consultation')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '登录失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (!store.isLoggedIn) return

  try {
    await store.loadCurrentPatientProfile()
    syncFormFromStore()
  } catch (error) {
    console.warn('刷新个人资料失败:', error)
  }
})
</script>

<template>
  <div class="page">
    <AppNavBar title="基本信息" back />
    <main class="page-body">
      <van-form class="surface form-panel">
        <van-field v-model="form.name" label="姓名" placeholder="请输入姓名" />
        <van-field label="性别">
          <template #input>
            <van-radio-group v-model="form.gender" direction="horizontal">
              <van-radio name="male">男</van-radio>
              <van-radio name="female">女</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-field
          :model-value="form.age ?? undefined"
          type="digit"
          label="年龄"
          placeholder="请输入年龄"
          @update:model-value="(val) => (form.age = val ? Number(val) : null)"
        />
        <van-field v-model="form.phone" type="tel" label="手机号" placeholder="请输入手机号" />
        <van-field v-model="form.idCard" label="身份证号" placeholder="可选" />
        <van-field v-model="form.cardNo" label="就诊卡号" readonly />
      </van-form>

      <section class="mode-panel">
        <h2>问诊方式</h2>
        <div class="mode-list">
          <button
            v-for="item in modeOptions"
            :key="item.value"
            type="button"
            class="mode-option"
            :class="{ 'mode-option--active': selectedMode === item.value }"
            @click="selectedMode = item.value"
          >
            <span class="mode-option__icon" aria-hidden="true">
              <van-icon :name="item.icon" />
            </span>
            <span class="mode-option__content">
              <strong>{{ item.title }}</strong>
              <small>{{ item.desc }}</small>
            </span>
            <van-icon class="mode-option__check" :name="selectedMode === item.value ? 'checked' : 'circle'" />
          </button>
        </div>
      </section>
    </main>

    <div class="fixed-action">
      <div class="fixed-action__inner">
        <van-button type="primary" block :loading="submitting" :disabled="submitting" @click="next">{{ actionText }}</van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-panel {
  overflow: hidden;
}

.mode-panel {
  margin-top: 14px;
}

.mode-panel h2 {
  margin: 0 0 10px;
  color: #1a2b45;
  font-size: 15px;
  font-weight: 800;
  line-height: 1.35;
}

.mode-list {
  display: grid;
  gap: 10px;
}

.mode-option {
  width: 100%;
  min-height: 72px;
  display: grid;
  grid-template-columns: 38px 1fr 22px;
  gap: 12px;
  align-items: center;
  border: 1px solid #e8eef7;
  border-radius: 8px;
  background: #fff;
  padding: 13px 14px;
  color: #1d2939;
  text-align: left;
  box-shadow: 0 8px 20px rgba(24, 39, 75, 0.05);
}

.mode-option--active {
  border-color: #3a93ff;
  background: #f2f7ff;
}

.mode-option__icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: #eef5ff;
  color: #2f7df6;
  font-size: 20px;
}

.mode-option__content {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.mode-option__content strong {
  font-size: 15px;
  line-height: 1.2;
}

.mode-option__content small {
  color: #7c8ca3;
  font-size: 12px;
  line-height: 1.45;
}

.mode-option__check {
  color: #3a93ff;
  font-size: 20px;
}
</style>
