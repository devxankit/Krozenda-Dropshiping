import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useListController } from './useListController'
import {
  fetchAdminShipments,
  fetchCarrierAccounts,
  fetchShippingOverview,
  fetchShippingSettings,
  saveShippingSettings,
  testPlatformConnection,
} from '../services/shippingService'

const SETTINGS_KEY = ['admin', 'shipping', 'settings']
const OVERVIEW_KEY = ['admin', 'shipping', 'overview']
const ACCOUNTS_KEY = ['admin', 'shipping', 'accounts']
const SHIPMENTS_KEY = ['admin', 'shipping', 'shipments']

// Platform shipping policy: the switches, the platform's own carrier account,
// and what the server is actually configured to do.
export function useShippingSettingsController() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: fetchShippingSettings })

  // A local draft, so the form is editable without a round trip per keystroke
  // and the admin can discard. `null` means "no edits yet" — not "empty".
  const [draft, setDraft] = useState(null)

  const saveMutation = useMutation({
    mutationFn: saveShippingSettings,
    onSuccess: () => {
      setDraft(null)
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY })
      queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY })
    },
  })

  const testMutation = useMutation({
    mutationFn: testPlatformConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  })

  const saved = query.data?.settings ?? null
  const settings = draft ?? saved

  const update = useCallback(
    (field, value) => setDraft((current) => ({ ...(current ?? saved), [field]: value })),
    [saved]
  )

  const updatePackage = useCallback(
    (field, value) =>
      setDraft((current) => {
        const base = current ?? saved
        return { ...base, defaultPackage: { ...base.defaultPackage, [field]: value } }
      }),
    [saved]
  )

  // Which fields differ from what is stored, so the save bar can name them
  // rather than just saying "unsaved changes".
  const changed = []
  if (draft && saved) {
    for (const key of Object.keys(draft)) {
      if (key === 'defaultPackage') {
        if (JSON.stringify(draft.defaultPackage) !== JSON.stringify(saved.defaultPackage)) changed.push('defaultPackage')
      } else if (JSON.stringify(draft[key]) !== JSON.stringify(saved[key])) {
        changed.push(key)
      }
    }
  }

  return {
    data: query.data,
    settings,
    platformAccount: query.data?.platformAccount ?? null,
    readiness: query.data?.readiness ?? null,
    capabilities: query.data?.capabilities ?? {},
    strategies: query.data?.strategies ?? [],

    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,

    update,
    updatePackage,
    changed,
    discard: () => setDraft(null),

    // Only the changed fields are sent. A full-object PUT would overwrite a
    // setting another admin changed while this form sat open.
    save: () => saveMutation.mutateAsync(Object.fromEntries(changed.map((key) => [key, settings[key]]))),
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error,

    testPlatformConnection: testMutation.mutateAsync,
    isTesting: testMutation.isPending,
    testResult: testMutation.data ?? null,
    testError: testMutation.error,
  }
}

export function useShippingOverviewController() {
  const query = useQuery({ queryKey: OVERVIEW_KEY, queryFn: fetchShippingOverview })
  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

export function useCarrierAccountsController() {
  return useListController({ queryKey: ACCOUNTS_KEY, queryFn: fetchCarrierAccounts })
}

export function useAdminShipmentsController() {
  return useListController({ queryKey: SHIPMENTS_KEY, queryFn: fetchAdminShipments, defaultTab: 'all' })
}
