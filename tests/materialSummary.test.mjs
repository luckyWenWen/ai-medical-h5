import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

async function loadUtility(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
  })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
}

const { getMaterialSummaryInfo } = await loadUtility('../src/utils/materialSummary.ts')
const { getOcrDisplay } = await loadUtility('../src/utils/ocrReport.ts')
const fixture = await readFile(new URL('./fixtures/ocr-blood-report.txt', import.meta.url), 'utf8')

test('历史记录摘要提取文件并复用报告解析，默认摘要不包含原文', () => {
  const info = getMaterialSummaryInfo(`已上传1个文件；关联报告内容：【报告: 血常规.jpg】\n${fixture}`)
  assert.equal(info.text, '已上传 1 份资料，已识别 1 份')
  assert.equal(info.materials.length, 1)
  assert.equal(info.materials[0].name, '血常规.jpg')
  assert.equal(info.materials[0].ocrText, fixture.trim())
  assert.equal(getOcrDisplay(info.materials[0].ocrText).rows.length, 25)
})

test('多文件摘要单独展示，识别失败与成功分开计数', () => {
  const info = getMaterialSummaryInfo('已上传2份资料；【报告：血常规.jpg】\n1 WBC 白细胞 7.33 10^9/L 4--10\n【报告: 处方.jpg】图片 OCR 识别异常')
  assert.equal(info.text, '已上传 2 份资料，已识别 1 份')
  assert.deepEqual(info.materials.map((item) => item.name), ['血常规.jpg', '处方.jpg'])
  assert.equal(info.materials[1].ocrText, '')
  assert.equal(info.materials[1].ocrError, '图片 OCR 识别异常')
  assert.equal(info.materials[0].ocrText.includes('处方.jpg'), false)
})

test('无文件标记的旧摘要仍可展开查看完整内容', () => {
  const info = getMaterialSummaryInfo(fixture)
  assert.equal(info.text, '资料摘要已生成')
  assert.equal(info.materials[0].ocrText, fixture.trim())
  assert.equal(getOcrDisplay(info.materials[0].ocrText).rows.length, 25)
})

test('空摘要和明确没有上传资料的记录不显示查看入口', () => {
  for (const summary of ['', '  ', '未上传检查资料', '已上传0个文件']) {
    assert.deepEqual(getMaterialSummaryInfo(summary), { text: '未上传检查资料', materials: [] })
  }
})

test('新的OCR结果数组优先展示，摘要缺失时仍保留文件、预览链接和结构化文本', () => {
  const info = getMaterialSummaryInfo('未上传检查资料', [
    { fileName: '血常规.jpg', fileUrl: '/reports/blood.jpg', ocrText: fixture },
    { fileName: '处方.pdf', fileUrl: '/reports/prescription.pdf?download=1' }
  ])
  assert.equal(info.text, '已上传 2 份资料，已识别 1 份')
  assert.equal(info.materials[0].url, '/reports/blood.jpg')
  assert.equal(info.materials[0].type, 'image')
  assert.equal(info.materials[1].type, 'file')
  assert.equal(info.materials[1].ocrText, '')
  assert.equal(getOcrDisplay(info.materials[0].ocrText).rows.length, 25)
})

test('新结果与旧摘要按文件名兼容，优先使用新文本且不重复生成文件卡片', () => {
  const summary = '已上传2个文件；【报告：血常规.jpg】图片 OCR 识别异常\n【报告：处方.jpg】每日一次，餐后服用'
  const info = getMaterialSummaryInfo(summary, [
    { fileName: '血常规.jpg', fileUrl: '/reports/blood.jpg', ocrText: fixture },
    { fileName: '处方.jpg', fileUrl: '/reports/prescription.jpg', ocrText: '' }
  ])
  assert.equal(info.materials.length, 2)
  assert.equal(info.text, '已上传 2 份资料，已识别 2 份')
  assert.equal(info.materials[0].ocrText, fixture)
  assert.equal(info.materials[0].ocrError, '')
  assert.equal(info.materials[1].ocrText, '每日一次，餐后服用')
})

test('新结果没有识别内容时只展示文件，不误计为识别成功', () => {
  const info = getMaterialSummaryInfo('', [
    { fileUrl: '/reports/one.jpg', ocrText: '图片 OCR 识别异常' },
    { fileUrl: '/reports/two.jpg', ocrText: '   ' }
  ])
  assert.equal(info.text, '已上传 2 份资料')
  assert.deepEqual(info.materials.map((item) => item.name), ['报告1', '报告2'])
  assert.equal(info.materials[0].ocrError, '图片 OCR 识别异常')
  assert.equal(info.materials[1].ocrText, '')
})
