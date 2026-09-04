import { create } from 'zustand'

// Write feedback for the whole panel. A mutation that changes data owes the
// operator a sentence saying what changed — a silent success is
// indistinguishable from a dead button, which is how the panel read before
// the write layer existed.
//
// `toast` is a plain object rather than a hook so controllers can call it
// from inside a react-query callback, where hooks are not available.

let sequence = 0

export const useToastStore = create((set) => ({
  toasts: [],

  push: ({ tone = 'success', title, description, timeout = 4500 }) => {
    sequence += 1
    const id = sequence
    set((state) => ({ toasts: [...state.toasts, { id, tone, title, description }] }))

    if (timeout) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((entry) => entry.id !== id) }))
      }, timeout)
    }

    return id
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((entry) => entry.id !== id) })),
  clear: () => set({ toasts: [] }),
}))

export const toast = Object.freeze({
  success: (title, description) => useToastStore.getState().push({ tone: 'success', title, description }),
  info: (title, description) => useToastStore.getState().push({ tone: 'info', title, description }),
  warning: (title, description) => useToastStore.getState().push({ tone: 'warning', title, description }),
  // Failures stay on screen longer: they usually carry a reason worth reading.
  error: (title, description) =>
    useToastStore.getState().push({ tone: 'danger', title, description, timeout: 8000 }),
})
