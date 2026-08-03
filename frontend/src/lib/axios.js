// Shared axios instance. This is the ONLY place that builds request/response
// interceptors — module `services/` files import `api` from here and call
// it, they never construct their own axios instance (enforced by the
// no-restricted-imports ESLint rule on pages/, see eslint.config.js).

import axios from 'axios'
import { env } from '../config/env'
import { storage } from './storage'
import { useAuthStore } from './authStore'

export const api = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: env.apiTimeoutMs,
})

api.interceptors.request.use((config) => {
  const token = storage.getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Normalised error shape every caller can rely on, regardless of whether the
// failure was a network error, a timeout, or an API error response.
function normaliseError(error) {
  if (error.response) {
    const { status, data } = error.response
    return {
      status,
      code: data?.code ?? 'API_ERROR',
      message: data?.message ?? 'Something went wrong. Please try again.',
      details: data?.details ?? null,
    }
  }
  if (error.request) {
    return {
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Network error — check your connection.',
      details: null,
    }
  }
  return { status: 0, code: 'CLIENT_ERROR', message: error.message, details: null }
}

// Single in-flight refresh, shared by every request that hits a 401 while it
// is pending, so a burst of parallel requests only triggers one refresh call.
let refreshPromise = null

function refreshAccessToken() {
  if (!refreshPromise) {
    const refreshToken = storage.getRefreshToken()
    refreshPromise = axios
      .post(`${env.apiBaseUrl}/auth/refresh-token`, { refreshToken })
      .then(({ data }) => {
        storage.setAccessToken(data.accessToken)
        if (data.refreshToken) storage.setRefreshToken(data.refreshToken)
        return data.accessToken
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    const is401 = error.response?.status === 401
    if (is401 && !originalRequest._retry && storage.getRefreshToken()) {
      originalRequest._retry = true
      try {
        const accessToken = await refreshAccessToken()
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch {
        useAuthStore.getState().clearSession()
        return Promise.reject(normaliseError(error))
      }
    }

    if (is401) {
      useAuthStore.getState().clearSession()
    }

    return Promise.reject(normaliseError(error))
  },
)
