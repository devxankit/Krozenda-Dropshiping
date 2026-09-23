import React from 'react'
import baseToast from 'react-hot-toast'
import { HiInformationCircle, HiExclamationTriangle } from 'react-icons/hi2'

/**
 * Extracts a user-facing error message from any error shape
 * (Axios error response, standard Error, string, or unknown object).
 */
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback
  if (typeof err === 'string') return err

  // Normalized axios response or server payload
  if (err.response?.data?.message && typeof err.response.data.message === 'string') {
    return err.response.data.message
  }
  if (err.data?.message && typeof err.data.message === 'string') {
    return err.data.message
  }
  if (err.message && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}

/**
 * Renders a clean message or two-line title + description card.
 */
function ToastContent({ title, description }) {
  if (!description) {
    return <span className="text-sm font-medium leading-snug">{title}</span>
  }

  return (
    <div className="flex flex-col gap-0.5 text-left max-w-sm">
      <span className="text-sm font-semibold leading-tight text-slate-900">{title}</span>
      <span className="text-xs text-slate-600 leading-snug">{description}</span>
    </div>
  )
}

/**
 * Resolves overloaded arguments:
 * - fn(message, options)
 * - fn(title, description, options)
 * - fn(error, options)
 */
function parseArgs(first, second, third) {
  // If first argument is an Error or error-like object
  if (first instanceof Error || (first && typeof first === 'object' && ('message' in first || 'response' in first))) {
    const errorMsg = getErrorMessage(first)
    if (typeof second === 'string') {
      return {
        content: <ToastContent title={second} description={errorMsg} />,
        options: third || {},
      }
    }
    return {
      content: <ToastContent title={errorMsg} />,
      options: second || {},
    }
  }

  // If second argument is a string or JSX description
  if (typeof second === 'string' || React.isValidElement(second)) {
    return {
      content: <ToastContent title={first} description={second} />,
      options: third || {},
    }
  }

  // If second is options object or undefined
  return {
    content: React.isValidElement(first) ? first : <ToastContent title={first} />,
    options: (typeof second === 'object' && second !== null ? second : third) || {},
  }
}

/**
 * Enhanced toast helper wrapping react-hot-toast.
 * Fully compatible with single-string calls, two-argument (title, description) calls,
 * and error objects. Supports success, error, warning, info, loading, and promise.
 */
export const toast = (message, options) => {
  const { content, options: opts } = parseArgs(message, options)
  return baseToast(content, opts)
}

toast.success = (first, second, third) => {
  const { content, options } = parseArgs(first, second, third)
  return baseToast.success(content, {
    duration: 3500,
    ...options,
  })
}

toast.error = (first, second, third) => {
  // If first is a title and second is an error object
  if (typeof first === 'string' && second && typeof second === 'object' && ('message' in second || 'response' in second)) {
    const resolvedDesc = getErrorMessage(second)
    return baseToast.error(<ToastContent title={first} description={resolvedDesc} />, {
      duration: 5500,
      ...(third || {}),
    })
  }

  const { content, options } = parseArgs(first, second, third)
  return baseToast.error(content, {
    duration: 5500,
    ...options,
  })
}

toast.warning = (first, second, third) => {
  const { content, options } = parseArgs(first, second, third)
  return baseToast(content, {
    duration: 4500,
    icon: <HiExclamationTriangle className="w-5 h-5 text-amber-500 shrink-0" aria-hidden="true" />,
    ...options,
  })
}

toast.info = (first, second, third) => {
  const { content, options } = parseArgs(first, second, third)
  return baseToast(content, {
    duration: 3500,
    icon: <HiInformationCircle className="w-5 h-5 text-blue-500 shrink-0" aria-hidden="true" />,
    ...options,
  })
}

toast.loading = (message, options) => {
  return baseToast.loading(message, options)
}

toast.promise = (promise, msgs, options) => {
  return baseToast.promise(
    promise,
    {
      loading: msgs?.loading || 'Processing...',
      success: (data) => {
        const msg = typeof msgs?.success === 'function' ? msgs.success(data) : msgs?.success
        return msg || 'Success!'
      },
      error: (err) => {
        const msg = typeof msgs?.error === 'function' ? msgs.error(err) : msgs?.error
        return msg || getErrorMessage(err)
      },
    },
    options,
  )
}

toast.dismiss = (id) => baseToast.dismiss(id)
toast.remove = (id) => baseToast.remove(id)

export default toast
