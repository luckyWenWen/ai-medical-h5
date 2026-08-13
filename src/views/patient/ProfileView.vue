<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import AppNavBar from '@/components/AppNavBar.vue'
import { useConsultationStore } from '@/stores/consultation'
import type { PatientProfile } from '@/types/consultation'

const router = useRouter()
const store = useConsultationStore()
const submitting = ref(false)
const form = reactive<PatientProfile>({
  ...store.profile,
  cardNo: store.profile.cardNo || createCardNo()
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
    </main>

    <div class="fixed-action">
      <div class="fixed-action__inner">
        <van-button type="primary" block :loading="submitting" :disabled="submitting" @click="next">进入问诊</van-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form-panel {
  overflow: hidden;
}
</style>
