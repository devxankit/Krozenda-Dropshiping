import { useNavigate } from 'react-router-dom'
import { Button, Table } from '../../../../components/ui'
import { adminPath } from '../../../../config/routes'
import { PageBody, PageHeader } from '../../components/shell'
import { ExportMenu, ListScreen } from '../../components/data'
import { ErrorState, InlineAlert, PageSkeleton } from '../../components/feedback'
import { KeyValueList, SectionCard } from '../../components/display'
import {
  useAuditLogController,
  useBackupsController,
  useRunBackupController,
  useSupportTicketController,
} from '../../controllers/useSystemController'
import * as columns from '../../tableColumns/systemColumns'
import { BACKUP_COLUMNS } from '../../tableColumns/systemColumns'
import { downloadTableCsv } from '../../lib/exportCsv'

export function AuditLogPage() {
  const list = useAuditLogController()
  const critical = list.tabCounts.critical || 0

  return (
    <ListScreen
      title="Audit log"
      description="Every privileged action, with who did it, from where, and what changed."
      actions={<ExportMenu onExport={() => downloadTableCsv('audit-log.csv', columns.AUDIT_COLUMNS, list.items)} />}
      banner={
        <InlineAlert tone="info" title={`${critical} critical entries in this period`}>
          The log is append-only. Nobody, including a Super Admin, can edit or delete an entry —
          which is what makes it evidence rather than a convenience.
        </InlineAlert>
      }
      controller={list}
      columns={columns.AUDIT_COLUMNS}
      filters={columns.AUDIT_FILTERS}
      tabs={columns.AUDIT_TABS}
      searchPlaceholder="Actor, action, entity or IP…"
      itemLabel="entries"
      emptyIcon="audit"
      emptyTitle="No entries in this view"
    />
  )
}

export function SupportTicketsPage() {
  const navigate = useNavigate()
  const list = useSupportTicketController()
  const unassigned = list.tabCounts.unassigned || 0

  return (
    <ListScreen
      title="Support tickets"
      description="Queries from buyers and sellers, who owns each one, and how long it has waited."
      actions={<ExportMenu onExport={() => downloadTableCsv('support-tickets.csv', columns.TICKET_COLUMNS, list.items)} />}
      banner={
        unassigned > 0 && (
          <InlineAlert tone="warning" title={`${unassigned} tickets have no owner`}>
            An unassigned ticket ages without anyone accountable for it. Assign or close it.
          </InlineAlert>
        )
      }
      controller={list}
      columns={columns.TICKET_COLUMNS}
      filters={columns.TICKET_FILTERS}
      tabs={columns.TICKET_TABS}
      searchPlaceholder="Ticket, subject, person or category…"
      onRowClick={(row) => navigate(adminPath.supportTicketDetail(row.id))}
      itemLabel="tickets"
      emptyIcon="support"
      emptyTitle="No tickets in this view"
    />
  )
}


export function BackupsPage() {
  const { data, isLoading, error, refetch } = useBackupsController()
  const runBackup = useRunBackupController()

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

  const failed = data.runs.filter((run) => run.status === 'failed').length

  return (
    <PageBody>
      <PageHeader
        title="Backups"
        description="Daily snapshots, cloud replication, and when the restore path was last actually tested."
        actions={
          <Button
            variant="secondary"
            size="control"
            icon="refresh"
            onClick={() => runBackup.run()}
            disabled={runBackup.isSubmitting}
          >
            {runBackup.isSubmitting ? 'Running…' : 'Run now'}
          </Button>
        }
      />

      <InlineAlert
        tone={data.schedule.lastRestoreTestAt ? 'info' : 'danger'}
        title={
          data.schedule.lastRestoreTestAt
            ? `Restore last tested ${data.schedule.lastRestoreTestAt}`
            : 'The restore path has never been tested'
        }
      >
        A backup nobody has restored from is a guess, not a guarantee. Test quarterly at minimum.
        {failed > 0 && ` ${failed} of the last five runs failed.`}
      </InlineAlert>

      <SectionCard title="Schedule">
        <div className="px-4 py-2">
          <KeyValueList
            columns={2}
            items={[
              { label: 'Daily backup', value: data.schedule.daily ? `Yes, at ${data.schedule.dailyAt}` : 'Off' },
              { label: 'Cloud replication', value: data.schedule.cloudReplication ? 'Enabled' : 'Off' },
              { label: 'Retention', value: `${data.schedule.retentionDays} days` },
              { label: 'Last restore test', value: data.schedule.lastRestoreTestAt || 'Never' },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard title="Recent runs">
        <Table
          className="rounded-none border-0 border-t"
          columns={BACKUP_COLUMNS}
          data={data.runs}
          getRowKey={(row) => row.id}
          density="compact"
        />
      </SectionCard>
    </PageBody>
  )
}
