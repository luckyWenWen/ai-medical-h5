import { defineStore } from 'pinia'
import { showToast } from 'vant'
import {
  bootstrapPreconsult,
  getVisibleQuestionsFromRecord,
  createReport,
  getConsultationQuestions,
  getPreconsultResultApi,
  saveAnswersApi,
  submitPreconsultApi
} from '@/api/consultation'
import type { PreconsultRecordViewBackend } from '@/api/consultation'
import {
  getCurrentPatientProfile,
  getCurrentPatientTokenInfo,
  updateCurrentPatientProfile,
  type PatientProfileInfo,
  type PatientAuthInfo
} from '@/api/request'
import type {
  AnswerValue,
  ChatMessage,
  ConsultationQuestion,
  ConsultationReport,
  PatientProfile,
  UploadMaterial,
  VisitInfo
} from '@/types/consultation'

const STORAGE_KEY = 'patient_consultation_state'

interface ConsultationState {
  patientAuth: PatientAuthInfo | null
  recordId: string
  recordVersion: number
  recordStatus: string
  visitInfo: VisitInfo
  profile: PatientProfile
  questions: ConsultationQuestion[]
  answers: Record<string, AnswerValue>
  messages: ChatMessage[]
  currentIndex: number
  materials: UploadMaterial[]
  report: ConsultationReport | null
  consultationNo: string
  isRevising: boolean
  readOnly: boolean
}

const defaultState = (): ConsultationState => ({
  patientAuth: null,
  recordId: '',
  recordVersion: 0,
  recordStatus: '',
  visitInfo: {
    visitType: 'first',
    department: '',
    departmentId: '',
    doctor: '',
    appointmentNo: '',
    visitTime: ''
  },
  profile: {
    name: '',
    gender: '',
    age: null,
    phone: '',
    idCard: '',
    cardNo: ''
  },
  questions: [],
  answers: {},
  messages: [],
  currentIndex: 0,
  materials: [],
  report: null,
  consultationNo: '',
  isRevising: false,
  readOnly: false
})

function readState(): Partial<ConsultationState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    console.warn('读取患者本地缓存失败:', error)
    return {}
  }
}

function looksLikePhone(value?: string | null): boolean {
  return /^1\d{10}$/.test(String(value || ''))
}

function normalizeGender(value?: string | null): PatientProfile['gender'] {
  const upper = String(value || '').toUpperCase()
  if (upper === 'M' || upper === 'MALE' || upper === '男') return 'male'
  if (upper === 'F' || upper === 'FEMALE' || upper === '女') return 'female'
  return ''
}

function toBackendGender(value: PatientProfile['gender']): string | undefined {
  if (value === 'male') return 'M'
  if (value === 'female') return 'F'
  return undefined
}

function hasProfileField(profile: PatientProfileInfo, key: keyof PatientProfileInfo): boolean {
  return Object.prototype.hasOwnProperty.call(profile, key)
}

function getProfileString(profile: PatientProfileInfo, key: keyof PatientProfileInfo, fallback: string): string {
  return hasProfileField(profile, key) ? String(profile[key] ?? '') : fallback
}

function createDefaultCardNo(auth?: PatientAuthInfo | null): string {
  const seed = String(auth?.patientId || auth?.username || Date.now())
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000000
  }
  return `JZK${String(hash).padStart(8, '0')}`
}

function getFirstValue(source: Record<string, any>, ...keys: string[]) {
  for (const key of keys) {
    const value = key.split('.').reduce<any>((obj, field) => obj?.[field], source)
    if (value !== undefined && value !== null && value !== '') return value
  }
  return ''
}

function normalizeVisitType(value: unknown): VisitInfo['visitType'] {
  const upper = String(value || '').toUpperCase()
  return upper === 'RETURN' || upper === 'FOLLOW_UP' || upper === 'REVISIT' ? 'return' : 'first'
}

function mapEnumValueToLabel(val: string): string {
  const upper = val.toUpperCase()
  if (upper === 'MALE' || upper === 'M' || upper === 'MAN') return '男'
  if (upper === 'FEMALE' || upper === 'F' || upper === 'WOMAN') return '女'
  if (upper === 'TRUE' || upper === 'YES') return '是'
  if (upper === 'FALSE' || upper === 'NO') return '否'
  return val
}

function formatAnswer(answer: AnswerValue, question?: ConsultationQuestion): string {
  if ((question?.backendType || '').toUpperCase().includes('UPLOAD')) {
    const count = Array.isArray(answer) ? answer.length : answer ? 1 : 0
    return count > 0 ? `已上传 ${count} 份资料` : '未上传资料'
  }

  if (Array.isArray(answer)) {
    if (!answer.length) return '未填写'
    return answer
      .map((val) => {
        const found = question?.options?.find((opt) => String(opt.value) === String(val))
        return found ? found.label : mapEnumValueToLabel(String(val))
      })
      .join('、')
  }

  if (answer === null || answer === '' || answer === undefined) {
    return '不清楚'
  }

  const strVal = String(answer)
  const found = question?.options?.find((opt) => String(opt.value) === strVal)
  if (found) {
    return found.label
  }

  return mapEnumValueToLabel(strVal)
}

// 字段名必须与后端 PreconsultAnswerValue 判别联合子类保持一致：
// SINGLE_CHOICE → optionValue / MULTIPLE_CHOICE → optionValues / NUMBER、DATE、DATETIME → value(String)
// SCALE → value(int) / BOOLEAN → value(boolean) / TEXT → text
function formatBackendValue(answer: AnswerValue, question: ConsultationQuestion) {
  const upper = (question.backendType || question.type || '').toUpperCase()
  if (upper.includes('SCALE')) {
    return { type: 'SCALE', value: Number(answer ?? 0) }
  }
  if (upper.includes('BOOLEAN')) {
    return { type: 'BOOLEAN', value: answer === true || answer === 'true' || answer === 'YES' }
  }
  if (upper.includes('SINGLE')) {
    return { type: 'SINGLE_CHOICE', optionValue: String(answer ?? '') }
  }
  if (upper.includes('BODY_PART')) {
    return {
      type: 'BODY_PART',
      bodyPartCodes: Array.isArray(answer) ? answer.map(String) : [String(answer ?? '')]
    }
  }
  if (upper.includes('UPLOAD')) {
    return {
      type: 'UPLOAD',
      attachmentIds: Array.isArray(answer) ? answer.map(String) : [String(answer ?? '')]
    }
  }
  if (upper.includes('MULTI')) {
    return { type: 'MULTIPLE_CHOICE', optionValues: Array.isArray(answer) ? answer.map(String) : [String(answer ?? '')] }
  }
  if (upper.includes('NUMBER')) {
    return { type: 'NUMBER', value: String(answer ?? '') }
  }
  if (upper.includes('DATETIME')) {
    return { type: 'DATETIME', value: String(answer ?? '') }
  }
  if (upper.includes('DATE')) {
    return { type: 'DATE', value: String(answer ?? '') }
  }
  return { type: 'TEXT', text: String(answer ?? '') }
}

function formatBackendAnswer(answer: any): AnswerValue {
  if (!answer || answer.status === 'SKIPPED' || answer.value === null || answer.value === undefined) {
    return null
  }

  const value = answer.value
  if (Array.isArray(value.optionValues)) return value.optionValues.map(String)
  if (Array.isArray(value.bodyPartCodes)) return value.bodyPartCodes.map(String)
  if (Array.isArray(value.attachmentIds)) return value.attachmentIds.map(String)
  if (value.optionValue !== undefined) return String(value.optionValue)
  if (value.text !== undefined) return String(value.text)
  if (value.value !== undefined) return value.value
  return answer.displayText || answer.answerText || null
}

function hasAuthoritativeFlow(record: PreconsultRecordViewBackend): boolean {
  return Array.isArray(record.visibleTemplateQuestionIds)
}

function resolveDepartmentId(visitInfo: VisitInfo): number | undefined {
  const departmentId = Number(visitInfo.departmentId)
  return Number.isInteger(departmentId) && departmentId > 0 ? departmentId : undefined
}

/** 构建随 bootstrap 落库的患者快照；姓名为空视为未填写，返回 undefined 不上送 */
function buildPatientSnapshot(profile: PatientProfile): Record<string, unknown> | undefined {
  if (!profile.name) return undefined
  return {
    name: profile.name,
    gender: profile.gender,
    age: profile.age,
    phone: profile.phone,
    idCard: profile.idCard || '',
    cardNo: profile.cardNo || ''
  }
}

export const useConsultationStore = defineStore('consultation', {
  state: (): ConsultationState => ({
    ...defaultState(),
    ...readState()
  }),
  getters: {
    currentQuestion: (state) => state.questions[state.currentIndex],
    progressPercent: (state) => {
      if (!state.questions.length) return 0
      // 按“已处理题数/可见题数”计算，分支题动态增减时不会出现进度回跳到错误值
      const answeredCount = state.questions.filter((q) =>
        Object.prototype.hasOwnProperty.call(state.answers, q.id)
      ).length
      return Math.min(100, Math.round((answeredCount / state.questions.length) * 100))
    },
    canResume: (state) => state.messages.length > 0 && state.currentIndex < state.questions.length,
    isLoggedIn: (state): boolean => {
      return Boolean(state.patientAuth?.token || localStorage.getItem('patient_token'))
    },
    patientKey: (state): string => {
      const dept = state.visitInfo.departmentId || ''
      const name = (state.profile.name || '').trim()
      const phone = (state.profile.phone || '').trim()
      if (!name || !phone) return ''
      return `${dept}_${name}_${phone}`
    },
    firstUnansweredIndex: (state): number => {
      return state.questions.findIndex((q) => {
        if (q.required === false) return false
        // 与后端口径一致：显式跳过（key 存在且值为 null）视为已处理
        if (!Object.prototype.hasOwnProperty.call(state.answers, q.id)) return true
        const ans = state.answers[q.id]
        if (ans === null) return false
        if (typeof ans === 'string' && ans.trim() === '') return true
        if (Array.isArray(ans) && ans.length === 0) return true
        return false
      })
    },
    hasUnansweredRequiredQuestions(): boolean {
      return this.firstUnansweredIndex >= 0
    },
    isSubmittedRecord: (state): boolean => {
      return state.readOnly || Boolean(state.consultationNo) || state.recordStatus === 'SUBMITTED'
    }
  },
  actions: {
    persist() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state))
    },
    setPatientAuth(auth: PatientAuthInfo) {
      const token = auth.token || this.patientAuth?.token || localStorage.getItem('patient_token') || ''
      if (token) {
        localStorage.setItem('patient_token', token.replace(/^Bearer\s+/i, ''))
      }
      if (auth.username) {
        localStorage.setItem('patient_username', String(auth.username))
      }

      const mergedAuth = {
        ...(this.patientAuth || {}),
        ...auth,
        token: token || auth.token
      }
      this.patientAuth = mergedAuth

      this.profile = {
        ...this.profile,
        name: String(auth.patientName || this.profile.name || auth.username || ''),
        gender: normalizeGender(auth.gender) || this.profile.gender,
        age: typeof auth.age === 'number' ? auth.age : this.profile.age,
        phone: String(auth.phone || (looksLikePhone(auth.username) ? auth.username : '') || this.profile.phone || ''),
        idCard: String(auth.idCard || this.profile.idCard || ''),
        cardNo: this.profile.cardNo || createDefaultCardNo(mergedAuth)
      }
      this.persist()
    },
    setPatientProfile(profile: PatientProfileInfo) {
      const patientName = getProfileString(profile, 'patientName', this.profile.name)
      const username = getProfileString(profile, 'username', String(this.patientAuth?.username || ''))
      const phoneFallback = looksLikePhone(username) ? username : this.profile.phone
      const phone = getProfileString(profile, 'phone', phoneFallback) || phoneFallback
      const idCard = getProfileString(profile, 'idCard', this.profile.idCard)
      const gender = hasProfileField(profile, 'gender')
        ? normalizeGender(profile.gender)
        : this.profile.gender
      const age = hasProfileField(profile, 'age')
        ? (typeof profile.age === 'number' ? profile.age : null)
        : this.profile.age

      this.patientAuth = {
        ...(this.patientAuth || {}),
        patientId: getProfileString(profile, 'patientId', String(this.patientAuth?.patientId || '')),
        username,
        patientName,
        phone,
        idCard,
        gender: profile.gender || this.patientAuth?.gender,
        age,
        token: this.patientAuth?.token || localStorage.getItem('patient_token') || undefined
      }

      this.profile = {
        ...this.profile,
        name: patientName,
        gender,
        age,
        phone,
        idCard,
        cardNo: this.profile.cardNo || createDefaultCardNo(this.patientAuth)
      }
      this.persist()
    },
    async loadCurrentPatientProfile(): Promise<boolean> {
      const token = localStorage.getItem('patient_token')
      if (!token) return false

      const profile = await getCurrentPatientProfile()
      this.setPatientProfile(profile)
      return true
    },
    async loadCurrentPatientAuth(): Promise<boolean> {
      const token = localStorage.getItem('patient_token')
      if (!token) return false

      try {
        const auth = await getCurrentPatientTokenInfo()
        this.setPatientAuth({
          ...(this.patientAuth || {}),
          ...auth,
          token: auth.token || token
        })
        try {
          const profile = await getCurrentPatientProfile()
          this.setPatientProfile(profile)
        } catch (profileError) {
          console.warn('鑾峰彇褰撳墠鎮ｈ€呬釜浜鸿祫鏂欏け璐?', profileError)
        }
        return true
      } catch (error) {
        console.warn('获取当前患者 Token 信息失败:', error)
        return Boolean(this.patientAuth?.patientId || this.patientAuth?.username)
      }
    },
    clearPatientAuth() {
      localStorage.removeItem('patient_token')
      localStorage.removeItem('csrf_token')
      localStorage.removeItem('patient_username')
      localStorage.removeItem(STORAGE_KEY)
      Object.assign(this, defaultState())
      this.persist()
    },
    syncRecordView(record: PreconsultRecordViewBackend): boolean {
      this.recordId = String(record.recordId || this.recordId)
      if (typeof record.recordVersion === 'number') {
        this.recordVersion = record.recordVersion
      }

      const invalidatedIds = new Set(
        (record.invalidatedTemplateQuestionIds || []).map(String)
      )
      invalidatedIds.forEach((questionId) => {
        delete this.answers[questionId]
      })
      if (invalidatedIds.size) {
        this.messages = this.messages.filter(
          (message) => !message.questionId || !invalidatedIds.has(message.questionId)
        )
      }

      const authoritativeFlow = hasAuthoritativeFlow(record)
      if (record.status) {
        this.recordStatus = record.status
      }
      if (record.status === 'SUBMITTED' || record.readOnly) {
        this.readOnly = true
      }
      if (Array.isArray(record.questions)) {
        this.questions = getVisibleQuestionsFromRecord(record)
      }
      if (Array.isArray(record.answers)) {
        this.answers = {}
        record.answers.forEach((answer) => {
          const questionId = String(answer.templateQuestionId || '')
          if (questionId) {
            this.answers[questionId] = formatBackendAnswer(answer)
          }
        })
      }
      if (!authoritativeFlow) {
        return false
      }

      if (record.nextTemplateQuestionId === null || record.nextTemplateQuestionId === undefined) {
        this.currentIndex = this.questions.length
        return true
      }

      const nextQuestionId = String(record.nextTemplateQuestionId)
      const nextIndex = this.questions.findIndex((question) => question.id === nextQuestionId)
      this.currentIndex = nextIndex >= 0 ? nextIndex : this.questions.length
      return true
    },
    resumeRecordView(record: PreconsultRecordViewBackend & Record<string, any>) {
      this.recordId = String(record.recordId || this.recordId)
      this.recordVersion = typeof record.recordVersion === 'number' ? record.recordVersion : this.recordVersion
      this.recordStatus = String(record.status || this.recordStatus || '')
      this.readOnly = Boolean(record.readOnly) || this.recordStatus === 'SUBMITTED'
      this.consultationNo = String(record.consultationNo || this.consultationNo || '')

      const departmentName = getFirstValue(
        record,
        'departmentName',
        'department',
        'deptName',
        'template.departmentName',
        'template.name'
      )
      const departmentId = getFirstValue(record, 'departmentId', 'deptId', 'template.departmentId')
      this.visitInfo = {
        ...this.visitInfo,
        visitType: normalizeVisitType(getFirstValue(record, 'visitType')),
        department: String(departmentName || this.visitInfo.department || '历史问诊'),
        departmentId: String(departmentId || this.visitInfo.departmentId || ''),
        doctor: String(getFirstValue(record, 'doctorName', 'doctor') || this.visitInfo.doctor || ''),
        appointmentNo: String(getFirstValue(record, 'appointmentNo', 'registrationNo') || this.visitInfo.appointmentNo || ''),
        visitTime: String(getFirstValue(record, 'visitTime', 'createdAt', 'createTime') || this.visitInfo.visitTime || '')
      }

      const patientSnapshot = record.patientSnapshot || {}
      this.profile = {
        ...this.profile,
        name: String(getFirstValue(record, 'patientName', 'name', 'patientSnapshot.name') || this.profile.name),
        gender: normalizeGender(getFirstValue(record, 'gender', 'patientGender', 'patientSnapshot.gender')) || this.profile.gender,
        age: Number(getFirstValue(record, 'age', 'patientAge', 'patientSnapshot.age')) || this.profile.age,
        phone: String(getFirstValue(record, 'patientPhone', 'phone', 'patientSnapshot.phone') || this.profile.phone),
        idCard: String(getFirstValue(record, 'idCard', 'patientIdCard', 'patientSnapshot.idCard') || this.profile.idCard),
        cardNo: String(getFirstValue(record, 'cardNo', 'patientSnapshot.cardNo') || this.profile.cardNo || createDefaultCardNo(this.patientAuth))
      }
      if (patientSnapshot && typeof patientSnapshot === 'object' && !this.profile.name) {
        this.profile.name = String(patientSnapshot.name || '')
      }

      this.syncRecordView(record)
      if (!this.readOnly && this.currentIndex >= this.questions.length) {
        const fallbackIndex =
          this.questions.findIndex((question) => !Object.prototype.hasOwnProperty.call(this.answers, question.id))
        this.currentIndex = fallbackIndex >= 0 ? fallbackIndex : this.questions.length
      }
      this.rebuildMessagesFromAnswers()
      if (!this.readOnly) {
        this.ensureCurrentQuestionMessage()
      }
      this.persist()
    },
    ensureCurrentQuestionMessage() {
      const question = this.currentQuestion
      if (!question || this.messages.some((message) => message.id === `q-${question.id}`)) {
        return
      }
      this.messages.push({
        id: `q-${question.id}`,
        role: 'doctor',
        content: question.title,
        questionId: question.id
      })
    },
    rebuildMessagesFromAnswers() {
      this.messages = []
      const currentId = this.currentQuestion?.id

      for (const question of this.questions) {
        const hasAnswer = Object.prototype.hasOwnProperty.call(this.answers, question.id)
        const isCurrent = !this.readOnly && question.id === currentId

        if (hasAnswer || isCurrent) {
          this.messages.push({
            id: `q-${question.id}`,
            role: 'doctor',
            content: question.title,
            questionId: question.id
          })

          if (hasAnswer) {
            this.messages.push({
              id: `a-${question.id}-restored`,
              role: 'patient',
              content: formatAnswer(this.answers[question.id], question),
              questionId: question.id
            })
          }
        }
      }
    },
    async loadQuestions() {
      let loadedFromBackend = false
      try {
        const bootstrapRes = await bootstrapPreconsult({
          departmentId: resolveDepartmentId(this.visitInfo),
          patientSnapshot: buildPatientSnapshot(this.profile)
        })
        if (bootstrapRes && bootstrapRes.recordId) {
          loadedFromBackend = true
          const synchronized = this.syncRecordView(bootstrapRes)
          if (!synchronized) {
            this.currentIndex = 0
          }
        }
      } catch (error) {
        console.warn('后端 Bootstrap 记录失败，使用常规问题加载:', error)
      }

      if (!loadedFromBackend && !this.questions.length) {
        this.questions = await getConsultationQuestions(
          resolveDepartmentId(this.visitInfo)
        )
        this.currentIndex = 0
      }

      if (Object.keys(this.answers).length > 0) {
        this.rebuildMessagesFromAnswers()
        if (!this.readOnly) {
          this.ensureCurrentQuestionMessage()
        }
      } else {
        this.messages = []
        this.ensureCurrentQuestionMessage()
      }
      this.persist()
    },
    async resumeForRevision() {
      if (!this.questions.length) {
        return false
      }

      if (this.readOnly || this.consultationNo) {
        this.readOnly = true
        showToast('本次预问诊已经提交，仅供查看，无法修改')
        return false
      }

      this.report = null
      this.isRevising = false
      const lastAnsweredIndex = this.questions.reduce((lastIndex, question, index) => (
        Object.prototype.hasOwnProperty.call(this.answers, question.id) ? index : lastIndex
      ), -1)
      this.currentIndex = lastAnsweredIndex >= 0 ? lastAnsweredIndex : 0
      this.rebuildMessagesFromAnswers()
      this.persist()
      return true
    },
    async saveVisitInfo(payload: VisitInfo, options?: { requireAuth?: boolean }) {
      const departmentChanged = this.visitInfo.departmentId !== payload.departmentId
      const wasSubmitted = this.readOnly || Boolean(this.consultationNo)

      this.visitInfo = payload
      if (departmentChanged || wasSubmitted) {
        const savedProfile = { ...this.profile }
        const savedVisitInfo = { ...this.visitInfo }
        await this.reset(options)
        this.profile = savedProfile
        this.visitInfo = savedVisitInfo
      }
      this.persist()
    },
    async saveProfile(payload: PatientProfile, options?: { requireAuth?: boolean }) {
      const oldKey = this.patientKey
      const newKey = payload.name && payload.phone ? `${payload.name.trim()}_${payload.phone.trim()}` : ''
      const keyChanged = Boolean(oldKey) && Boolean(newKey) && oldKey !== newKey
      const isNewPatient = !oldKey && Boolean(newKey)
      const wasSubmitted = this.readOnly || Boolean(this.consultationNo)
      const updatedProfile = await updateCurrentPatientProfile({
        patientName: payload.name,
        phone: payload.phone,
        idCard: payload.idCard,
        gender: toBackendGender(payload.gender),
        age: payload.age
      })

      this.profile = payload
      this.setPatientProfile({
        ...(updatedProfile || {}),
        patientName: updatedProfile?.patientName ?? payload.name,
        phone: updatedProfile?.phone ?? payload.phone,
        idCard: updatedProfile?.idCard ?? payload.idCard,
        gender: updatedProfile?.gender ?? toBackendGender(payload.gender),
        age: updatedProfile?.age ?? payload.age
      })
      if (keyChanged || isNewPatient || wasSubmitted) {
        const savedProfile = { ...this.profile }
        const savedVisitInfo = { ...this.visitInfo }
        await this.reset(options)
        this.profile = savedProfile
        this.visitInfo = savedVisitInfo
      }
      this.persist()
    },
    // 会话轮换（过期重建）后记录归属变化：重新 bootstrap 获取新记录，并批量回放本地全部已答内容
    async resyncRecord(forceNewToken = false): Promise<PreconsultRecordViewBackend | null> {
      if (forceNewToken) {
        await this.loadCurrentPatientAuth()
      }
      const knownQuestions = [...this.questions]
      const refreshRes = await bootstrapPreconsult({
        departmentId: resolveDepartmentId(this.visitInfo),
        patientSnapshot: buildPatientSnapshot(this.profile)
      })
      if (!refreshRes || !refreshRes.recordId) return null
      this.recordId = String(refreshRes.recordId)
      if (typeof refreshRes.recordVersion === 'number') {
        this.recordVersion = refreshRes.recordVersion
      }
      const answers = Object.entries(this.answers)
        .map(([qid, ans]) => {
          const q = knownQuestions.find((item) => item.id === qid)
          if (!q) return null
          return {
            templateQuestionId: qid,
            status: (ans === null ? 'SKIPPED' : 'ANSWERED') as 'SKIPPED' | 'ANSWERED',
            value: formatBackendValue(ans, q)
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
      if (answers.length) {
        const res = await saveAnswersApi(this.recordId, {
          recordVersion: this.recordVersion,
          answers
        })
        this.syncRecordView(res)
        return res
      }
      this.syncRecordView(refreshRes)
      return refreshRes
    },
    async answerCurrent(answer: AnswerValue) {
      if (this.readOnly || this.consultationNo) {
        this.readOnly = true
        showToast('本次预问诊已经提交，无法修改')
        return
      }

      const question = this.currentQuestion

      if (!question) return

      this.answers[question.id] = answer
      this.report = null
      this.messages = this.messages.filter(
        (message) => message.role !== 'patient' || message.questionId !== question.id
      )
      this.messages.push({
        id: `a-${question.id}-${Date.now()}`,
        role: 'patient',
        content: formatAnswer(answer, question),
        questionId: question.id
      })

      let synchronizedWithBackend = false
      let saveErrorMessage = ''
      if (this.recordId) {
        try {
          const res = await saveAnswersApi(this.recordId, {
            recordVersion: this.recordVersion,
            answers: [
              {
                templateQuestionId: question.id,
                status: answer === null ? 'SKIPPED' : 'ANSWERED',
                value: formatBackendValue(answer, question)
              }
            ]
          })
          synchronizedWithBackend = this.syncRecordView(res)
        } catch (error: any) {
          const status = error?.response?.status
          const responseData = error?.response?.data
          const code = responseData?.code || responseData?.data?.errorCode || error?.code
          const message = responseData?.message || responseData?.msg || error?.message || ''
          saveErrorMessage = message || '回答保存失败，请稍后重试'

          console.warn('保存单题答案到后端接口失败:', error)

          // 仅在明确返回 RECORD_SUBMITTED 错误时，才触发“已提交”只读锁与 Toast
          if (
            code === 'RECORD_SUBMITTED' ||
            responseData?.data?.errorCode === 'RECORD_SUBMITTED' ||
            String(message).includes('已经提交')
          ) {
            this.readOnly = true
            showToast('本次预问诊已经提交，无法修改')
            return
          }

          // 常规版本冲突 (409) 或 记录超时 (404)：自动重新 bootstrap 更新 recordVersion 并重试
          try {
            if (status === 404 || status === 409 || error?.code === 409) {
              const refreshRes = await bootstrapPreconsult({
                departmentId: resolveDepartmentId(this.visitInfo),
                patientSnapshot: buildPatientSnapshot(this.profile)
              })
              if (refreshRes && typeof refreshRes.recordVersion === 'number') {
                this.recordId = String(refreshRes.recordId || this.recordId)
                this.recordVersion = refreshRes.recordVersion
                const retryRes = await saveAnswersApi(this.recordId, {
                  recordVersion: this.recordVersion,
                  answers: [
                    {
                      templateQuestionId: question.id,
                      status: answer === null ? 'SKIPPED' : 'ANSWERED',
                      value: formatBackendValue(answer, question)
                    }
                  ]
                })
                synchronizedWithBackend = this.syncRecordView(retryRes)
              }
            }
          } catch (retryErr) {
            console.error('重步 recordVersion 后保存答案仍然失败:', retryErr)
          }
        }
      }

      if (!synchronizedWithBackend) {
        if (this.recordId) {
          showToast(saveErrorMessage || '回答保存失败，请稍后重试')
          return
        }
        this.currentIndex += 1
      }
      this.isRevising = false
      this.ensureCurrentQuestionMessage()
      this.persist()
    },
    reviseQuestion(questionId: string) {
      if (this.readOnly || this.consultationNo) {
        this.readOnly = true
        showToast('本次预问诊已经提交，无法修改')
        return
      }

      const index = this.questions.findIndex((item) => item.id === questionId)

      if (index < 0) return

      this.currentIndex = index
      this.isRevising = false
      this.messages = this.messages.filter((message) => {
        if (!message.questionId) return true
        const messageIndex = this.questions.findIndex((item) => item.id === message.questionId)
        return messageIndex < index || message.id === `q-${questionId}`
      })
      if (!this.messages.some((message) => message.id === `q-${questionId}`)) {
        this.messages.push({
          id: `q-${questionId}`,
          role: 'doctor',
          content: this.questions[index].title,
          questionId
        })
      }

      this.persist()
    },
    finishRevision(): boolean {
      if (this.readOnly) {
        showToast('本次预问诊已经提交，无法修改')
        return false
      }
      this.isRevising = false
      if (this.hasUnansweredRequiredQuestions) {
        if (this.firstUnansweredIndex >= 0) {
          this.currentIndex = this.firstUnansweredIndex
        }
        this.rebuildMessagesFromAnswers()
        this.persist()
        return false
      }
      this.rebuildMessagesFromAnswers()
      this.persist()
      return true
    },
    addMaterial(material: UploadMaterial) {
      if (this.readOnly) {
        showToast('本次预问诊已经提交，无法补充资料')
        return
      }
      this.materials.push(material)
      this.persist()
    },
    removeMaterial(id: string) {
      if (this.readOnly) {
        showToast('本次预问诊已经提交，无法删除资料')
        return
      }
      this.materials = this.materials.filter((item) => item.id !== id)
      this.persist()
    },
    async buildReport(): Promise<boolean> {
      if (this.recordId) {
        try {
          this.report = await getPreconsultResultApi(this.recordId)
          this.persist()
          return true
        } catch (error: any) {
          const status = error?.response?.status
          const responseData = error?.response?.data
          const message = responseData?.message || responseData?.msg || error?.message || ''

          if (status === 404 || status === 409 || error?.code === 409) {
            try {
              await this.resyncRecord()
              this.ensureCurrentQuestionMessage()
              this.persist()
            } catch (retryErr) {
              console.warn('重新同步问诊记录失败:', retryErr)
            }
          }

          showToast(message || '报告暂时无法生成，请继续完善问诊信息')
          return false
        }
      }
      this.report = await createReport({
        answers: this.answers,
        questions: this.questions,
        materialsCount: this.materials.length
      })
      this.persist()
      return true
    },
    /** 提交预问诊；返回是否成功（已提交过视为成功）。失败时不再降级生成假编号。 */
    async submitReport(): Promise<boolean> {
      if (this.readOnly || this.consultationNo) {
        this.readOnly = true
        showToast('本次预问诊已经提交，请勿重复提交')
        return true
      }
      if (this.recordId) {
        try {
          const res = await submitPreconsultApi(this.recordId, {
            recordVersion: this.recordVersion
          })
          this.consultationNo =
            (res && res.consultationNo) ||
            (res && res.recordId ? String(res.recordId) : this.recordId)
          this.readOnly = true
          this.persist()
          return true
        } catch (error: any) {
          console.warn('提交后端预问诊接口失败:', error)
          const responseData = error?.response?.data
          const code = responseData?.code || responseData?.data?.errorCode
          const msg = responseData?.message || responseData?.msg || error?.message || ''
          if (code === 'RECORD_SUBMITTED' || String(msg).includes('已经提交')) {
            // 后端已提交：本地补齐只读状态，视为成功
            this.readOnly = true
            this.consultationNo = this.consultationNo || this.recordId
            this.persist()
            return true
          }
          showToast(msg || '提交失败，请稍后重试')
          return false
        }
      }
      // 无后端记录（离线/降级模式）：本地生成编号，保持流程可走通
      this.consultationNo = `PI${new Date().getFullYear()}${String(Date.now()).slice(-8)}`
      this.persist()
      return true
    },
    async reset(options?: { requireAuth?: boolean }): Promise<boolean> {
      const auth = this.patientAuth
      Object.assign(this, defaultState())
      this.patientAuth = auth || null
      localStorage.removeItem(STORAGE_KEY)
      if (auth) this.patientAuth = auth
      if (auth) {
        this.profile = {
          ...this.profile,
          name: String(auth.patientName || auth.username || ''),
          gender: normalizeGender(auth.gender),
          age: typeof auth.age === 'number' ? auth.age : null,
          phone: String(auth.phone || (looksLikePhone(auth.username) ? auth.username : '')),
          idCard: String(auth.idCard || ''),
          cardNo: createDefaultCardNo(auth)
        }
      }
      this.persist()
      return Boolean(this.patientAuth?.token || localStorage.getItem('patient_token'))
    }
  }
})
