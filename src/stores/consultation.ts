import { defineStore } from 'pinia'
import { createReport, getConsultationQuestions } from '@/api/consultation'
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
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function formatAnswer(answer: AnswerValue): string {
  if (Array.isArray(answer)) {
    return answer.length ? answer.join('、') : '未填写'
  }

  return answer === null || answer === '' ? '不清楚' : String(answer)
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
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          visitInfo: this.visitInfo,
          profile: this.profile,
          questions: this.questions,
          answers: this.answers,
          messages: this.messages,
          currentIndex: this.currentIndex,
          materials: this.materials,
          report: this.report,
          consultationNo: this.consultationNo
        })
      )
    },
    async loadQuestions() {
      if (!this.questions.length) {
        this.questions = await getConsultationQuestions()
      }

      if (!this.messages.length && this.questions[0]) {
        this.messages.push({
          id: `q-${this.questions[0].id}`,
          role: 'doctor',
          content: this.questions[0].title,
          questionId: this.questions[0].id
        })
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
    answerCurrent(answer: AnswerValue) {
      const question = this.currentQuestion

      if (!question) return

      this.answers[question.id] = answer
      this.messages.push({
        id: `a-${question.id}-${Date.now()}`,
        role: 'patient',
        content: formatAnswer(answer),
        questionId: question.id
      })

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
      this.report = await createReport({
        answers: this.answers,
        materialsCount: this.materials.length
      })
      this.persist()
    },
    submitReport() {
      this.consultationNo = `PI${new Date().getFullYear()}${String(Date.now()).slice(-8)}`
      this.persist()
    },
    reset() {
      Object.assign(this, defaultState())
      localStorage.removeItem(STORAGE_KEY)
    }
  }
})
