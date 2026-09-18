import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Skeleton } from '../../../../components/ui'
import { useVendorProfileController } from '../../controllers/useVendorController'
import { VENDOR_ONBOARDING_ALLOWED } from '../../constants'

// Verification state is NOT a permission. The JWT a PENDING seller holds is a
// perfectly valid vendor token — protectVendor accepts it deliberately, so
// they can sign in and see where their application stands. What it must not do
// is hand them a panel built for an approved seller: before this gate existed,
// a brand-new registration landed on a dashboard promising orders, payouts and
// a live catalog, none of which could ever populate.
//
// So the gate reads the vendor's own profile (the same GET /vendor/auth/me the
// Store Profile screen uses) and allows only the screens that exist to get
// them approved. Everything else redirects to the status page.
//
// The server is still the real boundary: every /vendor/* route re-reads the
// vendor, and admin-side approval is what actually unlocks selling. This is a
// navigation guard, not a security one.
export function VendorOnboardingGate() {
  const { pathname } = useLocation()
  const { data: vendor, isLoading, isError } = useVendorProfileController()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  // A profile that will not load is not a reason to lock someone out of their
  // own panel — the per-request checks on the server still hold, and a
  // transient 500 here would otherwise strand an approved seller on the
  // onboarding screen.
  if (isError || !vendor) return <Outlet />

  if (vendor.verificationStatus === 'APPROVED') return <Outlet />

  const isAllowed = VENDOR_ONBOARDING_ALLOWED.some(
    (suffix) => pathname.endsWith(`/${suffix}`) || pathname.includes(`/${suffix}/`),
  )

  if (!isAllowed) {
    const base = pathname.startsWith('/partner') ? '/partner' : '/seller'
    return <Navigate to={`${base}/status`} replace />
  }

  return <Outlet />
}
