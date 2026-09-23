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
//
// `isOffline`, `isTimeout` and `isRetryable` exist so screens can show the
// right message ("You're offline" vs "Request timed out" vs the server's own
// wording) instead of collapsing everything into "Something went wrong", and
// so react-query can decide what is safe to retry.
function normaliseError(error) {
  if (error.response) {
    const { status, data } = error.response
    return {
      status,
      code: data?.code ?? 'API_ERROR',
      message: data?.message ?? 'Something went wrong. Please try again.',
      details: data?.details ?? null,
      // 502/503/504 are transient infrastructure failures; 4xx and a plain 500
      // are not, and retrying them just multiplies the load.
      isRetryable: status === 502 || status === 503 || status === 504,
      isOffline: false,
      isTimeout: false,
      response: error.response,
    }
  }
  if (error.request) {
    const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
    // navigator.onLine is only trustworthy when it says false.
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    return {
      status: 0,
      code: isTimeout ? 'TIMEOUT' : offline ? 'OFFLINE' : 'NETWORK_ERROR',
      message: isTimeout
        ? 'The request timed out. Please try again.'
        : offline
          ? "You're offline. Please check your internet connection."
          : 'Network error — check your connection.',
      details: null,
      isRetryable: true,
      isOffline: offline,
      isTimeout,
    }
  }
  // A cancelled request is not a failure the user should ever be told about —
  // it means we navigated away or a newer request superseded this one.
  if (axios.isCancel(error)) {
    return { status: 0, code: 'CANCELLED', message: 'Request cancelled', details: null, isRetryable: false, isOffline: false, isTimeout: false }
  }
  return {
    status: 0,
    code: 'CLIENT_ERROR',
    message: error.message,
    details: null,
    isRetryable: false,
    isOffline: false,
    isTimeout: false,
  }
}

export function isCancelledError(error) {
  return error?.code === 'CANCELLED'
}

// Single in-flight refresh, shared by every request that hits a 401 while it
// is pending, so a burst of parallel requests only triggers one refresh call.
let refreshPromise = null

// The refresh endpoint is customer-only (POST /auth/refresh-token, see
// backend/Router/userAuthRoutes.js). Admin, seller and partner sessions share
// this same axios instance and this same token slot, so without this check a
// 401 in the admin panel would post the admin's token to the buyer refresh
// endpoint and then clear a session that was merely lacking a permission.
function isCustomerSession() {
  const roles = useAuthStore.getState().roles
  return roles.length === 0 || roles.includes('user') || roles.includes('customer')
}

function refreshAccessToken() {
  if (!refreshPromise) {
    const refreshToken = storage.getRefreshToken()
    // A bare axios call, not `api` — routing it through this instance would
    // put the refresh itself behind the 401 interceptor and, on a failing
    // refresh, recurse.
    refreshPromise = axios
      .post(`${env.apiBaseUrl}/auth/refresh-token`, { refreshToken }, { timeout: env.apiTimeoutMs })
      .then(({ data }) => {
        // The API wraps every response as { success, message, data }. Reading
        // `data.accessToken` off the envelope (rather than `data.data`) is why
        // the previous implementation could never have worked even once the
        // endpoint existed: it always stored `undefined`.
        const payload = data?.data ?? data
        if (!payload?.accessToken) {
          throw new Error('Refresh response did not contain an access token')
        }
        storage.setAccessToken(payload.accessToken)
        if (payload.refreshToken) storage.setRefreshToken(payload.refreshToken)
        return payload.accessToken
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
    if (axios.isCancel(error)) {
      return Promise.reject(normaliseError(error))
    }

    const originalRequest = error.config
    const is401 = error.response?.status === 401

    // `_retry` is the loop guard: a request is only ever replayed once. Without
    // it, a server that keeps answering 401 after a "successful" refresh would
    // drive request -> 401 -> refresh -> request -> 401 forever.
    const canRefresh =
      is401 &&
      originalRequest &&
      !originalRequest._retry &&
      // The refresh call itself must never trigger a refresh.
      !originalRequest.url?.includes('/auth/refresh-token') &&
      storage.getRefreshToken() &&
      isCustomerSession()

    if (canRefresh) {
      originalRequest._retry = true
      try {
        const accessToken = await refreshAccessToken()
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch {
        useAuthStore.getState().clearSession()
        return Promise.reject({
          ...normaliseError(error),
          code: 'SESSION_EXPIRED',
          message: 'Your session has expired. Please sign in again.',
        })
      }
    }

    if (is401) {
      useAuthStore.getState().clearSession()
      return Promise.reject({
        ...normaliseError(error),
        code: 'SESSION_EXPIRED',
        message: 'Your session has expired. Please sign in again.',
      })
    }

    return Promise.reject(normaliseError(error))
  },
)
