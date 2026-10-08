import type { ConsultationReportOcrItem, UploadMaterial } from '@/types/consultation'

export interface MaterialOcrDisplay {
  id: string
  name: string
  type: UploadMaterial['type']
  url: string
  ocrText: string
  ocrSummary: string
  ocrError: string
}

export function parseMaterialSummary(summary: string): MaterialOcrDisplay[] {
  if (!summary || summary.trim() === '未上传检查资料') return []
  return summary
    .split(/(?=【报告[：:]\s*[^】]+】)/g)
    .map<MaterialOcrDisplay | null>((part, index) => {
      const matched = part.match(/【报告[：:]\s*([^】]+)】/)
      if (!matched) return null
      const name = matched[1].trim()
      const ocrText = part
        .replace(matched[0], '')
        .replace(/^[；;，,\s]+/, '')
        .trim()
      const failed = /^图片\s*OCR\s*识别异常/.test(ocrText)

      return {
        id: `summary-${index}-${name}`,
        name,
        type: 'file' as const,
        url: '',
        ocrText: failed ? '' : ocrText,
        ocrSummary: '',
        ocrError: failed ? '图片 OCR 识别异常' : ''
      }
    })
    .filter((item): item is MaterialOcrDisplay => Boolean(item))
}

export function getMaterialSummaryInfo(summary: string, ocrResults: ConsultationReportOcrItem[] = []) {
  const text = summary.trim()
  const parsed = parseMaterialSummary(text)
  if (ocrResults.length) {
    const materials = ocrResults.map<MaterialOcrDisplay>((item, index) => {
      const name = item.fileName || `报告${index + 1}`
      const legacyMaterial = parsed.find((material) => material.name === name)
      const ocrText = item.ocrText?.trim() ? item.ocrText : (legacyMaterial?.ocrText || '')
      const failed = /^图片\s*OCR\s*识别异常/.test(ocrText)
      const url = item.fileUrl || ''
      return {
        id: `ocr-result-${index}`,
        name,
        type: url && !/\.pdf(?:$|[?#])/i.test(name) && !/\.pdf(?:$|[?#])/i.test(url) ? 'image' : 'file',
        url,
        ocrText: failed ? '' : ocrText,
        ocrSummary: '',
        ocrError: failed ? '图片 OCR 识别异常' : (ocrText ? '' : (legacyMaterial?.ocrError || ''))
      }
    })
    const recognizedCount = materials.filter((item) => item.ocrText).length
    return {
      text: `已上传 ${materials.length} 份资料${recognizedCount ? `，已识别 ${recognizedCount} 份` : ''}`,
      materials
    }
  }
  if (!text || text === '未上传检查资料') {
    return { text: '未上传检查资料', materials: [] as MaterialOcrDisplay[] }
  }

  const reportedCount = text.match(/^已上传\s*(\d+)/)?.[1]
  const count = reportedCount === undefined ? parsed.length : Number(reportedCount)
  if (reportedCount !== undefined && count === 0 && !parsed.length) {
    return { text: '未上传检查资料', materials: [] as MaterialOcrDisplay[] }
  }
  const recognizedCount = parsed.filter((item) => item.ocrText).length
  const materials = parsed.length ? parsed : [{
    id: 'summary-raw',
    name: '上传资料',
    type: 'file' as const,
    url: '',
    ocrText: text,
    ocrSummary: '',
    ocrError: ''
  }]

  return {
    text: count
      ? `已上传 ${count} 份资料${recognizedCount ? `，已识别 ${recognizedCount} 份` : ''}`
      : '资料摘要已生成',
    materials
  }
}
