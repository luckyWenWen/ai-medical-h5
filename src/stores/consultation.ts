import { defineStore } from 'pinia'
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
import { refreshAuthToken } from '@/api/request'
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
  recordId: string
  recordVersion: number
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
}

const defaultState = (): ConsultationState => ({
  recordId: '',
  recordVersion: 0,
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
  isRevising: false
})

function readState(): Partial<ConsultationState> {
  return {}
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

export const useConsultationStore = defineStore('consultation', {
  state: (): ConsultationState => ({
    ...defaultState(),
    ...readState()
  }),
  getters: {
    currentQuestion: (state) => state.questions[state.currentIndex],
    progressPercent: (state) =>
      state.questions.length
        ? Math.round((state.currentIndex / state.questions.length) * 100)
        : 0,
    canResume: (state) => state.messages.length > 0 && state.currentIndex < state.questions.length
  },
  actions: {
    persist() {
      localStorage.removeItem(STORAGE_KEY)
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
      for (const question of this.questions) {
        this.messages.push({
          id: `q-${question.id}`,
          role: 'doctor',
          content: question.title,
          questionId: question.id
        })

        if (Object.prototype.hasOwnProperty.call(this.answers, question.id)) {
          this.messages.push({
            id: `a-${question.id}-restored`,
            role: 'patient',
            content: formatAnswer(this.answers[question.id], question),
            questionId: question.id
          })
        }
      }
    },
    async loadQuestions() {
      let loadedFromBackend = false
      try {
        const bootstrapRes = await bootstrapPreconsult({
          departmentId: resolveDepartmentId(this.visitInfo)
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

      // 后端标记"已完成"时 currentIndex 会越界 → 重置到第一题重新开始问诊
      if (this.questions.length > 0 && this.currentIndex >= this.questions.length) {
        this.currentIndex = 0
      }

      this.messages = []
      this.ensureCurrentQuestionMessage()
      this.persist()
    },
    resumeForRevision() {
      if (!this.questions.length) {
        return false
      }

      this.report = null
      this.isRevising = true
      const lastAnsweredIndex = this.questions.reduce((lastIndex, question, index) => (
        Object.prototype.hasOwnProperty.call(this.answers, question.id) ? index : lastIndex
      ), -1)
      this.currentIndex = lastAnsweredIndex >= 0 ? lastAnsweredIndex : 0
      this.rebuildMessagesFromAnswers()
      this.persist()
      return true
    },
    saveVisitInfo(payload: VisitInfo) {
      const departmentChanged = this.visitInfo.departmentId !== payload.departmentId
      this.visitInfo = payload
      if (departmentChanged) {
        this.recordVersion = 0
        this.questions = []
        this.answers = {}
        this.messages = []
        this.currentIndex = 0
        this.materials = []
        this.report = null
        this.consultationNo = ''
      }
      this.persist()
    },
    saveProfile(payload: PatientProfile) {
      this.profile = payload
      this.persist()
    },
    // 会话轮换（过期重建）后记录归属变化：重新 bootstrap 获取新记录，并批量回放本地全部已答内容
    async resyncRecord(): Promise<PreconsultRecordViewBackend | null> {
      const knownQuestions = [...this.questions]
      const refreshRes = await bootstrapPreconsult({
        departmentId: resolveDepartmentId(this.visitInfo)
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
          console.warn('保存单题答案到后端接口失败，尝试自动恢复:', error)
          try {
            if (status === 404) {
              // 记录不可用（会话过期重建）：重建记录并回放全部答案（含本题）
              const recovered = await this.resyncRecord()
              synchronizedWithBackend = recovered ? hasAuthoritativeFlow(recovered) : false
            } else if (status === 409 || error?.code === 409 || String(error).includes('409')) {
              const refreshRes = await bootstrapPreconsult({
                departmentId: resolveDepartmentId(this.visitInfo)
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
            console.error('自动恢复后重试保存仍然失败:', retryErr)
          }
        }
      }

      if (!synchronizedWithBackend) {
        this.currentIndex += 1
      }
      if (this.isRevising && this.currentIndex >= this.questions.length) {
        this.currentIndex = this.questions.length - 1
      }
      this.ensureCurrentQuestionMessage()
      this.persist()
    },
    reviseQuestion(questionId: string) {
      const index = this.questions.findIndex((item) => item.id === questionId)

      if (index < 0) return

      this.currentIndex = index
      this.isRevising = true
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
    finishRevision() {
      this.isRevising = false
      this.persist()
    },
    addMaterial(material: UploadMaterial) {
      this.materials.push(material)
      this.persist()
    },
    removeMaterial(id: string) {
      this.materials = this.materials.filter((item) => item.id !== id)
      this.persist()
    },
    async buildReport() {
      if (this.recordId) {
        try {
          this.report = await getPreconsultResultApi(this.recordId)
          this.persist()
          return
        } catch (error: any) {
          console.warn('拉取后端预问诊结果失败，尝试重建记录后重试:', error)
          // 会话轮换导致记录不可用：重建记录并回放答案后再拉一次结果
          try {
            if (await this.resyncRecord()) {
              this.report = await getPreconsultResultApi(this.recordId)
              this.persist()
              return
            }
          } catch (retryErr) {
            console.warn('重建记录后拉取结果仍失败，生成默认分析报告:', retryErr)
          }
        }
      }
      this.report = await createReport({
        answers: this.answers,
        questions: this.questions,
        materialsCount: this.materials.length
      })
      this.persist()
    },
    async submitReport() {
      if (this.recordId) {
        try {
          const res = await submitPreconsultApi(this.recordId, {
            recordVersion: this.recordVersion
          })
          if (res && res.consultationNo) {
            this.consultationNo = res.consultationNo
          } else {
            this.consultationNo = `PI${new Date().getFullYear()}${String(Date.now()).slice(-8)}`
          }
          this.persist()
          return
        } catch (error) {
          console.warn('提交后端预问诊接口失败，降级本地生成编号:', error)
        }
      }
      this.consultationNo = `PI${new Date().getFullYear()}${String(Date.now()).slice(-8)}`
      this.persist()
    },
    async reset() {
      Object.assign(this, defaultState())
      localStorage.removeItem(STORAGE_KEY)
      try {
        await refreshAuthToken()
      } catch (e) {
        console.warn('重置患者 Session 失败:', e)
      }
    }
  }
})
