import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/api/directory.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
})
const directory = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

test('bootstrap 请求体携带 doctorId，缺省或空白时不携带（旧客户端兼容路径）', () => {
  const withDoctor = directory.buildBootstrapRequestBody({
    requestId: 'req-1',
    departmentId: 5,
    doctorId: 'u-123'
  })
  assert.equal(withDoctor.doctorId, 'u-123')
  assert.equal(withDoctor.departmentId, 5)

  const withoutDoctor = directory.buildBootstrapRequestBody({ requestId: 'req-2', departmentId: 5 })
  assert.equal('doctorId' in withoutDoctor, false)

  const blankDoctor = directory.buildBootstrapRequestBody({ doctorId: '   ' })
  assert.equal('doctorId' in blankDoctor, false)

  // 旧固定医生展示键混入 doctorId 字段时也不得清空为显式空串，而是直接省略
  const legacyDisplayKey = directory.buildBootstrapRequestBody({ doctorId: null })
  assert.equal('doctorId' in legacyDisplayKey, false)
})

test('真实医生映射：doctorId 即可提交的 sys_user.id，默认可选', () => {
  const doctor = directory.mapBackendDoctor({
    id: 'u-1',
    displayKey: 'doctor-u-1',
    doctorId: 'u-1',
    value: 'u-1',
    name: '张三',
    label: '张三',
    source: 'real',
    disabled: false,
    disabledReason: null
  })
  assert.deepEqual(
    { doctorId: doctor.doctorId, value: doctor.value, disabled: doctor.disabled, source: doctor.source },
    { doctorId: 'u-1', value: 'u-1', disabled: false, source: 'real' }
  )
  assert.equal(directory.isSelectableDoctor(doctor), true)
})

test('旧固定医生映射：doctorId 为空、禁选并标注原因，展示键不回填为 doctorId', () => {
  const legacy = directory.mapBackendDoctor({
    id: 'legacy-doctor-101',
    displayKey: 'legacy-doctor-101',
    doctorId: null,
    value: null,
    name: '张文静',
    label: '张文静',
    source: 'legacy',
    disabled: true,
    disabledReason: '未关联医生账号'
  })
  assert.equal(legacy.doctorId, null)
  assert.equal(legacy.disabled, true)
  assert.equal(legacy.disabledReason, '未关联医生账号')
  assert.equal(legacy.value, 'legacy-doctor-101')
  assert.notEqual(legacy.value, legacy.doctorId)
  assert.equal(directory.isSelectableDoctor(legacy), false)

  // 缺少 doctorId 的异常条目同样视为禁用，展示键不得充当 doctorId
  const broken = directory.mapBackendDoctor({ id: 'doctor-ghost', name: '幽灵医生' })
  assert.equal(broken.doctorId, null)
  assert.equal(broken.disabled, true)
  assert.equal(directory.isSelectableDoctor(broken), false)
})

test('预问诊科室映射：保留字符串化业务 ID 与展示键的分离', () => {
  const dept = directory.mapBackendDepartment({
    id: 5,
    departmentId: 5,
    displayKey: 'preconsult-5',
    sysDeptId: 'sys-uuid-1',
    name: '呼吸内科',
    source: 'preconsult',
    disabled: false,
    disabledReason: null
  })
  assert.equal(dept.departmentId, '5')
  assert.equal(dept.value, 'preconsult-5')
  assert.equal(dept.sysDeptId, 'sys-uuid-1')
  assert.equal(dept.disabled, false)
  assert.equal(directory.isSelectableDepartment(dept), true)
  assert.equal(directory.toPreconsultDepartmentId(dept.departmentId), 5)
})

test('助手独有未映射科室：无业务 ID、保留展示并禁选，展示键不当作 departmentId', () => {
  const dept = directory.mapBackendDepartment({
    id: 'assistant-uuid-9',
    departmentId: null,
    displayKey: 'assistant-uuid-9',
    sysDeptId: 'sys-uuid-9',
    name: '全科医疗科',
    source: 'assistant',
    disabled: true,
    disabledReason: '暂未配置预问诊模板'
  })
  assert.equal(dept.departmentId, null)
  assert.equal(dept.disabled, true)
  assert.equal(dept.disabledReason, '暂未配置预问诊模板')
  assert.equal(directory.toPreconsultDepartmentId(dept.value), undefined)
  assert.equal(directory.isSelectableDepartment(dept), false)
})

test('未配置模板的预问诊科室：保留业务 ID 但禁选，恢复配置后随 disabled=false 开放', () => {
  const disabled = directory.mapBackendDepartment({
    departmentId: 7,
    displayKey: 'preconsult-7',
    name: '心血管内科',
    disabled: true,
    disabledReason: '暂未配置预问诊模板'
  })
  assert.equal(disabled.departmentId, '7')
  assert.equal(directory.isSelectableDepartment(disabled), false)

  const enabled = directory.mapBackendDepartment({ ...disabled, disabled: false, disabledReason: null })
  assert.equal(enabled.disabledReason, null)
  assert.equal(directory.isSelectableDepartment(enabled), true)
})

test('业务 ID 解析仅接受正整数，展示键与非法值一律拒绝', () => {
  assert.equal(directory.toPreconsultDepartmentId('12'), 12)
  assert.equal(directory.toPreconsultDepartmentId('preconsult-5'), undefined)
  assert.equal(directory.toPreconsultDepartmentId('assistant-uuid'), undefined)
  assert.equal(directory.toPreconsultDepartmentId(''), undefined)
  assert.equal(directory.toPreconsultDepartmentId(null), undefined)
  assert.equal(directory.toPreconsultDepartmentId(3.5), undefined)
})
