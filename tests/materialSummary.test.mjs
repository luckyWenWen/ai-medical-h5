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
