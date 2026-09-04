import { useState } from 'react'
import { Badge, Button, Skeleton } from '../../../components/ui'
import { PageHeader } from '../../admin/components/shell/PageHeader'
import { PageBody } from '../../admin/components/shell/PageBody'
import { DataTable } from '../../admin/components/data/DataTable'
import { useVendorKycDocsController } from '../controllers/useVendorController'
import { VENDOR_KYC_DOC_COLUMNS } from '../tableColumns/vendorColumns'
import { UploadKycModal } from '../components/modals/UploadKycModal'

export function KycDocumentsPage() {
  const { data: docs, isLoading } = useVendorKycDocsController()
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  const kycList = docs || []
  const mandatoryUploaded = kycList.filter((d) => d.required && d.status === 'approved').length
  const totalMandatory = kycList.filter((d) => d.required).length

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
            <Badge tone="success" size="md">
              Fully Approved
            </Badge>
          </div>
          <span className="mt-1 block text-2xs text-emerald-600 font-medium">
            Account verified for live B2B & retail sales
          </span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
          <span className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
            Mandatory Documents
          </span>
          <div className="mt-2 text-xl font-bold text-slate-900">
            {mandatoryUploaded} of {totalMandatory} Verified
          </div>
          <span className="mt-1 block text-2xs text-ink-subtle">
            PAN, GST, & Bank proof active
          </span>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
          <span className="text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
            Payout Clearance
          </span>
          <div className="mt-2 flex items-center gap-2">
            <Badge tone="brand" size="md">
              Unlocked
            </Badge>
          </div>
          <span className="mt-1 block text-2xs text-ink-subtle">
            Razorpay Route settlement active
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
