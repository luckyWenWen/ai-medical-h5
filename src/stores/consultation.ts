import { defineStore } from 'pinia'
import {
  bootstrapPreconsult,
  convertBackendQuestionToFrontend,
  createReport,
  getConsultationQuestions,
  getPreconsultResultApi,
  saveAnswersApi,
  submitPreconsultApi
} from '@/api/consultation'
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
}

const defaultState = (): ConsultationState => ({
  recordId: '',
  recordVersion: 0,
  visitInfo: {
    visitType: 'first',
    department: '',
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
  consultationNo: ''
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
    async loadQuestions() {
      try {
        const bootstrapRes = await bootstrapPreconsult()
        if (bootstrapRes && bootstrapRes.recordId) {
          this.recordId = String(bootstrapRes.recordId)
          if (typeof bootstrapRes.recordVersion === 'number') {
            this.recordVersion = bootstrapRes.recordVersion
          }
          if (Array.isArray(bootstrapRes.questions) && bootstrapRes.questions.length > 0) {
            this.questions = bootstrapRes.questions.map(convertBackendQuestionToFrontend)
          }
        }
      } catch (error) {
        console.warn('后端 Bootstrap 记录失败，使用常规问题加载:', error)
      }

      if (!this.questions.length) {
        this.questions = await getConsultationQuestions()
      }

      if (this.questions.length > 0) {
        if (!this.messages.length || this.messages[0]?.questionId !== this.questions[0].id) {
          this.currentIndex = 0
          this.messages = [
            {
              id: `q-${this.questions[0].id}`,
              role: 'doctor',
              content: this.questions[0].title,
              questionId: this.questions[0].id
            }
          ]
        }
      }

      this.persist()
    },
    saveVisitInfo(payload: VisitInfo) {
      this.visitInfo = payload
      this.persist()
    },
    saveProfile(payload: PatientProfile) {
      this.profile = payload
      this.persist()
    },
    // 会话轮换（过期重建）后记录归属变化：重新 bootstrap 获取新记录，并批量回放本地全部已答内容
    async resyncRecord(): Promise<boolean> {
      const refreshRes = await bootstrapPreconsult()
      if (!refreshRes || !refreshRes.recordId) return false
      this.recordId = String(refreshRes.recordId)
      if (typeof refreshRes.recordVersion === 'number') {
        this.recordVersion = refreshRes.recordVersion
      }
      const answers = Object.entries(this.answers)
        .map(([qid, ans]) => {
          const q = this.questions.find((item) => item.id === qid)
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
        if (res && typeof res.recordVersion === 'number') {
          this.recordVersion = res.recordVersion
        }
      }
      return true
    },
    async answerCurrent(answer: AnswerValue) {
      const question = this.currentQuestion

      if (!question) return

      this.answers[question.id] = answer
      this.messages.push({
        id: `a-${question.id}-${Date.now()}`,
        role: 'patient',
        content: formatAnswer(answer, question),
        questionId: question.id
      })

      // 如果已有后端 recordId，异步提交/保存答案到后端
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
          if (res && typeof res.recordVersion === 'number') {
            this.recordVersion = res.recordVersion
          }
        } catch (error: any) {
          const status = error?.response?.status
          console.warn('保存单题答案到后端接口失败，尝试自动恢复:', error)
          try {
            if (status === 404) {
              // 记录不可用（会话过期重建）：重建记录并回放全部答案（含本题）
              await this.resyncRecord()
            } else if (status === 409 || error?.code === 409 || String(error).includes('409')) {
              const refreshRes = await bootstrapPreconsult()
              if (refreshRes && typeof refreshRes.recordVersion === 'number') {
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
                if (retryRes && typeof retryRes.recordVersion === 'number') {
                  this.recordVersion = retryRes.recordVersion
                }
              }
            }
          } catch (retryErr) {
            console.error('自动恢复后重试保存仍然失败:', retryErr)
          }
        }
      }

      this.currentIndex += 1

      if (this.currentQuestion) {
        this.messages.push({
          id: `q-${this.currentQuestion.id}`,
          role: 'doctor',
          content: this.currentQuestion.title,
          questionId: this.currentQuestion.id
        })
      }

      this.persist()
    },
    reviseQuestion(questionId: string) {
      const index = this.questions.findIndex((item) => item.id === questionId)

      if (index < 0) return

      this.currentIndex = index
      this.messages = this.messages.filter((message) => {
        if (!message.questionId) return true
        const messageIndex = this.questions.findIndex((item) => item.id === message.questionId)
        return messageIndex < index || message.id === `q-${questionId}`
      })
      delete this.answers[questionId]

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

