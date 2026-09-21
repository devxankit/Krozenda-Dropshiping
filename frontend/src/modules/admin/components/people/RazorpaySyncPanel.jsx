import { useState } from 'react'
import { Badge, Button, Checkbox, Select } from '../../../../components/ui'
import { PermissionGate } from '../feedback'
import { KeyValueList, SectionCard } from '../display'
import {
  ADMIN_PERMISSIONS,
  RAZORPAY_ONBOARDING_STATUS_LABELS,
  RAZORPAY_ONBOARDING_STATUS_OPTIONS,
  RAZORPAY_ONBOARDING_STATUS_TONE,
} from '../../constants'
import { useVendorRazorpaySyncController } from '../../controllers/usePeopleController'

const ONBOARDING_OPTIONS = RAZORPAY_ONBOARDING_STATUS_OPTIONS.map((value) => ({
  value,
  label: RAZORPAY_ONBOARDING_STATUS_LABELS[value],
}))

/**
 * Razorpay Route status for one vendor.
 *
 * There is no read endpoint that joins vendor.razorpay into the KYC/vendor
 * fetch — POST /admin/vendors/:id/razorpay/sync is the only place this data
 * comes from (see adminVendorController.syncVendorRazorpay), and it is also
 * how an admin pushes a correction. So this panel starts empty and shows
 * "not checked yet" until the admin presses Sync, and every subsequent
 * render reflects whatever that endpoint last returned in this session.
 */
export function RazorpaySyncPanel({ vendorId, routeLinkedHint }) {
  const sync = useVendorRazorpaySyncController()
  const [onboardingStatus, setOnboardingStatus] = useState('')
  const [isSettlementEligible, setIsSettlementEligible] = useState(false)

  const razorpay = sync.data?.razorpay || null

  function runSync(extra) {
    sync.run({ vendorId, ...extra })
  }

  function onSyncNow() {
    runSync({})
  }

  function onSaveOverrides() {
    runSync({
      onboardingStatus: onboardingStatus || undefined,
      isSettlementEligible,
    })
  }

  return (
    <SectionCard
      title="Razorpay Route"
      description="Seller-settlement linked account. Synced on demand — nothing here is live until you press Sync."
    >
      <div className="flex flex-col gap-3 px-4 py-3">
        {razorpay ? (
          <KeyValueList
            items={[
              {
                label: 'Onboarding status',
                value: (
                  <Badge tone={RAZORPAY_ONBOARDING_STATUS_TONE[razorpay.onboardingStatus] || 'neutral'} size="sm" dot>
                    {RAZORPAY_ONBOARDING_STATUS_LABELS[razorpay.onboardingStatus] || razorpay.onboardingStatus}
                  </Badge>
                ),
              },
              {
                label: 'Settlement eligible',
                value: (
                  <Badge tone={razorpay.isSettlementEligible ? 'success' : 'warning'} size="sm" dot>
                    {razorpay.isSettlementEligible ? 'Eligible' : 'Not eligible'}
                  </Badge>
                ),
              },
              { label: 'Linked account ID', value: <span className="tabular">{razorpay.accountId || '—'}</span> },
              { label: 'Bank on file', value: <span className="tabular">{sync.data.bankAccountMasked || '—'}</span> },
              {
                label: 'Last synced',
                value: razorpay.lastSyncedAt ? new Date(razorpay.lastSyncedAt).toLocaleString('en-IN') : '—',
              },
            ]}
          />
        ) : (
          <p className="text-2xs text-ink-faint">
            {routeLinkedHint
              ? 'This vendor is approved, so a linked account should exist — press Sync to check its current status.'
              : 'Not checked yet this session — press Sync to create or read the linked account.'}
          </p>
        )}

        <PermissionGate permission={ADMIN_PERMISSIONS.KYC_REVIEW}>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="control" icon="refresh" isLoading={sync.isSubmitting} onClick={onSyncNow}>
              Sync with Razorpay
            </Button>
          </div>

          <div className="mt-1 flex flex-wrap items-end gap-2.5 border-t border-border-subtle pt-3">
            <Select
              id={`razorpay-onboarding-status-${vendorId}`}
              label="Set onboarding status"
              value={onboardingStatus}
              onChange={(event) => setOnboardingStatus(event.target.value)}
              placeholder="Leave unchanged"
              options={ONBOARDING_OPTIONS}
            />
            <Checkbox
              id={`razorpay-settlement-eligible-${vendorId}`}
              label="Settlement eligible"
              checked={isSettlementEligible}
              onChange={(event) => setIsSettlementEligible(event.target.checked)}
            />
            <Button size="control" isLoading={sync.isSubmitting} onClick={onSaveOverrides}>
              Save
            </Button>
          </div>
        </PermissionGate>
      </div>
    </SectionCard>
  )
}
