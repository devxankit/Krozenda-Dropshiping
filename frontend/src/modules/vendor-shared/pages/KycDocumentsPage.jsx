import { useState } from 'react'
import { Badge, Button, Skeleton } from '../../../components/ui'
import { PageHeader } from '../../admin/components/shell/PageHeader'
import { PageBody } from '../../admin/components/shell/PageBody'
import { DataTable } from '../../admin/components/data/DataTable'
import { useVendorKycDocsController } from '../controllers/useVendorController'
import { VENDOR_KYC_DOC_COLUMNS } from '../tableColumns/vendorColumns'
import { UploadKycModal } from '../components/modals/UploadKycModal'

export function KycDocumentsPage() {
  const { data, isLoading } = useVendorKycDocsController()
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  const kycList = data?.items || []
  const approvedCount = kycList.filter((d) => d.status === 'APPROVED').length
  const isFullyApproved = kycList.length > 0 && approvedCount === kycList.length

  return (
    <PageBody>
      <PageHeader
        title="KYC Verification & Compliance"
        subtitle="Submit GSTIN, PAN, and Bank proof for Razorpay Route automated payout enablement."
        actions={
          <Button variant="primary" size="sm" onClick={() => setIsUploadOpen(true)}>
            + Upload New Document
          </Button>
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

        <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
          <span className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
            Account Status
          </span>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone="brand" size="md">
              Submitted for Review
            </Badge>
          </div>
          <span className="mt-1 block text-2xs text-ink-subtle">
            Admin reviews each document individually
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
