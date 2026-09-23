import { toast as hotToast } from '../../../lib/toast'

// Bridge to the global react-hot-toast system.
// Any screen or controller importing `toast` from here continues to work seamlessly
// with full global react-hot-toast rendering.

export const toast = hotToast

// Kept for backward compatibility if any legacy subscriber imports useToastStore
export const useToastStore = {
  getState: () => ({
    toasts: [],
    push: ({ tone, title, description }) => {
      if (tone === 'danger' || tone === 'error') hotToast.error(title, description)
      else if (tone === 'warning') hotToast.warning(title, description)
      else if (tone === 'info') hotToast.info(title, description)
      else hotToast.success(title, description)
    },
    dismiss: (id) => hotToast.dismiss(id),
    clear: () => hotToast.dismiss(),
  }),
}
