import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/utils/ocrReport.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
})
const { getOcrDisplay } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)
const fixture = await readFile(new URL('./fixtures/ocr-blood-report.txt', import.meta.url), 'utf8')

test('双栏报告合并为按序号排列的25个项目，保留数值精度和原始单位', () => {
  const display = getOcrDisplay(fixture)
  assert.equal(display.title, '市人民医院血常规报告单')
  assert.deepEqual(display.rows.map((row) => row.seq), Array.from({ length: 25 }, (_, i) => String(i + 1)))
  assert.deepEqual(display.rows[0], {
    seq: '1', code: 'WBC', name: '白细胞', result: '7.33', unit: '10^9/L', reference: '4--10', abnormal: false
  })
  assert.equal(display.rows[1].unit, '10^12/L')
  assert.equal(display.rows[3].unit, '%')
  assert.equal(display.rows[8].result, '32.10')
  assert.equal(display.rows[18].name, '红细胞分布宽度-CV')
  assert.equal(display.rows[18].unit, '10^9/L')
  assert.equal(display.rows[22].result, '0.20')
  assert.deepEqual(display.rows.filter((row) => row.abnormal).map((row) => row.code), ['MONOP'])
  assert.equal(display.rows[10].reference, '↑ 3--8')
})

test('分别提取同一行的多个报告信息，不将空字段或未知值错误拼接', () => {
  const meta = Object.fromEntries(getOcrDisplay(fixture).meta.map(({ label, value }) => [label, value]))
  assert.equal(meta['姓名'], '（无法辨认）')
  assert.equal(meta['标本编号'], '31')
  assert.equal(meta['申请科室'], '门诊抽血室')
  assert.equal(meta['送检医师'], '许沛然')
  assert.equal(meta['条码编号'], '0300341757')
  assert.equal(meta['核收时间'], '2009-03-21 08:45')
  assert.equal(meta['报告时间'], '2009-03-21 09:15:32')
  assert.equal(meta['病案'], undefined)
  assert.equal(meta['标本种类'], undefined)
})

test('缺少单位和参考值时保留缺失，不推测数据或异常', () => {
  const { rows } = getOcrDisplay(fixture)
  assert.equal(rows[14].unit, '')
  assert.equal(rows[14].reference, '')
  assert.equal(rows[24].unit, '')
  assert.equal(rows[24].reference, '男:0--15')
  const [row] = getOcrDisplay('1 WBC 白细胞 15.20 10^9/L 4--10').rows
  assert.equal(row.abnormal, false)
})

test('兼容旧的逐行字段及没有序号的旧格式', () => {
  const display = getOcrDisplay('血常规报告单\n姓名：\n张三\n1\nWBC\n白细胞\n7.33\n10^9/L\n4--10\nMONOP\n单核细胞比率\n↑9.10\n%\n3--8')
  assert.deepEqual(display.meta, [{ label: '姓名', value: '张三' }])
  assert.equal(display.rows.length, 2)
  assert.equal(display.rows[0].reference, '4--10')
  assert.equal(display.rows[1].seq, '11')
  assert.equal(display.rows[1].result, '↑9.10')
  assert.equal(display.rows[1].abnormal, true)
})

test('支持全角分栏和新旧混合行，去除重复项目', () => {
  const display = getOcrDisplay('1 WBC 白细胞 7.33 10^9/L 4--10｜2 RBC 红细胞 4.76 10^12/L 3.5--5.5\n1 WBC 白细胞 7.33 10^9/L 4--10\n3\nHGB\n血红蛋白\n151\ng/L\n110--160')
  assert.deepEqual(display.rows.map((row) => row.code), ['WBC', 'RBC', 'HGB'])
})

test('空文本和非检验资料可回退展示原文，不生成虚假的检验项目或标题', () => {
  assert.deepEqual(getOcrDisplay(), { title: '', meta: [], rows: [] })
  assert.deepEqual(getOcrDisplay('处方：每日一次，餐后服用').rows, [])
  assert.equal(getOcrDisplay('报告时间：2009-03-21 09:15:32').title, '')
})
