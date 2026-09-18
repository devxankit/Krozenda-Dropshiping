import { useLocation, useNavigate } from 'react-router-dom'
import { Badge, Button, Icon, Skeleton } from '../../../components/ui'
import { PageBody, PageHeader } from '../../admin/components/shell'
import { SectionCard } from '../../admin/components/display'
import { toast } from '../../admin/stores/toastStore'
import {
  useVendorKycDocsController,
  useVendorProfileController,
  useVendorSubmitForVerificationController,
} from '../controllers/useVendorController'
import { VENDOR_STATUS_LABELS, VENDOR_VERIFICATION_TONE } from '../constants'

const COPY = {
  PENDING: {
    headline: 'Finish your application',
    body: 'Upload your KYC documents, then submit your application. An admin reviews it and unlocks selling.',
  },
  UNDER_REVIEW: {
    headline: 'Your application is with our team',
    body: 'We are verifying your documents. You will be notified as soon as a decision is made — no action needed from you right now.',
  },
  REJECTED: {
    headline: 'Your application needs changes',
    body: 'Fix the points below, replace any document that was rejected, and submit again.',
  },
  APPROVED: {
    headline: 'You are verified',
    body: 'Your account is approved and every part of the panel is open.',
  },
}

function Step({ done, current, title, description, action }) {
  return (
    <div className="flex gap-3 px-4 py-3.5">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-bold ${
          done
            ? 'bg-emerald-100 text-emerald-700'
            : current
              ? 'bg-brand-100 text-brand-700'
              : 'bg-surface-muted text-ink-faint'
        }`}
      >
        {done ? <Icon name="check" className="h-3 w-3" /> : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-xs font-semibold ${done || current ? 'text-slate-900' : 'text-ink-subtle'}`}>{title}</p>
        <p className="mt-0.5 text-2xs text-ink-subtle">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function VendorOnboardingStatusPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // The panel is mounted at both /seller and /partner, so the sibling route is
  // derived rather than hard-coded — see getVendorNavTree for the same split.
  const panelBase = pathname.startsWith('/partner') ? '/partner' : '/seller'
  const { data: vendor, isLoading } = useVendorProfileController()
  const { data: docs, isLoading: isLoadingDocs } = useVendorKycDocsController()
  const { submit, isSubmitting } = useVendorSubmitForVerificationController()

  if (isLoading || !vendor) {
    return (
      <PageBody>
        <PageHeader title="Verification status" description="Where your seller application stands." />
        <Skeleton className="h-64 w-full rounded-xl" />
      </PageBody>
    )
  }

  const status = vendor.verificationStatus
  const copy = COPY[status] || COPY.PENDING
  const documents = docs?.items || []
  const rejectedDocs = documents.filter((d) => d.status === 'REJECTED')
  const hasDocuments = documents.length > 0
  const canSubmit = ['PENDING', 'REJECTED'].includes(status) && hasDocuments

  async function handleSubmit() {
    try {
      await submit()
      toast.success('Application submitted', 'An admin will review your documents shortly.')
    } catch (err) {
      toast.error('Could not submit', err?.response?.data?.message || 'Something went wrong')
    }
  }

  return (
    <PageBody>
      <PageHeader title="Verification status" description="Where your seller application stands." />

      <div className="mb-6 rounded-xl border border-border bg-surface p-5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={VENDOR_VERIFICATION_TONE[status] || 'neutral'} size="md">
            {VENDOR_STATUS_LABELS[status.toLowerCase()] || status}
          </Badge>
          <span className="text-sm font-semibold text-slate-900">{copy.headline}</span>
        </div>
        <p className="mt-2 max-w-2xl text-xs text-ink-subtle">{copy.body}</p>

        {status === 'REJECTED' && vendor.rejectionReason && (
          <p className="mt-3 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">
            <span className="font-semibold">Reason: </span>
            {vendor.rejectionReason}
          </p>
        )}
      </div>

      <SectionCard title="What happens next" description="Three steps from sign-up to selling">
        <div className="divide-y divide-border">
          <Step done title="Account created" description={`Signed up as ${vendor.email}`} />
          <Step
            done={hasDocuments && rejectedDocs.length === 0}
            current={!hasDocuments || rejectedDocs.length > 0}
            title="Upload KYC documents"
            description={
              isLoadingDocs
                ? 'Loading your documents…'
                : hasDocuments
                  ? `${documents.length} uploaded${rejectedDocs.length > 0 ? ` · ${rejectedDocs.length} rejected and need replacing` : ''}`
                  : 'PAN, GST certificate and a bank proof are the usual set.'
            }
            action={
              <Button size="xs" variant="secondary" onClick={() => navigate(`${panelBase}/kyc-documents`)}>
                Manage
              </Button>
            }
          />
          <Step
            done={status === 'APPROVED'}
            current={status === 'UNDER_REVIEW'}
            title="Admin review"
            description={
              status === 'UNDER_REVIEW'
                ? 'In progress — we will notify you when there is a decision.'
                : 'Submit your application once your documents are in.'
            }
            action={
              canSubmit ? (
                <Button size="xs" onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting…' : status === 'REJECTED' ? 'Resubmit' : 'Submit'}
                </Button>
              ) : null
            }
          />
        </div>
      </SectionCard>

      {!hasDocuments && ['PENDING', 'REJECTED'].includes(status) && (
        <p className="mt-4 text-2xs text-ink-subtle">
          Upload at least one document before submitting — an empty application cannot be reviewed.
        </p>
      )}
    </PageBody>
  )
}
