// The sidebar's "Own stock" switch. It reads and writes the same flag as the
// Approvals page's seller-only mode (CatalogSettings.sellerOnlyMode), just
// inverted: own stock ON = seller-only mode OFF. Turning it off blocks admin
// from adding products/categories/brands and hides admin's own products from
// buyers (backend utils/ownStock.js); seller and dropship products stay.

import { useAuthStore } from '../../../lib/authStore'
import { ADMIN_PERMISSIONS } from '../constants'
import { useApprovalSettingsController, useApprovalSettingsWriteController } from './useCatalogController'

export function useOwnStockController() {
  const canToggle = useAuthStore((state) => state.permissions.includes(ADMIN_PERMISSIONS.CATALOG_APPROVE))
  const { data } = useApprovalSettingsController({ enabled: canToggle })
  const writer = useApprovalSettingsWriteController()

  return {
    // Unknown until the settings load (or for staff who can't read them) —
    // the sidebar then renders as normal rather than guessing "off".
    isKnown: Boolean(data),
    enabled: data ? !data.sellerOnlyMode : true,
    canToggle,
    isSaving: writer.update.isSubmitting,
    setEnabled: (on, options) => writer.update.run({ sellerOnlyMode: !on }, options),
  }
}
