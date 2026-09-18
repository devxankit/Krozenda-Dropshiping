import { useState } from 'react'
import { Badge, Button, Skeleton } from '../../../components/ui'
import { PageHeader } from '../../admin/components/shell/PageHeader'
import { PageBody } from '../../admin/components/shell/PageBody'
import { DataTable } from '../../admin/components/data/DataTable'
import { toast } from '../../admin/stores/toastStore'
import {
  useVendorKycDocsController,
  useVendorOnboardingState,
  useVendorSubmitForVerificationController,
} from '../controllers/useVendorController'
import { VENDOR_KYC_DOC_COLUMNS } from '../tableColumns/vendorColumns'
import { VENDOR_STATUS_LABELS, VENDOR_VERIFICATION_TONE } from '../constants'
import { UploadKycModal } from '../components/modals/UploadKycModal'

export function KycDocumentsPage() {
  const { data, isLoading } = useVendorKycDocsController()
  const { status, isLoading: isLoadingStatus } = useVendorOnboardingState()
  const { submit, isSubmitting } = useVendorSubmitForVerificationController()
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  const kycList = data?.items || []
  const approvedCount = kycList.filter((d) => d.status === 'APPROVED').length
  const isFullyApproved = kycList.length > 0 && approvedCount === kycList.length

  // submitForVerification only accepts PENDING and REJECTED — see
  // vendorAuthController. Offering the button in UNDER_REVIEW or APPROVED
  // would just produce a 400 the seller cannot act on.
  const canSubmit = ['PENDING', 'REJECTED'].includes(status) && kycList.length > 0

  async function handleSubmitApplication() {
    try {
      await submit()
      toast.success('Application submitted', 'An admin will review your documents shortly.')
    } catch (err) {
      toast.error('Could not submit', err?.response?.data?.message || 'Something went wrong')
    }
  }

  return (
    <PageBody>
      <PageHeader
        title="KYC Verification & Compliance"
        description="Submit GSTIN, PAN, and Bank proof for Razorpay Route automated payout enablement."
        actions={
          <div className="flex items-center gap-2">
            {canSubmit && (
              <Button variant="primary" size="sm" onClick={handleSubmitApplication} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting…' : status === 'REJECTED' ? 'Resubmit application' : 'Submit for review'}
              </Button>
            )}
            <Button variant={canSubmit ? 'secondary' : 'primary'} size="sm" onClick={() => setIsUploadOpen(true)}>
              + Upload New Document
            </Button>
          </div>
        }
      />

      {/* Compliance Overview Banner */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
          <span className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
            KYC Verification Status
          </span>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone={isFullyApproved ? 'success' : 'warning'} size="md">
              {isFullyApproved ? 'Fully Approved' : 'Review Pending'}
            </Badge>
          </div>
          <span className="mt-1 block text-2xs text-ink-subtle">
            {isFullyApproved ? 'All submitted documents are verified' : 'Some documents are awaiting admin review'}
          </span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
          <span className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
            Documents Submitted
          </span>
          <div className="mt-2 text-xl font-bold text-slate-900">
            {approvedCount} of {kycList.length} Verified
          </div>
          <span className="mt-1 block text-2xs text-ink-subtle">
            PAN, GST & Bank proof recommended
          </span>
        </div>

        {/* The vendor's real verificationStatus, not the document tally above.
            These two genuinely differ: every document can be APPROVED while
            the account itself is still UNDER_REVIEW, because an admin approves
            the account separately (adminVendorController.updateVendorStatus). */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
          <span className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
            Account Status
          </span>
          <div className="mt-2 flex items-center gap-2">
            {isLoadingStatus || !status ? (
              <Skeleton className="h-6 w-32 rounded-full" />
            ) : (
              <Badge tone={VENDOR_VERIFICATION_TONE[status] || 'neutral'} size="md">
                {VENDOR_STATUS_LABELS[status.toLowerCase()] || status}
              </Badge>
            )}
          </div>
          <span className="mt-1 block text-2xs text-ink-subtle">
            {status === 'PENDING'
              ? 'Upload your documents, then submit for review'
              : status === 'UNDER_REVIEW'
                ? 'An admin is reviewing your application'
                : status === 'REJECTED'
                  ? 'Fix the flagged documents and submit again'
                  : 'Admin reviews each document individually'}
          </span>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <div className="rounded-xl border border-border bg-surface shadow-2xs overflow-hidden">
          <div className="border-b border-border bg-surface-subtle px-5 py-3.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Uploaded KYC Document Repository
            </h3>
          </div>
          <DataTable columns={VENDOR_KYC_DOC_COLUMNS} data={kycList} />
        </div>
      )}

      <UploadKycModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
    </PageBody>
  )
}
