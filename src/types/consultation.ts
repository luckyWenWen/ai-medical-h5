export type VisitType = 'first' | 'return'
export type Gender = 'male' | 'female'
export type QuestionType = 'single' | 'multi' | 'text' | 'number' | 'date' | 'upload'

export interface VisitInfo {
  visitType: VisitType
  department: string
  doctor: string
  appointmentNo: string
  visitTime: string
}

export interface PatientProfile {
  name: string
  gender: Gender | ''
  age: number | null
  phone: string
  idCard: string
  cardNo: string
}

export interface QuestionOption {
  label: string
  value: string
}

export interface ConsultationQuestion {
  id: string
  title: string
  type: QuestionType
  /** 后端原始题型（如 SCALE/DATETIME），用于按后端契约序列化答案 */
  backendType?: string
  required?: boolean
  allowUnknown?: boolean
  placeholder?: string
  unit?: string
  options?: QuestionOption[]
}

export interface ChatMessage {
  id: string
  role: 'doctor' | 'patient'
  content: string
  questionId?: string
}

export type AnswerValue = string | string[] | number | null

export interface UploadMaterial {
  id: string
  name: string
  type: 'image' | 'file'
  url: string
  status: 'local' | 'uploaded'
}

export interface ConsultationReport {
  chiefComplaint: string
  presentIllness: string
  pastHistory: string
  allergyHistory: string
  personalHistory: string
  materialSummary: string
  riskTips: string[]
  draftMedicalRecord: string
}
