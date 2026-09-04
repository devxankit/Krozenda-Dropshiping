import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Avatar, Badge, Button } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton, PermissionGate } from '../../components/feedback'
import { DocumentList, DocumentViewer } from '../../components/people/KycReview'
import { DecisionStrip } from '../../components/people/KycDecision'
import { KycMetaRail } from '../../components/people/KycMetaRail'
import { ADMIN_PERMISSIONS, REVIEW_STATUS_LABELS, REVIEW_STATUS_TONE } from '../../constants'
import { useKycApplicationController } from '../../controllers/usePeopleController'

export function KycReviewPage() {
  const { applicationId } = useParams()
  const { data: application, isLoading, error, refetch } = useKycApplicationController(applicationId)
  const [selectedId, setSelectedId] = useState('doc-3')
  const [note, setNote] = useState('')

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

  return (
    <PageBody>
      <PageHeader
        title={application.vendorName}
        trail={[{ label: application.vendorName }]}
        actions={
          <PermissionGate permission={ADMIN_PERMISSIONS.KYC_REVIEW}>
            <Button variant="secondary" size="control" icon="send">
              Request changes
            </Button>
            <Button variant="dangerOutline" size="control">
              Reject application
            </Button>
            <Button size="control" icon="check">
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
            onSelect={setSelectedId}
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
              footer={<DecisionStrip note={note} onNoteChange={setNote} />}
            />
          )}
        </div>

        <KycMetaRail application={application} />
      </div>
    </PageBody>
  )
}
