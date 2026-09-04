// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import * as service from '../services/systemService'
import { useListController } from './useListController'

export const useAuditLogController = () =>
  useListController({ queryKey: ['admin', 'system', 'audit'], queryFn: service.fetchAuditLog })

export const useSupportTicketController = () =>
  useListController({ queryKey: ['admin', 'support', 'tickets'], queryFn: service.fetchSupportTickets })

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
export const useAdminProfileController = () => useResource(['admin', 'profile'], service.fetchAdminProfile)
