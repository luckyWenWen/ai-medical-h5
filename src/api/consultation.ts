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
  visibleTemplateQuestionIds?: Array<string | number>
  invalidatedTemplateQuestionIds?: Array<string | number>
  nextTemplateQuestionId?: string | number | null
  progress?: {
    resolvedCount?: number
    totalCount?: number
    percent?: number
  }
}

export interface BackendBodyPartItem {
  code: string
  name: string
  children?: BackendBodyPartItem[]
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
    bodyParts?: BackendBodyPartItem[]
    maxSelections?: number
    maxFiles?: number
    maxFileSizeBytes?: number
    acceptedMimeTypes?: string[]
    uploadEnabled?: boolean
  }
}

export interface PreconsultAttachmentBackend {
  attachmentId: string
  fileName: string
  fileSize: number
  /** 兼容部署方扩展的附件访问地址。 */
  url?: string
  /** 兼容旧版或网关转换后的附件标识字段。 */
  id?: string
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
  if (upper.includes('BODY_PART')) return 'bodyPart'
  if (upper.includes('MULTI')) return 'multi'
  if (upper.includes('TEXT')) return 'text'
  if (upper.includes('NUMBER') || upper.includes('SCALE')) return 'number'
  if (upper.includes('DATE')) return 'date'
  if (upper.includes('UPLOAD')) return 'upload'
  return 'text'
}

function flattenBodyParts(
  bodyParts: BackendBodyPartItem[] = [],
  parentName = ''
): Array<{ label: string; value: string }> {
  return bodyParts.flatMap((part) => {
    const label = parentName ? `${parentName} / ${part.name}` : part.name
    const current = part.code ? [{ label, value: part.code }] : []
    return current.concat(flattenBodyParts(part.children || [], label))
  })
}

export function convertBackendQuestionToFrontend(q: BackendQuestionItem): ConsultationQuestion {
  const backendType = (q.type || '').toUpperCase()
  const options = backendType === 'BODY_PART'
    ? flattenBodyParts(q.config?.bodyParts)
    : (q.options || []).map((opt) => ({
        label: opt.label || String(opt.value || opt.code || ''),
        value: opt.value || opt.code || opt.label || ''
      }))

  return {
    id: String(q.templateQuestionId),
    title: q.title,
    type: mapBackendTypeToFrontend(q.type),
    backendType,
    required: q.required ?? true,
    allowUnknown: q.config?.allowUnknown ?? true,
    placeholder: q.config?.placeholder,
    unit: q.config?.unit,
    options,
    maxSelections: q.config?.maxSelections,
    maxFiles: q.config?.maxFiles,
    maxFileSizeBytes: q.config?.maxFileSizeBytes,
    acceptedMimeTypes: q.config?.acceptedMimeTypes,
    uploadEnabled: q.config?.uploadEnabled
  }
}

export function getVisibleQuestionsFromRecord(
  record: PreconsultRecordViewBackend
): ConsultationQuestion[] {
  const questions = (record.questions || []).map(convertBackendQuestionToFrontend)
  if (!Array.isArray(record.visibleTemplateQuestionIds)) {
    return questions
  }

  const questionById = new Map(questions.map((question) => [question.id, question]))
  return record.visibleTemplateQuestionIds
    .map((id) => questionById.get(String(id)))
    .filter((question): question is ConsultationQuestion => Boolean(question))
}

export async function getConsultationQuestions(
  departmentId?: number
): Promise<ConsultationQuestion[]> {
  try {
    const recordView = await bootstrapPreconsult({ departmentId })
    if (recordView && Array.isArray(recordView.questions) && recordView.questions.length > 0) {
      return getVisibleQuestionsFromRecord(recordView)
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
  departmentId?: number
}): Promise<PreconsultRecordViewBackend> {
  const reqId = payload?.requestId || generateUUID()
  return http.post<PreconsultRecordViewBackend>('/preconsult/client/records/bootstrap', {
    requestId: reqId,
    consentVersion: payload?.consentVersion || '2026-07-v1',
    agreed: payload?.agreed ?? true,
    departmentId: payload?.departmentId
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

export async function uploadAttachmentApi(
  recordId: string,
  templateQuestionId: string,
  file: File
): Promise<PreconsultAttachmentBackend> {
  const formData = new FormData()
  formData.append('templateQuestionId', templateQuestionId)
  formData.append('file', file)
  return http.post<PreconsultAttachmentBackend>(
    `/preconsult/client/records/${recordId}/attachments`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
}

export async function createReport(payload: {
  answers: Record<string, unknown>
  questions: ConsultationQuestion[]
  materialsCount: number
}): Promise<ConsultationReport> {
  function collectAnswers(): string[] {
    return payload.questions
      .filter((q) => payload.answers[q.id] !== undefined && payload.answers[q.id] !== null)
      .map((q) => {
        const val = payload.answers[q.id]
        const label = Array.isArray(val)
          ? val.map(String).join('、')
          : String(val)
        return `${q.title.replace(/[：:？?]$/g, '')}：${label}`
      })
  }

  const allAnswers = collectAnswers()
  const chiefLine = allAnswers.find((a) => a.includes('主诉') || a.includes('主要症状') || a.includes('症状'))
    || allAnswers[0]
    || '未填写'
  const chief = chiefLine.includes('：') ? chiefLine.split('：').slice(1).join('：') : chiefLine

  const pastLine = allAnswers.find((a) => a.includes('既往') || a.includes('病史'))
  const pastHistory = pastLine ? pastLine.split('：').slice(1).join('：') : '未说明'

  const allergyLine = allAnswers.find((a) => a.includes('过敏'))
  const allergy = allergyLine ? allergyLine.split('：').slice(1).join('：') : '未说明'

  return Promise.resolve({
    chiefComplaint: chief || '未填写',
    presentIllness: allAnswers.length > 0 ? allAnswers.join('；') : '未填写现病史',
    pastHistory,
    allergyHistory: allergy,
    personalHistory: '待医生进一步确认吸烟、饮酒、职业暴露等个人史。',
    materialSummary: payload.materialsCount
      ? `患者已上传 ${payload.materialsCount} 份资料，待医生查看原件。`
      : '患者暂未上传检查资料。',
    riskTips: [],
    draftMedicalRecord: `主诉：${chief}\n现病史：${allAnswers.join('；')}\n既往史：${pastHistory}\n过敏史：${allergy}`
  })
}

