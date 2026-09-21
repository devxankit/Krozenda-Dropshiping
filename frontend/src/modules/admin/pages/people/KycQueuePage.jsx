import { useNavigate } from 'react-router-dom'
import { adminPath } from '../../../../config/routes'
import { ExportMenu, ListScreen } from '../../components/data'
import { InlineAlert } from '../../components/feedback'
import { useKycQueueController } from '../../controllers/usePeopleController'
import { KYC_QUEUE_COLUMNS, KYC_TABS } from '../../tableColumns/peopleColumns'
import { downloadTableCsv } from '../../lib/exportCsv'

// Document collection plus MANUAL admin review. No third-party API validates
// PAN, Aadhaar, GST or FSSAI on this platform (project context §5.1) — the
// queue exists because a person has to read each one.
export function KycQueuePage() {
  const navigate = useNavigate()
  const list = useKycQueueController()
  const overdue = list.tabCounts.overdue || 0

  return (
    <ListScreen
      title="KYC review"
      description="Applications waiting on a human decision, oldest first."
      actions={<ExportMenu onExport={() => downloadTableCsv('kyc-review.csv', KYC_QUEUE_COLUMNS, list.items)} />}
      banner={
        overdue > 0 && (
          <InlineAlert tone="warning" title={`${overdue} applications have waited more than 3 days`}>
            Nothing here is verified automatically. A reviewer opens each document, checks it
            against the declared details, and approves or rejects it with a reason.
          </InlineAlert>
        )
      }
      controller={list}
      columns={KYC_QUEUE_COLUMNS}
      tabs={KYC_TABS}
      searchPlaceholder="Application, applicant or role…"
      onRowClick={(row) => navigate(adminPath.kycReview(row.id))}
      itemLabel="applications"
      emptyIcon="kyc"
      emptyTitle="Nothing waiting for review"
      emptyDescription="New submissions land here as soon as a seller finishes uploading."
    />
  )
}
