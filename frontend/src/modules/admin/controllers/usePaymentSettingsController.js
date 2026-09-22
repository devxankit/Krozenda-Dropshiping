// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPaymentSettings, savePaymentSettings } from '../services/paymentSettingsService'

const SETTINGS_KEY = ['admin', 'payments', 'settings']

// Which payment methods (COD, Razorpay, Wallet) a buyer may choose at
// checkout. Same draft/save/discard shape as useShippingSettingsController.
export function usePaymentSettingsController() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: SETTINGS_KEY, queryFn: fetchPaymentSettings })

  const [draft, setDraft] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const saveMutation = useMutation({
    mutationFn: savePaymentSettings,
    onSuccess: () => {
      setDraft(null)
      setSaveSuccess(true)
      queryClient.invalidateQueries({ queryKey: SETTINGS_KEY })
      setTimeout(() => setSaveSuccess(false), 4000)
    },
  })

  const saved = query.data ?? null
  const settings = draft ?? saved

  const update = useCallback(
    (field, value) => {
      setDraft((current) => ({ ...(current ?? saved), [field]: value }))
      setSaveSuccess(false)
    },
    [saved]
  )

  const changed = []
  if (draft && saved) {
    for (const key of Object.keys(draft)) {
      if (draft[key] !== saved[key]) changed.push(key)
    }
  }

  return {
    data: query.data,
    settings,

    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,

    update,
    changed,
    discard: () => setDraft(null),

    save: () => saveMutation.mutateAsync(Object.fromEntries(changed.map((key) => [key, settings[key]]))),
    isSaving: saveMutation.isPending,
    saveError: saveMutation.error,
    saveSuccess,
  }
}
