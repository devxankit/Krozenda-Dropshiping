// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../../lib/authStore'
import * as service from '../services/systemService'
import { useListController } from './useListController'
import { useAdminMutation } from './useAdminMutation'

export const useAuditLogController = () =>
  useListController({ queryKey: ['admin', 'system', 'audit'], queryFn: service.fetchAuditLog })

export const useSupportTicketController = () =>
  useListController({ queryKey: ['admin', 'support', 'tickets'], queryFn: service.fetchSupportTickets })

export const useSupportTicketDetailController = (ticketId) => {
  const query = useQuery({
    queryKey: ['admin', 'support', 'tickets', ticketId],
    queryFn: () => service.fetchSupportTicketDetail(ticketId),
    enabled: Boolean(ticketId),
  })
  return { data: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

const TICKET_LISTS = [['admin', 'support', 'tickets']]

export const useSupportTicketWriteController = () => ({
  sendMessage: useAdminMutation({
    mutationFn: service.sendSupportTicketMessage,
    invalidate: TICKET_LISTS,
  }),
  setStatus: useAdminMutation({
    mutationFn: service.updateSupportTicketStatus,
    invalidate: TICKET_LISTS,
    success: (ticket) => `Ticket marked as ${ticket.status}`,
  }),
  assign: useAdminMutation({
    mutationFn: service.assignSupportTicket,
    invalidate: TICKET_LISTS,
    success: (ticket) => (ticket.owner ? `Assigned to ${ticket.owner}` : 'Ticket unassigned'),
  }),
})

function useResource(key, queryFn) {
  const query = useQuery({ queryKey: key, queryFn })
  return {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}

const BUSINESS_RULES_KEY = ['admin', 'settings', 'business-rules']

// The money policy as an editable form: a local draft over the saved values,
// the list of changed fields for the save bar, and save/discard. Only the
// changed fields are sent, so two admins editing different rules do not
// overwrite each other.
export function useBusinessRulesController() {
  const query = useQuery({ queryKey: BUSINESS_RULES_KEY, queryFn: service.fetchBusinessRules })
  const [draft, setDraft] = useState(null)
  const saved = query.data ?? null
  const rules = draft ?? saved

  const changed = draft && saved ? Object.keys(draft).filter((key) => draft[key] !== saved[key]) : []

  const save = useAdminMutation({
    mutationFn: () => service.saveBusinessRules(Object.fromEntries(changed.map((key) => [key, draft[key]]))),
    invalidate: [BUSINESS_RULES_KEY, ['admin', 'settings', 'general']],
    success: 'Business rules saved',
    describe: () => 'They apply to transactions from now on.',
    onDone: () => setDraft(null),
  })

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    rules,
    changed,
    update: (field, value) => setDraft((current) => ({ ...(current ?? saved), [field]: value })),
    discard: () => setDraft(null),
    save: () => save.run(),
    isSaving: save.isSubmitting,
    saveError: save.error,
  }
}
export const useGeneralSettingsController = () =>
  useResource(['admin', 'settings', 'general'], service.fetchGeneralSettings)
export const useIntegrationsController = () =>
  useResource(['admin', 'settings', 'integrations'], service.fetchIntegrations)
export const useTaxSettingsController = () =>
  useResource(['admin', 'settings', 'taxes'], service.fetchTaxSettings)
export const useBackupsController = () => useResource(['admin', 'system', 'backups'], service.fetchBackups)

export const useRunBackupController = () =>
  useAdminMutation({
    mutationFn: service.runBackupNow,
    invalidate: [['admin', 'system', 'backups']],
    success: (run) => (run.status === 'success' ? 'Backup completed' : 'Backup failed'),
    describe: (run) => (run.sizeMb ? `${run.sizeMb} MB in ${run.durationSeconds}s` : undefined),
  })
export const useAdminProfileController = () => useResource(['admin', 'profile'], service.fetchAdminProfile)

// Editing your own account. A saved name or photo also refreshes the signed-in
// user in the auth store, so the topbar changes at once.
export function useAdminProfileWriteController({ onPasswordChanged } = {}) {
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)

  const update = useAdminMutation({
    mutationFn: service.updateAdminProfile,
    invalidate: [['admin', 'profile']],
    success: 'Profile updated',
    onDone: (result) => {
      const admin = result?.admin
      if (admin) setUser({ ...user, name: admin.name, email: admin.email, image: admin.image, mobileNumber: admin.mobileNumber })
    },
  })

  const changePassword = useAdminMutation({
    mutationFn: service.changeAdminPassword,
    success: 'Password changed',
    describe: () => 'Use the new password the next time you sign in.',
    onDone: onPasswordChanged,
  })

  return { update, changePassword }
}
