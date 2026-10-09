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
import { isSelectableDepartment, isSelectableDoctor } from '@/api/directory'
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
const submitting = ref(false)
const departmentKeyword = ref('')
const departments = ref<DepartmentOption[]>([])
const doctors = ref<DoctorOption[]>([])
const filteredDepartments = computed(() => {
  const keyword = departmentKeyword.value.trim().toLowerCase()
  if (!keyword) return departments.value

  return departments.value.filter((department) => {
    const label = department.label.toLowerCase()
    const value = String(department.value).toLowerCase()
    return label.includes(keyword) || value.includes(keyword)
  })
})
const departmentColumns = computed(() =>
  filteredDepartments.value.map((department) => ({
    text: formatOptionText(department.label, department.disabled, department.disabledReason),
    value: department.value,
    disabled: Boolean(department.disabled)
  }))
)
const doctorColumns = computed(() =>
  doctors.value.map((doctor) => ({
    text: formatOptionText(doctor.label, doctor.disabled, doctor.disabledReason),
    value: doctor.value,
    disabled: Boolean(doctor.disabled)
  }))
)

/** 禁用条目照常展示并在文案中标注原因（如“暂未配置预问诊模板”“未关联医生账号”） */
function formatOptionText(label: string, disabled?: boolean, disabledReason?: string | null) {
  return disabled ? `${label}（${disabledReason || '暂不可选'}）` : label
}

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

async function loadDoctors(department: string, departmentId?: string | number | null) {
  if (!department) {
    doctors.value = []
    return
  }

  loadingDoctors.value = true

  try {
    doctors.value = await getDoctorList(department, departmentId ?? form.departmentId)
  } catch (error) {
    doctors.value = []
    showToast(error instanceof Error ? error.message : '医生列表加载失败')
  } finally {
    loadingDoctors.value = false
  }
}

function chooseDepartment({ selectedOptions }: { selectedOptions: PickerOption[] }) {
  const picked = selectedOptions[0]
  if (!picked) {
    showToast('未找到匹配科室')
    return
  }

  // 以展示键反查完整字典条目；提交使用的业务 ID 只能来自条目的 departmentId
  const selected = departments.value.find((department) => department.value === String(picked.value ?? ''))
  if (!selected) {
    showToast('未找到匹配科室')
    return
  }
  if (!isSelectableDepartment(selected)) {
    showToast(selected.disabledReason || '该科室暂不可选')
    return
  }

  const hadDoctor = Boolean(form.doctor || form.doctorId)
  form.department = selected.label
  form.departmentId = String(selected.departmentId || '')
  // 换科室后旧医生不跨科室沿用，必须按新科室重新选择
  form.doctor = ''
  form.doctorId = ''
  showDepartmentPicker.value = false
  departmentKeyword.value = ''
  if (hadDoctor) {
    showToast('科室已变更，请重新选择医生')
  }
  loadDoctors(form.department, form.departmentId)
}

function openDoctorPicker() {
  if (!form.department) {
    showToast('请先选择科室')
    return
  }

  showDoctorPicker.value = true
}

function chooseDoctor({ selectedOptions }: { selectedOptions: PickerOption[] }) {
  const picked = selectedOptions[0]
  const selected = doctors.value.find((doctor) => doctor.value === String(picked?.value ?? ''))
  if (!selected) {
    showToast('未找到匹配医生')
    return
  }
  // 旧固定医生/禁用条目仅展示：不可选，也不得把展示键回填为 doctorId
  if (!isSelectableDoctor(selected)) {
    showToast(selected.disabledReason || '该医生暂不可选，请重新选择')
    return
  }

  form.doctor = selected.label
  form.doctorId = String(selected.doctorId || '')
  showDoctorPicker.value = false
}

async function next() {
  if (submitting.value) return

  if (!form.department) {
    showToast('请选择科室')
    return
  }

  // 提交前再校验：业务 ID 必须是预问诊科室 ID，展示键不得当作 departmentId 提交
  if (!isSelectableDepartment({ disabled: false, departmentId: form.departmentId })) {
    showToast('请选择有效科室')
    return
  }
  const selectedDepartment = departments.value.find((department) => department.departmentId === form.departmentId)
  if (departments.value.length > 0 && (!selectedDepartment || !isSelectableDepartment(selectedDepartment))) {
    showToast(selectedDepartment?.disabledReason || '当前科室暂不可选，请重新选择')
    return
  }

  if (!form.doctor) {
    showToast('请选择医生')
    return
  }

  // 提交前再校验：仅真实有效医生可提交；旧存档缺少 doctorId 时必须重新选择
  if (!form.doctorId) {
    showToast('请选择有效医生')
    return
  }
  const selectedDoctor = doctors.value.find((doctor) => doctor.doctorId === form.doctorId)
  if (doctors.value.length > 0 && (!selectedDoctor || !isSelectableDoctor(selectedDoctor))) {
    showToast('所选医生暂不可用，请重新选择')
    return
  }

  submitting.value = true
  try {
    if (!store.isLoggedIn) {
      router.push({ name: 'login', query: { redirect: '/visit' } })
      return
    }

    await store.saveVisitInfo({ ...form })
    router.push('/profile')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '登录失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadDepartments()
  loadDoctors(form.department, form.departmentId)
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
        <van-button type="primary" block :loading="submitting" :disabled="submitting" @click="next">下一步</van-button>
      </div>
    </div>

    <van-popup
      v-model:show="showDepartmentPicker"
      round
      position="bottom"
      @closed="departmentKeyword = ''"
    >
      <van-search
        v-model="departmentKeyword"
        class="department-search"
        shape="round"
        placeholder="搜索科室"
      />
      <van-picker
        v-if="loadingDepartments || departmentColumns.length"
        title="选择科室"
        :columns="departmentColumns"
        :loading="loadingDepartments"
        @cancel="showDepartmentPicker = false"
        @confirm="chooseDepartment"
      />
      <div v-else class="department-empty">
        未找到匹配科室
      </div>
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

.department-search {
  padding-top: 12px;
  padding-bottom: 4px;
}

.department-empty {
  min-height: 180px;
  display: grid;
  place-items: center;
  color: var(--theme-text-muted);
  font-size: 14px;
}
</style>
