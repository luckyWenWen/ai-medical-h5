import type { DepartmentOption, DoctorOption } from '@/api/consultation'

/**
 * 科室/医生字典的纯映射与校验助手。
 *
 * 约束（design.md 第 3/4 节）：
 * - 展示键（displayKey）只用于选择器 UI，不是可提交的业务 ID；
 * - 预问诊业务 departmentId 必须是正整数（后端 Long），助手独有科室没有该 ID；
 * - 禁用条目（未配置模板的科室、旧固定医生、异常兜底数据）必须保留展示并禁选；
 * - 旧固定医生的展示键不是合法 doctorId，禁止回填为真实医生 ID。
 */

/** 兼容字段为空/非法时的提示文案 */
export const DEFAULT_DEPARTMENT_DISABLED_REASON = '该科室暂不可选'
export const DEFAULT_DOCTOR_DISABLED_REASON = '该医生暂不可选'
/** 旧固定医生（无医生账号）的禁选原因，与后端文案保持一致 */
export const LEGACY_DOCTOR_DISABLED_REASON = '未关联医生账号'

/**
 * 解析预问诊科室业务 ID：仅接受正整数（后端 Long ID）。
 * 展示键（如 assistant-xxx / preconsult-5）不是数字业务 ID，返回 undefined。
 */
export function toPreconsultDepartmentId(value: unknown): number | undefined {
  const departmentId = Number(value)
  return Number.isInteger(departmentId) && departmentId > 0 ? departmentId : undefined
}

/** 医生归属 ID：去除空白后非空才有效 */
export function normalizeDoctorId(value: unknown): string {
  return String(value ?? '').trim()
}

/** 科室是否可选：未禁用且携带可提交的预问诊业务 ID */
export function isSelectableDepartment(department: Pick<DepartmentOption, 'disabled' | 'departmentId'>): boolean {
  return !department.disabled && toPreconsultDepartmentId(department.departmentId) !== undefined
}

/** 医生是否可选：未禁用且携带真实 doctorId（sys_user.id） */
export function isSelectableDoctor(doctor: Pick<DoctorOption, 'disabled' | 'doctorId'>): boolean {
  return !doctor.disabled && normalizeDoctorId(doctor.doctorId) !== ''
}

/**
 * 后端科室条目 -> H5 选择器条目。
 *
 * - `value` 为跨来源唯一展示键（displayKey），不得当作 departmentId 提交；
 * - `departmentId` 仅预问诊科室有值（字符串化的 Long），助手独有科室为 null；
 * - 后端未标记禁用但缺少合法业务 ID 的条目同样视为禁用（防御异常兜底数据）。
 */
export function mapBackendDepartment(item: Record<string, any>): DepartmentOption {
  // 业务 ID 只信任 departmentId 字段；item.id 可能是助手展示键（assistant-<uuid>），
  // 或 admin 兜底列表的原始 id，均不得当作预问诊业务 ID 提交
  const departmentId = toPreconsultDepartmentId(item?.departmentId)
  const displayKey = String(
    item?.displayKey
    || (departmentId !== undefined ? `preconsult-${departmentId}` : '')
    || item?.code
    || item?.value
    || item?.name
    || ''
  )
  const disabled = Boolean(item?.disabled) || departmentId === undefined
  const disabledReason = disabled
    ? String(item?.disabledReason || DEFAULT_DEPARTMENT_DISABLED_REASON)
    : null

  return {
    label: String(item?.label || item?.name || item?.departmentName || '未定义科室'),
    value: displayKey,
    departmentId: departmentId !== undefined ? String(departmentId) : null,
    sysDeptId: item?.sysDeptId != null && String(item.sysDeptId) !== '' ? String(item.sysDeptId) : null,
    source: item?.source != null ? String(item.source) : null,
    disabled,
    disabledReason,
    doctors: []
  }
}

/**
 * 后端医生条目 -> H5 选择器条目。
 *
 * - `doctorId` 是唯一可提交的医生归属 ID（sys_user.id）；旧固定医生/兜底数据为 null；
 * - `value` 为选择器展示键：真实医生直接使用 doctorId，禁用条目退回展示键（仅用于 UI）；
 * - 无 doctorId 的条目一律禁用（旧固定医生 reason 使用后端文案“未关联医生账号”）。
 */
export function mapBackendDoctor(item: Record<string, any>): DoctorOption {
  const doctorId = normalizeDoctorId(item?.doctorId) || null
  const disabled = Boolean(item?.disabled) || doctorId === null
  const disabledReason = disabled
    ? String(item?.disabledReason || (doctorId === null ? LEGACY_DOCTOR_DISABLED_REASON : DEFAULT_DOCTOR_DISABLED_REASON))
    : null

  return {
    label: String(item?.label || item?.doctorName || item?.name || '医生'),
    value: doctorId ?? String(item?.displayKey || item?.id || ''),
    doctorId,
    source: String(item?.source || (doctorId ? 'real' : 'legacy')),
    disabled,
    disabledReason
  }
}

/** bootstrap 请求体（含可选 doctorId）；doctorId 为空时不出现在请求体中 */
export function buildBootstrapRequestBody(payload: {
  requestId?: string
  consentVersion?: string
  agreed?: boolean
  departmentId?: number
  doctorId?: string | null
  patientSnapshot?: Record<string, unknown>
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    requestId: payload?.requestId,
    consentVersion: payload?.consentVersion || '2026-07-v1',
    agreed: payload?.agreed ?? true,
    departmentId: payload?.departmentId,
    patientSnapshot: payload?.patientSnapshot
  }
  const doctorId = normalizeDoctorId(payload?.doctorId)
  if (doctorId) {
    body.doctorId = doctorId
  }
  return body
}
