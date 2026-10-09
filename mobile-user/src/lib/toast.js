// toast API compatible with the web app's lib/toast.jsx (react-hot-toast wrapper):
//   toast('msg') toast.success(title, description?) toast.error(error | title, error?) toast.warning
//   toast.info toast.loading toast.promise toast.dismiss. Rendered by components/ui/ToastHost.
import { create } from 'zustand'

export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback
  if (typeof err === 'string') return err
  if (err.response?.data?.message && typeof err.response.data.message === 'string') return err.response.data.message
  if (err.data?.message && typeof err.data.message === 'string') return err.data.message
  if (err.message && typeof err.message === 'string') return err.message
  return fallback
}

let seq = 0
export const useToastStore = create(() => ({ toasts: [] }))

const timers = new Map()

function push(type, title, description, duration) {
  const id = `t${++seq}`
  useToastStore.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, type, title, description }] }))
  if (duration > 0) timers.set(id, setTimeout(() => dismiss(id), duration))
  return id
}

function dismiss(id) {
  if (id === undefined) {
    useToastStore.setState({ toasts: [] })
    return
  }
  clearTimeout(timers.get(id))
  timers.delete(id)
  useToastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}

const isErrorLike = (v) => v instanceof Error || (v && typeof v === 'object' && ('message' in v || 'response' in v))

function parse(first, second) {
  if (isErrorLike(first)) {
    const msg = getErrorMessage(first)
    return typeof second === 'string' ? { title: second, description: msg } : { title: msg }
  }
  if (typeof second === 'string') return { title: first, description: second }
  if (isErrorLike(second) && typeof first === 'string') return { title: first, description: getErrorMessage(second) }
  return { title: typeof first === 'string' ? first : String(first ?? '') }
}

export const toast = (message) => {
  const { title, description } = parse(message)
  return push('blank', title, description, 4000)
}
toast.success = (a, b) => { const p = parse(a, b); return push('success', p.title, p.description, 3500) }
toast.error = (a, b) => { const p = parse(a, b); return push('error', p.title, p.description, 5500) }
toast.warning = (a, b) => { const p = parse(a, b); return push('warning', p.title, p.description, 4500) }
toast.info = (a, b) => { const p = parse(a, b); return push('info', p.title, p.description, 3500) }
toast.loading = (message) => push('loading', String(message), undefined, 0)
toast.dismiss = dismiss
toast.remove = dismiss
toast.promise = async (promise, msgs = {}) => {
  const id = toast.loading(msgs.loading || 'Processing...')
  try {
    const data = await promise
    dismiss(id)
    const m = typeof msgs.success === 'function' ? msgs.success(data) : msgs.success
    toast.success(m || 'Success!')
    return data
  } catch (err) {
    dismiss(id)
    const m = typeof msgs.error === 'function' ? msgs.error(err) : msgs.error
    toast.error(m || getErrorMessage(err))
    throw err
  }
}

export default toast
