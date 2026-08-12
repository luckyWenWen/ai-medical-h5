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

let autoLoginPromise: Promise<string | null> | null = null

// 自动确保有效 Auth Token，如本地未存储则尝试自动登录获取
export async function ensureAuthToken(): Promise<string | null> {
  let token = extractAndSaveUrlToken()
  if (token) return token

  if (autoLoginPromise) return autoLoginPromise

  autoLoginPromise = (async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
      const res = await axios.post<ApiEnvelope<any>>(
        `${baseUrl}/preconsult/client/auth/login`,
        {},
        { timeout: 5000 }
      )
      const body = res.data
      const newToken =
        saveTokenFromResponse(body) ||
        saveTokenFromHeaders(res.headers as Record<string, unknown>)
      if (newToken) return newToken
    } catch (e) {
      console.warn('自动登录获取 H5 患者端 Auth Token 失败:', e)
    } finally {
      autoLoginPromise = null
    }
    return localStorage.getItem('patient_token')
  })()

  return autoLoginPromise
}

export async function sendSmsCode(phone: string): Promise<void> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
  await axios.post(
    `${baseUrl}/preconsult/client/auth/sms/send`,
    { phone },
    { timeout: 10000 }
  )
}

export async function loginWithSms(phone: string, code: string): Promise<string | null> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
  const res = await axios.post<ApiEnvelope<any>>(
    `${baseUrl}/preconsult/client/auth/login`,
    { phone, code, captcha: code },
    { timeout: 10000, withCredentials: true }
  )
  const token =
    saveTokenFromResponse(res.data) ||
    saveTokenFromHeaders(res.headers as Record<string, unknown>)

  const csrfHeader = res.headers['x-csrf-token'] || res.headers['X-CSRF-Token']
  if (csrfHeader) localStorage.setItem('csrf_token', String(csrfHeader))

  return token
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

