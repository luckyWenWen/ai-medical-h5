import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'

interface ApiEnvelope<T> {
  code?: number | string
  data?: T
  msg?: string
  message?: string
  success?: boolean
  [key: string]: unknown
}

type RequestConfig = Omit<AxiosRequestConfig, 'url' | 'method'>

export interface PatientAuthInfo {
  patientId?: string
  username?: string
  patientName?: string
  phone?: string | null
  idCard?: string | null
  gender?: string | null
  age?: number | null
  token?: string
  tokenName?: string
  expiration?: number
  [key: string]: unknown
}

export interface PatientProfileInfo {
  patientId?: string
  username?: string
  patientName?: string
  phone?: string | null
  idCard?: string | null
  gender?: string | null
  age?: number | null
  token?: string | null
  tokenName?: string | null
  expiration?: number | null
  [key: string]: unknown
}

export interface PatientProfileUpdateDTO {
  patientName?: string
  phone?: string
  idCard?: string
  gender?: string
  age?: number | null
}

function saveTokenFromResponse(body: ApiEnvelope<any> | any): string | null {
  const data = body?.data
  const token =
    (typeof data === 'string' && data) ||
    (data && typeof data === 'object' &&
      (data.token ||
        data.accessToken ||
        data.access_token ||
        data.tokenValue ||
        data.tokenStr ||
        data.Authorization ||
        data.authorization)) ||
    body?.token ||
    body?.accessToken ||
    body?.access_token ||
    body?.tokenValue ||
    body?.tokenStr ||
    body?.Authorization ||
    body?.authorization

  if (!token) return null

  const cleanToken = String(token).replace(/^Bearer\s+/i, '')
  localStorage.setItem('patient_token', cleanToken)
  return cleanToken
}

function saveTokenFromHeaders(headers: Record<string, unknown> | undefined): string | null {
  if (!headers) return null

  const token =
    headers.authorization ||
    headers.Authorization ||
    headers['x-auth-token'] ||
    headers['X-Auth-Token'] ||
    headers['x-token'] ||
    headers['X-Token']

  if (!token) return null

  const cleanToken = String(token).replace(/^Bearer\s+/i, '')
  localStorage.setItem('patient_token', cleanToken)
  return cleanToken
}

// 自动从当前 URL (query 或 hash) 提取 Token 存储到 localStorage
export function extractAndSaveUrlToken(): string | null {
  try {
    const searchParams = new URLSearchParams(window.location.search)
    const hashSplit = window.location.hash.split('?')
    const hashParams = new URLSearchParams(hashSplit[1] || '')

    const rawToken =
      searchParams.get('token') ||
      searchParams.get('satoken') ||
      searchParams.get('Authorization') ||
      hashParams.get('token') ||
      hashParams.get('satoken')

    if (rawToken) {
      const cleanToken = rawToken.replace(/^Bearer\s+/i, '')
      localStorage.setItem('patient_token', cleanToken)
      return cleanToken
    }
  } catch (e) {
    console.warn('提取 URL Token 失败:', e)
  }
  return localStorage.getItem('patient_token')
}

// 只读取现有 Auth Token；没有登录态时交给路由跳转登录页。
export async function ensureAuthToken(): Promise<string | null> {
  return extractAndSaveUrlToken()
}

export async function sendSmsCode(phone: string): Promise<void> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
  await axios.post(
    `${baseUrl}/preconsult/client/auth/sms/send`,
    { phone },
    { timeout: 10000 }
  )
}

export async function loginWithPassword(username: string, password: string): Promise<PatientAuthInfo> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
  const res = await axios.post<ApiEnvelope<any>>(
    `${baseUrl}/preconsult/client/auth/login`,
    { username, password },
    { timeout: 10000, withCredentials: true }
  )
  const body = res.data
  if (isPlainObject(body) && (body.success === false || !isSuccessCode(body.code))) {
    throw new Error(body.message || body.msg || '登录失败')
  }

  const data = (isPlainObject(body) && 'data' in body ? body.data : body) as PatientAuthInfo
  const token =
    saveTokenFromResponse(body) ||
    saveTokenFromHeaders(res.headers as Record<string, unknown>)

  const csrfHeader = res.headers['x-csrf-token'] || res.headers['X-CSRF-Token']
  if (csrfHeader) localStorage.setItem('csrf_token', String(csrfHeader))

  return {
    ...data,
    token: data?.token || token || undefined
  }
}

export async function refreshAuthToken(): Promise<string | null> {
  localStorage.removeItem('patient_token')
  localStorage.removeItem('csrf_token')
  return ensureAuthToken()
}

export const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
  withCredentials: true
})

request.interceptors.request.use(async (config) => {
  let token = localStorage.getItem('patient_token') || extractAndSaveUrlToken()
  if (!token) {
    token = await ensureAuthToken()
  }

  if (token) {
    const raw = token.replace(/^Bearer\s+/i, '')
    config.headers.Authorization = `Bearer ${raw}`
    config.headers.satoken = raw
  }

  const csrfToken = localStorage.getItem('csrf_token')
  if (csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken
  }

  return config
})

request.interceptors.response.use((response) => {
  const csrfHeader = response.headers['x-csrf-token'] || response.headers['X-CSRF-Token']
  if (csrfHeader) {
    localStorage.setItem('csrf_token', String(csrfHeader))
  }
  return response
})

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function isSuccessCode(code: number | string | undefined) {
  return code === undefined || code === 0 || code === 200 || code === '0' || code === '200'
}

function unwrapResponse<T>(response: AxiosResponse<ApiEnvelope<T> | T>): T {
  const body = response.data

  if (isPlainObject(body) && ('code' in body || 'success' in body || 'data' in body)) {
    const envelope = body as ApiEnvelope<T>

    if (envelope.code === 401 || envelope.code === '401') {
      console.warn('接口返回 401 未授权，请确认 Token 状态')
      throw new Error('Unauthorized')
    }

    if (envelope.success === false || !isSuccessCode(envelope.code)) {
      throw new Error(envelope.message || envelope.msg || '请求失败')
    }

    if ('data' in envelope) {
      return envelope.data as T
    }
  }

  return body as T
}

export const http = {
  request<T = unknown>(config: AxiosRequestConfig) {
    return request.request<ApiEnvelope<T> | T>(config).then(unwrapResponse<T>)
  },
  get<T = unknown>(url: string, config?: RequestConfig) {
    return http.request<T>({ ...config, url, method: 'GET' })
  },
  post<T = unknown>(url: string, data?: unknown, config?: RequestConfig) {
    return http.request<T>({ ...config, url, method: 'POST', data })
  },
  put<T = unknown>(url: string, data?: unknown, config?: RequestConfig) {
    return http.request<T>({ ...config, url, method: 'PUT', data })
  },
  del<T = unknown>(url: string, config?: RequestConfig) {
    return http.request<T>({ ...config, url, method: 'DELETE' })
  }
}

export async function getCurrentPatientTokenInfo(): Promise<PatientAuthInfo> {
  return http.get<PatientAuthInfo>('/preconsult/client/auth/token')
}

export async function getCurrentPatientProfile(): Promise<PatientProfileInfo> {
  return http.get<PatientProfileInfo>('/preconsult/client/auth/profile')
}

export async function updateCurrentPatientProfile(payload: PatientProfileUpdateDTO): Promise<PatientProfileInfo> {
  return http.put<PatientProfileInfo>('/preconsult/client/auth/profile', payload)
}
