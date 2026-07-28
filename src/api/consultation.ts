import { http } from '@/api/request'
import { consultationQuestions } from '@/mock/questions'
import type { ConsultationQuestion, ConsultationReport, QuestionType } from '@/types/consultation'

export interface DoctorOption {
  label: string
  value: string
}

export interface DepartmentOption {
  label: string
  value: string
  doctors: DoctorOption[]
}

export interface PreconsultRecordViewBackend {
  recordId: string
  recordVersion: number
  status: string
  readOnly?: boolean
  questions?: BackendQuestionItem[]
  answers?: any[]
  nextTemplateQuestionId?: string
  progress?: {
    answeredCount?: number
    totalCount?: number
    percentage?: number
  }
}

export interface BackendQuestionItem {
  templateQuestionId: string | number
  type: string
  title: string
  required?: boolean
  skippable?: boolean
  options?: Array<{
    code?: string
    label?: string
    value?: string
  }>
  config?: {
    placeholder?: string
    unit?: string
    allowUnknown?: boolean
  }
}

const mockDepartments: DepartmentOption[] = [
  {
    label: '呼吸内科',
    value: 'respiratory',
    doctors: [
      { label: '张文静', value: 'zhang-wenjing' },
      { label: '李明远', value: 'li-mingyuan' },
      { label: '周海峰', value: 'zhou-haifeng' }
    ]
  },
  {
    label: '消化内科',
    value: 'gastroenterology',
    doctors: [
      { label: '王雪', value: 'wang-xue' },
      { label: '陈立', value: 'chen-li' },
      { label: '赵宁', value: 'zhao-ning' }
    ]
  },
  {
    label: '心血管内科',
    value: 'cardiology',
    doctors: [
      { label: '刘清', value: 'liu-qing' },
      { label: '孙一鸣', value: 'sun-yiming' },
      { label: '高然', value: 'gao-ran' }
    ]
  },
  {
    label: '儿科',
    value: 'pediatrics',
    doctors: [
      { label: '何佳', value: 'he-jia' },
      { label: '许安安', value: 'xu-anan' },
      { label: '唐悦', value: 'tang-yue' }
    ]
  },
  {
    label: '骨科',
    value: 'orthopedics',
    doctors: [
      { label: '马建国', value: 'ma-jianguo' },
      { label: '秦磊', value: 'qin-lei' },
      { label: '傅岩', value: 'fu-yan' }
    ]
  }
]

function mapBackendTypeToFrontend(type: string): QuestionType {
  const upper = (type || '').toUpperCase()
  if (upper.includes('SINGLE')) return 'single'
  if (upper.includes('MULTI')) return 'multi'
  if (upper.includes('TEXT')) return 'text'
  if (upper.includes('NUMBER') || upper.includes('SCALE')) return 'number'
  if (upper.includes('DATE')) return 'date'
  if (upper.includes('UPLOAD')) return 'upload'
  return 'text'
}

export function convertBackendQuestionToFrontend(q: BackendQuestionItem): ConsultationQuestion {
  return {
    id: String(q.templateQuestionId),
    title: q.title,
    type: mapBackendTypeToFrontend(q.type),
    backendType: (q.type || '').toUpperCase(),
    required: q.required ?? true,
    allowUnknown: q.config?.allowUnknown ?? true,
    placeholder: q.config?.placeholder,
    unit: q.config?.unit,
    options: (q.options || []).map((opt) => ({
      label: opt.label || String(opt.value || opt.code || ''),
      value: opt.value || opt.code || opt.label || ''
    }))
  }
}

export async function getConsultationQuestions(): Promise<ConsultationQuestion[]> {
  try {
    const recordView = await bootstrapPreconsult()
    if (recordView && Array.isArray(recordView.questions) && recordView.questions.length > 0) {
      return recordView.questions.map(convertBackendQuestionToFrontend)
    }
  } catch (error) {
    console.warn('获取后端预问诊问题失败，使用默认题库:', error)
  }
  return Promise.resolve(consultationQuestions)
}

export async function getDepartmentList(): Promise<DepartmentOption[]> {
  try {
    const list = await http.get<Array<Record<string, any>>>('/preconsult/client/departments')
    if (Array.isArray(list) && list.length > 0) {
      return list.map((item) => ({
        label: item.name || item.departmentName || item.label || '未定义科室',
        value: String(item.id || item.code || item.value || item.name),
        doctors: []
      }))
    }
  } catch (error) {
    console.warn('获取 /preconsult/client/departments 失败，尝试 admin 接口:', error)
    try {
      const list = await http.get<Array<Record<string, any>>>('/preconsult/admin/department/list')
      if (Array.isArray(list) && list.length > 0) {
        return list.map((item) => ({
          label: item.name || item.departmentName || item.label || '未定义科室',
          value: String(item.id || item.code || item.value || item.name),
          doctors: []
        }))
      }
    } catch (e) {
      console.warn('获取后端科室列表失败，退回 Mock 数据:', e)
    }
  }
  return Promise.resolve(mockDepartments)
}

export async function getDoctorList(department: string): Promise<DoctorOption[]> {
  try {
    const list = await http.get<Array<Record<string, any>>>('/preconsult/client/doctors', {
      params: { department, deptName: department }
    })
    if (Array.isArray(list) && list.length > 0) {
      return list.map((item) => ({
        label: item.doctorName || item.name || item.label || '医生',
        value: String(item.id || item.doctorId || item.value || item.doctorName)
      }))
    }
  } catch (error) {
    console.warn('获取后端医生列表失败，退回 Mock 数据:', error)
  }

  return Promise.resolve(
    mockDepartments.find((item) => item.label === department || item.value === department)?.doctors || []
  )
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export async function bootstrapPreconsult(payload?: {
  requestId?: string
  consentVersion?: string
  agreed?: boolean
}): Promise<PreconsultRecordViewBackend> {
  const reqId = payload?.requestId || generateUUID()
  return http.post<PreconsultRecordViewBackend>('/preconsult/client/records/bootstrap', {
    requestId: reqId,
    consentVersion: payload?.consentVersion || '2026-07-v1',
    agreed: payload?.agreed ?? true
  })
}

export async function saveAnswersApi(
  recordId: string,
  payload: {
    requestId?: string
    recordVersion?: number
    answers: Array<{
      templateQuestionId: string | number
      status?: 'ANSWERED' | 'SKIPPED'
      value?: any
    }>
  }
): Promise<PreconsultRecordViewBackend> {
  const reqId = payload.requestId || generateUUID()
  return http.put<PreconsultRecordViewBackend>(`/preconsult/client/records/${recordId}/answers`, {
    requestId: reqId,
    recordVersion: payload.recordVersion ?? 0,
    answers: payload.answers
  })
}

export async function submitPreconsultApi(
  recordId: string,
  payload?: {
    requestId?: string
    recordVersion?: number
  }
): Promise<{ success: boolean; recordId?: string; consultationNo?: string }> {
  const reqId = payload?.requestId || generateUUID()
  return http.post<{ success: boolean; recordId?: string; consultationNo?: string }>(
    `/preconsult/client/records/${recordId}/submit`,
    {
      requestId: reqId,
      recordVersion: payload?.recordVersion ?? 0
    }
  )
}

export async function getPreconsultResultApi(recordId: string): Promise<ConsultationReport> {
  const data = await http.get<Record<string, any>>(`/preconsult/client/records/${recordId}/result`)
  // 后端风险信息为 risk: {level, message, action} 对象，转换为前端提示数组
  const riskTips: string[] = []
  if (data.risk && data.risk.message && data.risk.level && data.risk.level !== 'NONE') {
    riskTips.push(String(data.risk.message))
  }
  return {
    chiefComplaint: data.chiefComplaint || '未填写主诉',
    presentIllness: data.presentIllness || '未填写现病史',
    pastHistory: data.pastHistory || '无既往史',
    allergyHistory: data.allergyHistory || '无过敏史',
    personalHistory: data.personalHistory || '未说明',
    materialSummary: data.supplementaryInfo || '未上传检查资料',
    riskTips,
    draftMedicalRecord: [
      data.chiefComplaint && `主诉：${data.chiefComplaint}`,
      data.presentIllness && `现病史：${data.presentIllness}`,
      data.pastHistory && `既往史：${data.pastHistory}`,
      data.allergyHistory && `过敏史：${data.allergyHistory}`
    ]
      .filter(Boolean)
      .join('\n')
  }
}

export async function uploadAttachmentApi(recordId: string, file: File): Promise<{ url: string; id: string }> {
  const formData = new FormData()
  formData.append('file', file)
  return http.post<{ url: string; id: string }>(`/preconsult/client/records/${recordId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export async function createReport(payload: {
  answers: Record<string, unknown>
  materialsCount: number
}): Promise<ConsultationReport> {
  const chief = Array.isArray(payload.answers.chiefSymptom)
    ? payload.answers.chiefSymptom.join('、')
    : '未填写'
  const duration = String(payload.answers.duration || '时间不详')
  const severity = String(payload.answers.severity || '程度未说明')
  const temperature = payload.answers.temperature
    ? `，最高体温约 ${payload.answers.temperature}℃`
    : ''
  const pastHistory = Array.isArray(payload.answers.pastHistory)
    ? payload.answers.pastHistory.join('、')
    : '未说明'
  const allergy = String(payload.answers.allergyHistory || '未说明')
  const treatment = String(payload.answers.treatment || '未说明')
  const risks: string[] = []

  if (chief.includes('胸闷') || severity === '严重') {
    risks.push('存在胸闷或严重症状描述，建议医生优先确认生命体征和急症风险。')
  }

  return Promise.resolve({
    chiefComplaint: `${chief} ${duration}`,
    presentIllness: `患者自述${duration}出现${chief}，目前症状程度为${severity}${temperature}。治疗经过：${treatment}。`,
    pastHistory,
    allergyHistory: allergy,
    personalHistory: '待医生进一步确认吸烟、饮酒、职业暴露等个人史。',
    materialSummary: payload.materialsCount
      ? `患者已上传 ${payload.materialsCount} 份资料，待医生查看原件。`
      : '患者暂未上传检查资料。',
    riskTips: risks,
    draftMedicalRecord: `主诉：${chief} ${duration}\n现病史：患者${duration}出现${chief}，程度${severity}${temperature}，治疗经过：${treatment}。\n既往史：${pastHistory}。\n过敏史：${allergy}。`
  })
}

