interface OcrDisplayRow {
  seq: string
  code: string
  name: string
  result: string
  unit: string
  reference: string
  abnormal: boolean
}

const bloodRoutineCodeSeq: Record<string, string> = {
  WBC: '1',
  RBC: '2',
  HGB: '3',
  HCT: '4',
  MCV: '5',
  MCH: '6',
  MCHC: '7',
  PLT: '8',
  LYMPHP: '9',
  NEUTP: '10',
  MONOP: '11',
  EOP: '12',
  E0P: '12',
  BASOP: '13',
  LYMPHN: '14',
  NEUT: '15',
  MONON: '16',
  EON: '17',
  BASON: '18',
  'RDW-CV': '19',
  'RDW-SD': '20',
  PDW: '21',
  MPV: '22',
  PCT: '23',
  'P-LCR': '24',
  ESR: '25'
}

function normalizeOcrLines(text?: string) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function isReportHeader(line: string) {
  return /^(序号|代码|项目名称|项目|结果|单位|参考值)$/.test(line)
}

function isLikelyCode(line: string) {
  return /^[A-Z][A-Z0-9-]{1,}$/.test(line) || /^[A-Z]-[A-Z]+$/.test(line)
}

function isLikelyResult(line: string) {
  return /^[↑↓+\-]?\d+(?:\.\d+)?$/.test(line)
}

function isLikelyUnit(line: string) {
  return /^(%|fL|pg|g\/L|mg\/L|mmol\/L|umol\/L|10\^?\d+\/L|10\d+\/L)$/i.test(line)
}

function isLikelyReference(line: string) {
  return /^[男女]?[：:]?\s*[↑↓]?\d+(?:\.\d+)?\s*[-—~－]+\s*\d+(?:\.\d+)?$/.test(line)
    || /^[↑↓]?\d+(?:\.\d+)?\s*[-—~－]+\s*\d+(?:\.\d+)?$/.test(line)
}

function splitSequenceAndCode(line: string) {
  const matched = line.match(/^(\d{1,2})\s*([A-Za-z][A-Za-z0-9-]*)?$/)
  if (!matched) return null
  return {
    seq: matched[1],
    code: matched[2] || ''
  }
}

function getRowStart(lines: string[], index: number, inferredSeq: number) {
  const current = lines[index]
  const sequenceStart = splitSequenceAndCode(current)
  if (sequenceStart) return sequenceStart

  const previous = lines[index - 1] || ''
  const next = lines[index + 1] || ''
  if (
    isLikelyCode(current) &&
    !splitSequenceAndCode(previous) &&
    /[\u4e00-\u9fa5]/.test(next || '')
  ) {
    return {
      seq: bloodRoutineCodeSeq[current.toUpperCase()] || String(inferredSeq),
      code: current
    }
  }

  return null
}

function splitNameAndInlineResult(line: string) {
  const matched = line.match(/^(.+?)([↑↓]?\d+(?:\.\d+)?)$/)
  if (!matched || !/[\u4e00-\u9fa5]/.test(matched[1])) {
    return { name: line, result: '' }
  }
  return {
    name: matched[1].trim(),
    result: matched[2]
  }
}

const ocrMetaLabels = [
  '姓名',
  '性别',
  '年龄',
  '病案',
  '费别',
  '标本编号',
  '申请科室',
  '送检医师',
  '条码编号',
  '床号',
  '标本种类',
  '临床诊断',
  '核收时间',
  '报告时间',
  '检验者',
  '审核者'
]

function cleanOcrValue(value: string) {
  return value
    .replace(/[|｜]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getStructuredMeta(lines: string[]) {
  const labelPattern = ocrMetaLabels.map((label) => label.split('').join('\\s*')).join('|')
  const labelRegex = new RegExp(`(${labelPattern})\\s*[：:]`, 'g')
  const meta: Array<{ label: string; value: string }> = []

  lines.forEach((line) => {
    const matches = Array.from(line.matchAll(labelRegex))
    matches.forEach((match, index) => {
      const valueStart = (match.index || 0) + match[0].length
      const valueEnd = index + 1 < matches.length
        ? (matches[index + 1].index || line.length)
        : line.length
      const value = cleanOcrValue(line.slice(valueStart, valueEnd))
      if (value) meta.push({ label: match[1].replace(/\s/g, ''), value })
    })
  })

  return Array.from(
    new Map(meta.map((item) => [`${item.label}:${item.value}`, item])).values()
  )
}

function parseStructuredOcrRow(segment: string): OcrDisplayRow | null {
  const row = segment.trim()
  const matched = row.match(/^(\d{1,2})\s+([A-Z][A-Z0-9-]*)\s+(.+?)\s+([↑↓]?\d+(?:\.\d+)?)\s*(.*)$/)
  if (!matched) return null

  const [, seq, code, rawName, result, rawTail] = matched
  let tail = rawTail.trim()
  let unit = ''
  const unitMatch = tail.match(/^(10\^?\d+\/L|10\d+\/L|%|fL|pg|g\/L|mg\/L|mmol\/L|umol\/L)(?=\s|$)\s*/i)
  if (unitMatch) {
    unit = unitMatch[1]
    tail = tail.slice(unitMatch[0].length).trim()
  }

  const reference = cleanOcrValue(tail)
  return {
    seq,
    code,
    name: cleanOcrValue(rawName),
    result,
    unit,
    reference,
    abnormal: result.includes('↑') || result.includes('↓') || reference.includes('↑') || reference.includes('↓')
  }
}

function getStructuredOcrRows(lines: string[]) {
  const rows: OcrDisplayRow[] = []
  lines.forEach((line) => {
    line.split(/[|｜]/).forEach((segment) => {
      const row = parseStructuredOcrRow(segment)
      if (row) rows.push(row)
    })
  })

  return Array.from(
    new Map(rows.map((row) => [`${row.seq}-${row.code}`, row])).values()
  ).sort((a, b) => Number(a.seq) - Number(b.seq))
}

export function getOcrDisplay(text?: string) {
  const lines = normalizeOcrLines(text)
  const titleLine = lines.find((line) => /报告单|报告(?:\s|$)/.test(line)) || ''
  const title = titleLine.match(/[\u4e00-\u9fa5A-Za-z0-9（）()·-]{2,}(?:报告单|报告)/)?.[0] || titleLine
  const structuredMeta = getStructuredMeta(lines)
  const structuredRows = getStructuredOcrRows(lines)
  const metaKeys = ['姓名', '性别', '年龄', '标本编号', '标本种类', '申请科室', '送检医师', '条码编号', '临床诊断', '核收时间', '报告时间']
  const meta: Array<{ label: string; value: string }> = []

  lines.forEach((line, index) => {
    const inline = line.match(/^(.{2,8}?)[：:]\s*(.+)$/)
    if (inline && metaKeys.includes(inline[1].trim()) && inline[2].trim()) {
      meta.push({ label: inline[1].trim(), value: inline[2].trim() })
      return
    }

    const splitLabel = line.match(/^(.{2,8}?)[：:]$/)
    const next = lines[index + 1] || ''
    if (
      splitLabel &&
      metaKeys.includes(splitLabel[1].trim()) &&
      next &&
      !isReportHeader(next) &&
      !splitSequenceAndCode(next)
    ) {
      meta.push({ label: splitLabel[1].trim(), value: next })
    }
  })

  const rows: OcrDisplayRow[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i]
    const start = getRowStart(lines, i, rows.length + 1)
    if (!start) continue

    let cursor = i + 1
    let code = start.code
    if (!code && isLikelyCode(lines[cursor] || '')) {
      code = lines[cursor]
      cursor += 1
    }
    if (!code) continue

    const nameLine = lines[cursor] || ''
    if (!nameLine || isReportHeader(nameLine) || splitSequenceAndCode(nameLine)) continue

    const nameInfo = splitNameAndInlineResult(nameLine)
    let name = nameInfo.name
    let result = nameInfo.result
    cursor += 1

    if (!result && isLikelyResult(lines[cursor] || '')) {
      result = lines[cursor]
      cursor += 1
    }
    if (!result) continue

    let unit = ''
    let reference = ''
    const maybeUnit = lines[cursor] || ''
    if (isLikelyUnit(maybeUnit)) {
      unit = maybeUnit
      cursor += 1
    }

    const maybeReference = lines[cursor] || ''
    if (isLikelyReference(maybeReference)) {
      reference = maybeReference
    }

    rows.push({
      seq: start.seq,
      code,
      name,
      result,
      unit,
      reference,
      abnormal: result.includes('↑') || result.includes('↓') || reference.includes('↑') || reference.includes('↓')
    })
  }

  const uniqRows = Array.from(
    new Map(rows.map((row) => [`${row.seq}-${row.code}-${row.name}`, row])).values()
  ).sort((a, b) => Number(a.seq) - Number(b.seq))

  const usedMeta = new Set(meta.map((item) => `${item.label}:${item.value}`))
  const uniqMeta = meta.filter((item) => {
    const key = `${item.label}:${item.value}`
    if (!usedMeta.has(key)) return false
    usedMeta.delete(key)
    return true
  })

  return {
    title,
    meta: Array.from(
      new Map([...uniqMeta, ...structuredMeta].map((item) => [item.label, item])).values()
    ).sort((a, b) => ocrMetaLabels.indexOf(a.label) - ocrMetaLabels.indexOf(b.label)),
    rows: Array.from(
      new Map([...uniqRows, ...structuredRows].map((row) => [`${row.seq}-${row.code}`, row])).values()
    ).sort((a, b) => Number(a.seq) - Number(b.seq))
  }
}

