<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  getRegistrationList,
  type RegistrationBackend
} from '@/api/consultation'
import AppNavBar from '@/components/AppNavBar.vue'
import { useConsultationStore } from '@/stores/consultation'
import type { Gender, VisitInfo } from '@/types/consultation'

interface PickerOption {
  text?: string | number
  value?: string | number
}

const router = useRouter()
const store = useConsultationStore()
const form = reactive<VisitInfo>({ ...store.visitInfo })
const showRegistrationPicker = ref(false)
const loadingRegistrations = ref(false)
const registrations = ref<RegistrationBackend[]>([])
const registrationColumns = computed(() =>
  registrations.value.map((reg) => ({
    text: `${reg.regNo} · ${reg.patientName} · ${reg.departmentName}`,
    value: reg.regNo
  }))
)
const selectedRegistration = computed(() =>
  registrations.value.find((reg) => reg.regNo === form.regNo)
)

function mapGender(gender: string): Gender | '' {
  const upper = (gender || '').toUpperCase()
  if (upper === 'M' || upper === 'MALE') return 'male'
  if (upper === 'F' || upper === 'FEMALE') return 'female'
  return ''
}

async function loadRegistrations() {
  loadingRegistrations.value = true
  try {
    registrations.value = await getRegistrationList()
    if (!registrations.value.length) {
      showToast('挂号单列表为空，请确认后端服务已启动')
    }
  } finally {
    loadingRegistrations.value = false
  }
}

function chooseRegistration({ selectedOptions }: { selectedOptions: PickerOption[] }) {
  const regNo = selectedOptions[0]?.value ? String(selectedOptions[0].value) : ''
  const reg = registrations.value.find((item) => item.regNo === regNo)
  showRegistrationPicker.value = false
  if (!reg) return

  // 挂号数据自动带出就诊信息与患者身份，作为预问诊的业务主键
  form.regNo = reg.regNo
  form.appointmentNo = reg.regNo
  form.department = reg.departmentName
  form.departmentId = String(reg.departmentId)
  form.doctor = reg.doctorName
  form.visitTime = reg.visitTime
  form.visitType = (reg.visitType || '').toUpperCase() === 'RETURN' ? 'return' : 'first'
}

async function next() {
  const reg = selectedRegistration.value
  if (!reg) {
    showToast('请选择挂号单')
    return
  }

  await store.saveVisitInfo({ ...form })
  // 患者身份来自挂号数据，不再手工填写
  await store.saveProfile({
    name: reg.patientName,
    gender: mapGender(reg.gender),
    age: reg.age ?? null,
    phone: reg.phone || '',
    idCard: store.profile.idCard || '',
    cardNo: store.profile.cardNo || ''
  })
  await store.loadQuestions()
  router.push('/consultation')
}

onMounted(() => {
  loadRegistrations()
})
</script>

<template>
  <div class="page">
    <AppNavBar title="就诊信息" back />
    <main class="page-body">
      <van-form class="surface form-panel">
        <van-field
          :model-value="form.regNo"
          label="挂号单"
          placeholder="请选择挂号单"
          readonly
          is-link
          @click="showRegistrationPicker = true"
        />
        <template v-if="selectedRegistration">
          <van-field :model-value="selectedRegistration.patientName" label="姓名" readonly />
          <van-field
            :model-value="mapGender(selectedRegistration.gender) === 'male' ? '男' : '女'"
            label="性别"
            readonly
          />
          <van-field :model-value="String(selectedRegistration.age)" label="年龄" readonly />
          <van-field :model-value="selectedRegistration.phone" label="手机号" readonly />
          <van-field :model-value="form.department" label="科室" readonly />
          <van-field :model-value="form.doctor" label="医生" readonly />
          <van-field
            :model-value="form.visitType === 'first' ? '初诊' : '复诊'"
            label="就诊类型"
            readonly
          />
          <van-field :model-value="form.visitTime" label="就诊时间" readonly />
        </template>
      </van-form>
    </main>

    <div class="fixed-action">
      <div class="fixed-action__inner">
        <van-button type="primary" block @click="next">进入问诊</van-button>
      </div>
    </div>

    <van-popup v-model:show="showRegistrationPicker" round position="bottom">
      <van-picker
        title="选择挂号单"
        :columns="registrationColumns"
        :loading="loadingRegistrations"
        @cancel="showRegistrationPicker = false"
        @confirm="chooseRegistration"
      />
    </van-popup>
  </div>
</template>

<style scoped>
.form-panel {
  overflow: hidden;
}
</style>
