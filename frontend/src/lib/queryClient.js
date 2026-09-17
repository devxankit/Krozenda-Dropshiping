// Shared react-query client. Module controllers import this indirectly via
// QueryClientProvider (wired in App.jsx) — they should not instantiate their
// own QueryClient.

import { QueryClient } from '@tanstack/react-query'

// Retry policy, rather than a flat count:
//
//   - Anything the user cancelled, or a 4xx, is never retried — a 401/403/404
//     will answer exactly the same way the second time, and retrying a 429
//     is actively harmful.
//   - A network error, a timeout or a 502/503/504 is transient, so two
//     retries with backoff is worth it.
//
// Mutations keep retry: 0 across the board. Order creation, payment
// verification and coupon redemption are the mutations that matter, and none
// of them may be repeated automatically (the order endpoint is idempotent by
// key, but only when the CLIENT decides to resend — see useCheckoutController).
function shouldRetry(failureCount, error) {
  if (failureCount >= 2) return false
  if (!error) return false
  if (error.code === 'CANCELLED') return false
  if (error.status >= 400 && error.status < 500) return false
  return Boolean(error.isRetryable)
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: shouldRetry,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      // Deliberately off: a WebView returning from the background fires focus
      // events, and refetching every mounted query at once is exactly the
      // "20 duplicate requests on resume" the audit calls out. Screens that
      // genuinely need fresh data on resume ask for it explicitly.
      refetchOnWindowFocus: false,
      // On by default in react-query; turned on explicitly here because it is
      // the behaviour the offline handling depends on — a query that failed
      // while offline refetches itself when the connection returns.
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
})
