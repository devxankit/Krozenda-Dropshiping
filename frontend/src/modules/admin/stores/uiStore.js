// Chrome state for the admin shell: whether the sidebar is collapsed, whether
// an overlay is open. This is UI state, not server state — it deliberately
// does NOT live in a controller (those are for react-query orchestration).

import { create } from 'zustand'

const COLLAPSED_KEY = 'krozenda.admin.sidebarCollapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsed(value) {
  try {
    localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0')
  } catch {
    // Storage unavailable — the preference just does not persist.
  }
}

export const useAdminUiStore = create((set, get) => ({
  sidebarCollapsed: readCollapsed(),
  mobileNavOpen: false,
  commandPaletteOpen: false,
  notificationsOpen: false,

  toggleSidebar: () => {
    const next = !get().sidebarCollapsed
    writeCollapsed(next)
    set({ sidebarCollapsed: next })
  },

  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
  closeOverlays: () =>
    set({ mobileNavOpen: false, commandPaletteOpen: false, notificationsOpen: false }),
}))
