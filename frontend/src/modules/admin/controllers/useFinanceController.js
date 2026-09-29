// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import * as service from '../services/financeService'
import { useAdminMutation } from './useAdminMutation'

function useResource(key, queryFn, enabled = true) {
  const query = useQuery({ queryKey: key, queryFn, enabled })
  return { data: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export const useCommissionRulesController = () =>
  useResource(['admin', 'finance', 'commission-rules'], service.fetchCommissionRules)

export const useCommissionRuleWriteController = () =>
  useAdminMutation({
    mutationFn: service.updateCommissionRule,
    invalidate: [['admin', 'finance', 'commission-rules']],
    success: (rule) => `${rule.target} commission set to ${rule.value}%`,
  })
