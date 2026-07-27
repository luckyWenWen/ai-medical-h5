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

export const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000
})

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('patient_token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
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
