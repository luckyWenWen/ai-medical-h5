import { consultationQuestions } from '@/mock/questions'
import type { ConsultationQuestion, ConsultationReport } from '@/types/consultation'

export interface DoctorOption {
  label: string
  value: string
}

export interface DepartmentOption {
  label: string
  value: string
  doctors: DoctorOption[]
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

export async function getConsultationQuestions(): Promise<ConsultationQuestion[]> {
  return Promise.resolve(consultationQuestions)
}

export async function getDepartmentList(): Promise<DepartmentOption[]> {
  return Promise.resolve(mockDepartments)
}

export async function getDoctorList(department: string): Promise<DoctorOption[]> {
  return Promise.resolve(
    mockDepartments.find((item) => item.label === department || item.value === department)?.doctors || []
  )
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
