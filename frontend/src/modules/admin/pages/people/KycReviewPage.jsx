import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Avatar, Badge, Button, Textarea } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton, PermissionGate } from '../../components/feedback'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import { DocumentList, DocumentViewer } from '../../components/people/KycReview'
import { DecisionStrip } from '../../components/people/KycDecision'
import { KycMetaRail } from '../../components/people/KycMetaRail'
import { ADMIN_PERMISSIONS, REVIEW_STATUS_LABELS, REVIEW_STATUS_TONE } from '../../constants'
import { useKycApplicationController, useKycDecisionController } from '../../controllers/usePeopleController'

export function KycReviewPage() {
  const { applicationId } = useParams()
  const { data: application, isLoading, error, refetch } = useKycApplicationController(applicationId)
  const [selectedId, setSelectedId] = useState(null)
  const [docNote, setDocNote] = useState('')
  const [appDecision, setAppDecision] = useState(null) // 'REJECTED' | 'UNDER_REVIEW'
  const [appReason, setAppReason] = useState('')

  const decisions = useKycDecisionController({
    applicationId,
    onDone: () => {
      setAppDecision(null)
      setAppReason('')
    },
  })

  if (isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={3} />
      </PageBody>
    )
  }
  if (error) {
    return (
      <PageBody>
        <ErrorState error={error} onRetry={refetch} />
      </PageBody>
    )
  }

  const selected =
    application.documents.find((document) => document.id === selectedId && document.fileName) ||
    application.documents.find((document) => document.fileName)

  const approveApplication = () =>
    decisions.decideApplication.run({ vendorId: application.vendorId, verificationStatus: 'APPROVED' })

  const requestChanges = () =>
    decisions.decideApplication.run({
      vendorId: application.vendorId,
      verificationStatus: 'UNDER_REVIEW',
    })

  return (
    <PageBody>
      <PageHeader
        title={application.vendorName}
        trail={[{ label: application.vendorName }]}
        actions={
          <PermissionGate permission={ADMIN_PERMISSIONS.KYC_REVIEW}>
            <Button
              variant="secondary"
              size="control"
              icon="send"
              onClick={requestChanges}
              isLoading={decisions.decideApplication.isSubmitting && appDecision === null}
            >
              Mark under review
            </Button>
            <Button variant="dangerOutline" size="control" onClick={() => setAppDecision('REJECTED')}>
              Reject application
            </Button>
            <Button
              size="control"
              icon="check"
              onClick={approveApplication}
              isLoading={decisions.decideApplication.isSubmitting}
            >
              Approve seller
            </Button>
          </PermissionGate>
        }
      >
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-ink-subtle">
          <Avatar name={application.vendorName} size="xs" />
          <Badge tone={REVIEW_STATUS_TONE[application.status]} dot>
            {REVIEW_STATUS_LABELS[application.status]}
          </Badge>
          <span className="tabular">{application.id}</span>
          <span className="text-border-strong">·</span>
          <span>{application.model}</span>
          <span className="text-border-strong">·</span>
          <span>
            Submitted {application.submittedAt} · waiting {application.waitingDays} days
          </span>
        </div>
      </PageHeader>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <DocumentList
            documents={application.documents}
            selectedId={selected?.id}
            onSelect={(id) => {
              setSelectedId(id)
              setDocNote('')
            }}
          />

          {selected && (
            <DocumentViewer
              document={selected}
              declared={[
                { label: 'GSTIN', value: <span className="tabular">{application.business.gstin}</span> },
                { label: 'Legal name', value: application.vendorName },
                { label: 'PAN', value: <span className="tabular">{application.business.pan}</span> },
                { label: 'Constitution', value: application.business.constitution },
              ]}
              footer={
                <DecisionStrip
                  note={docNote}
                  onNoteChange={setDocNote}
                  disabled={decisions.decideDocument.isSubmitting}
                  onApprove={() =>
                    decisions.decideDocument.run({
                      vendorId: application.vendorId,
                      documentId: selected.id,
                      status: 'APPROVED',
                    })
                  }
                  onReject={() =>
                    decisions.decideDocument.run({
                      vendorId: application.vendorId,
                      documentId: selected.id,
                      status: 'REJECTED',
                      rejectionReason: docNote,
                    })
                  }
                />
              }
            />
          )}
        </div>

        <KycMetaRail application={application} />
      </div>

      <ConfirmDialog
        isOpen={appDecision === 'REJECTED'}
        onClose={() => {
          setAppDecision(null)
          setAppReason('')
        }}
        title={`Reject ${application.vendorName}?`}
        description="The seller is notified with your reason and stays blocked from going live until they resubmit."
        confirmLabel="Reject application"
        tone="danger"
        isSubmitting={decisions.decideApplication.isSubmitting}
        onConfirm={() =>
          decisions.decideApplication.run({
            vendorId: application.vendorId,
            verificationStatus: 'REJECTED',
            rejectionReason: appReason,
          })
        }
      >
        <Textarea
          id="kyc-reject-reason"
          label="Reason for rejection"
          rows={3}
          required
          placeholder="e.g. GSTIN does not match the declared business name…"
          value={appReason}
          onChange={(event) => setAppReason(event.target.value)}
        />
      </ConfirmDialog>
    </PageBody>
  )
}
