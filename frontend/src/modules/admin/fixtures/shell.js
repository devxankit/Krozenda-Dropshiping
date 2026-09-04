import { ADMIN_ROUTES, adminPath } from '../../../config/routes'

// Shape matches schemas/shellSchema.js exactly — that schema validates this
// fixture today and the API response tomorrow.
export function shellSummaryFixture() {
  return {
    counts: {
      productApprovals: 34,
      openReturns: 5,
      pendingKyc: 12,
      failedPayouts: 2,
    },
    notifications: [
      {
        id: 'ntf-1',
        tone: 'danger',
        title: '2 payouts failed',
        body: 'Nova Retail and Sunrise Traders — bank details need updating before the next batch.',
        at: '18 minutes ago',
        to: ADMIN_ROUTES.SETTLEMENTS,
        read: false,
      },
      {
        id: 'ntf-2',
        tone: 'warning',
        title: 'SMS India Hub degraded',
        body: '3 DLT templates are still awaiting approval; order alerts are queued.',
        at: '1 hour ago',
        to: ADMIN_ROUTES.SETTINGS_INTEGRATIONS,
        read: false,
      },
      {
        id: 'ntf-3',
        tone: 'warning',
        title: 'KYC waiting 4 days',
        body: 'Nova Retail Pvt Ltd resubmitted a GST certificate on 29 Aug.',
        at: '3 hours ago',
        to: adminPath.kycReview('kyc-2184'),
        read: false,
      },
      {
        id: 'ntf-4',
        tone: 'brand',
        title: '34 products awaiting approval',
        body: '28 marketplace listings and 6 dropship listings are queued for review.',
        at: 'Yesterday',
        to: ADMIN_ROUTES.CATALOG_APPROVALS,
        read: true,
      },
      {
        id: 'ntf-5',
        tone: 'success',
        title: 'GSTR-3B filed',
        body: 'July 2026 return filed on 18 August. Acknowledgement stored against the period.',
        at: '2 days ago',
        to: ADMIN_ROUTES.TAX_CENTER,
        read: true,
      },
    ],
  }
}
