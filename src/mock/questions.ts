import type { ConsultationQuestion } from '@/types/consultation'

export const commonSymptoms = [
  '发热',
  '咳嗽',
  '头痛',
  '腹痛',
  '恶心',
  '乏力',
  '胸闷',
  '皮疹'
]

export const consultationQuestions: ConsultationQuestion[] = [
  {
    id: 'chiefSymptom',
    title: '请问您这次主要哪里不舒服？可以选择一个或多个症状。',
    type: 'multi',
    required: true,
    options: commonSymptoms.map((item) => ({ label: item, value: item }))
  },
  {
    id: 'duration',
    title: '这些症状大概持续了多久？',
    type: 'single',
    required: true,
    allowUnknown: true,
    options: [
      { label: '今天刚开始', value: '今天刚开始' },
      { label: '1-3 天', value: '1-3 天' },
      { label: '4-7 天', value: '4-7 天' },
      { label: '超过 1 周', value: '超过 1 周' }
    ]
  },
  {
    id: 'temperature',
    title: '如果有发热，请填写最高体温。',
    type: 'number',
    allowUnknown: true,
    placeholder: '例如 38.5',
    unit: '℃'
  },
  {
    id: 'severity',
    title: '请描述目前症状严重程度。',
    type: 'single',
    required: true,
    options: [
      { label: '轻微，不影响活动', value: '轻微' },
      { label: '中等，影响日常活动', value: '中等' },
      { label: '严重，难以忍受', value: '严重' }
    ]
  },
  {
    id: 'pastHistory',
    title: '您是否有以下既往病史？',
    type: 'multi',
    allowUnknown: true,
    options: [
      { label: '高血压', value: '高血压' },
      { label: '糖尿病', value: '糖尿病' },
      { label: '冠心病', value: '冠心病' },
      { label: '哮喘', value: '哮喘' },
      { label: '手术史', value: '手术史' },
      { label: '以上均无', value: '以上均无' }
    ]
  },
  {
    id: 'allergyHistory',
    title: '是否有药物、食物或环境过敏？',
    type: 'text',
    allowUnknown: true,
    placeholder: '例如 青霉素过敏；如无可填写无'
  },
  {
    id: 'treatment',
    title: '本次不适是否已经用药或接受过治疗？',
    type: 'text',
    allowUnknown: true,
    placeholder: '请填写用药、检查或治疗经过'
  },
  {
    id: 'materials',
    title: '如有病历、检查报告或患处图片，请上传资料。',
    type: 'upload',
    allowUnknown: true
  }
]
