<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  getDepartmentList,
  getDoctorList,
  type DepartmentOption,
  type DoctorOption
} from '@/api/consultation'
import AppNavBar from '@/components/AppNavBar.vue'
import { useConsultationStore } from '@/stores/consultation'
import type { VisitInfo } from '@/types/consultation'

interface PickerOption {
  text?: string | number
  value?: string | number
}

const router = useRouter()
const store = useConsultationStore()
const form = reactive<VisitInfo>({
  ...store.visitInfo,
  appointmentNo: store.visitInfo.appointmentNo || createAppointmentNo(),
  visitTime: store.visitInfo.visitTime || formatDateTime(new Date())
})
const showDepartmentPicker = ref(false)
const showDoctorPicker = ref(false)
const loadingDepartments = ref(false)
const loadingDoctors = ref(false)
const departments = ref<DepartmentOption[]>([])
const doctors = ref<DoctorOption[]>([])
const departmentColumns = computed(() =>
  departments.value.map((department) => ({
    text: department.label,
    value: department.value
  }))
)
const doctorColumns = computed(() =>
  doctors.value.map((doctor) => ({
    text: doctor.label,
    value: doctor.value
  }))
)

function padTime(value: number) {
  return String(value).padStart(2, '0')
}

function formatDateTime(date: Date) {
  const year = date.getFullYear()
  const month = padTime(date.getMonth() + 1)
  const day = padTime(date.getDate())
  const hour = padTime(date.getHours())
  const minute = padTime(date.getMinutes())

  return `${year}-${month}-${day} ${hour}:${minute}`
}

function createAppointmentNo() {
  const now = new Date()
  const date = `${now.getFullYear()}${padTime(now.getMonth() + 1)}${padTime(now.getDate())}`

  return `GH${date}${String(now.getTime()).slice(-6)}`
}

async function loadDepartments() {
  loadingDepartments.value = true

  try {
    departments.value = await getDepartmentList()
  } catch (error) {
    showToast(error instanceof Error ? error.message : '科室列表加载失败')
  } finally {
    loadingDepartments.value = false
  }
}

async function loadDoctors(department: string) {
  if (!department) {
    doctors.value = []
    return
  }

  loadingDoctors.value = true

  try {
    doctors.value = await getDoctorList(department)
  } catch (error) {
    doctors.value = []
    showToast(error instanceof Error ? error.message : '医生列表加载失败')
  } finally {
    loadingDoctors.value = false
  }
}

function chooseDepartment({ selectedOptions }: { selectedOptions: PickerOption[] }) {
  form.department = selectedOptions[0]?.text ? String(selectedOptions[0].text) : ''
  form.departmentId = selectedOptions[0]?.value ? String(selectedOptions[0].value) : ''
  form.doctor = ''
  showDepartmentPicker.value = false
  loadDoctors(form.department)
}

function openDoctorPicker() {
  if (!form.department) {
    showToast('请先选择科室')
    return
  }

  showDoctorPicker.value = true
}

function chooseDoctor({ selectedOptions }: { selectedOptions: PickerOption[] }) {
  form.doctor = selectedOptions[0]?.text ? String(selectedOptions[0].text) : ''
  showDoctorPicker.value = false
}

function next() {
  if (!form.department) {
    showToast('请选择科室')
    return
  }

  if (!form.doctor) {
    showToast('请选择医生')
    return
  }

  store.saveVisitInfo({ ...form })
  router.push('/profile')
}

onMounted(() => {
  loadDepartments()
  loadDoctors(form.department)
})
</script>

<template>
  <div class="page">
    <AppNavBar title="就诊信息" back />
    <main class="page-body">
      <van-form class="surface form-panel">
        <van-field label="就诊类型">
          <template #input>
            <van-radio-group v-model="form.visitType" direction="horizontal">
              <van-radio name="first">初诊</van-radio>
              <van-radio name="return">复诊</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-field
          v-model="form.department"
          label="科室"
          placeholder="请选择科室"
          readonly
          is-link
          @click="showDepartmentPicker = true"
        />
        <van-field
          v-model="form.doctor"
          label="医生"
          placeholder="请选择医生"
          readonly
          is-link
          @click="openDoctorPicker"
        />
        <van-field v-model="form.appointmentNo" label="挂号单号" readonly />
        <van-field v-model="form.visitTime" label="就诊时间" readonly />
      </van-form>
    </main>

    <div class="fixed-action">
      <div class="fixed-action__inner">
        <van-button type="primary" block @click="next">下一步</van-button>
      </div>
    </div>

    <van-popup v-model:show="showDepartmentPicker" round position="bottom">
      <van-picker
        title="选择科室"
        :columns="departmentColumns"
        :loading="loadingDepartments"
        @cancel="showDepartmentPicker = false"
        @confirm="chooseDepartment"
      />
    </van-popup>

    <van-popup v-model:show="showDoctorPicker" round position="bottom">
      <van-picker
        title="选择医生"
        :columns="doctorColumns"
        :loading="loadingDoctors"
        @cancel="showDoctorPicker = false"
        @confirm="chooseDoctor"
      />
    </van-popup>
  </div>
</template>

<style scoped>
.form-panel {
  overflow: hidden;
}
</style>
