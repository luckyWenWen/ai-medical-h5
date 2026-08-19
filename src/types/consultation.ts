export type VisitType = 'first' | 'return'
export type Gender = 'male' | 'female'
export type QuestionType = 'single' | 'multi' | 'text' | 'number' | 'date' | 'bodyPart' | 'upload'
export type ConsultationMode = 'qa' | 'text' | 'voice'
export type UploadOcrStatus = 'idle' | 'pending' | 'recognizing' | 'success' | 'failed'

export interface VisitInfo {
  visitType: VisitType
  department: string
  departmentId: string
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

export interface SelfNarration {
  mode: ConsultationMode
  text: string
  audioUrl?: string
  recordedSeconds?: number
  updatedAt?: string
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
  maxSelections?: number
  maxFiles?: number
  maxFileSizeBytes?: number
  acceptedMimeTypes?: string[]
  uploadEnabled?: boolean
}

export interface ChatMessage {
  id: string
  role: 'doctor' | 'patient'
  content: string
  questionId?: string
}

export type AnswerValue = string | string[] | number | boolean | null

export interface UploadMaterial {
  id: string
  name: string
  type: 'image' | 'file'
  url: string
  status: 'local' | 'uploaded'
  ocrStatus?: UploadOcrStatus
  ocrText?: string
  ocrSummary?: string
  ocrError?: string
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
