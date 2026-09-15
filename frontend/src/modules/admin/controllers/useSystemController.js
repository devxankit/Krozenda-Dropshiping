// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery } from '@tanstack/react-query'
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
  return { data: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export const useBusinessRulesController = () =>
  useResource(['admin', 'settings', 'business-rules'], service.fetchBusinessRules)
export const useGeneralSettingsController = () =>
  useResource(['admin', 'settings', 'general'], service.fetchGeneralSettings)
export const useIntegrationsController = () =>
  useResource(['admin', 'settings', 'integrations'], service.fetchIntegrations)
export const useSecuritySettingsController = () =>
  useResource(['admin', 'settings', 'security'], service.fetchSecuritySettings)
export const useWebhooksController = () =>
  useResource(['admin', 'settings', 'webhooks'], service.fetchWebhooks)
export const usePolicySettingsController = () =>
  useResource(['admin', 'settings', 'policies'], service.fetchPolicySettings)
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
