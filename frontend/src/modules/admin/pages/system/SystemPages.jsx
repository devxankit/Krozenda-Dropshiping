import { useNavigate } from 'react-router-dom'
import { Avatar, Badge, Button, Switch, Table } from '../../../../components/ui'
import { adminPath } from '../../../../config/routes'
import { PageBody, PageHeader } from '../../components/shell'
import { ExportMenu, ListScreen } from '../../components/data'
import { ErrorState, InlineAlert, PageSkeleton } from '../../components/feedback'
import { KeyValueList, SectionCard } from '../../components/display'
import {
  useAdminProfileController,
  useAuditLogController,
  useBackupsController,
  useRunBackupController,
  useSupportTicketController,
} from '../../controllers/useSystemController'
import * as columns from '../../tableColumns/systemColumns'
import { BACKUP_COLUMNS } from '../../tableColumns/systemColumns'

export function AuditLogPage() {
  const list = useAuditLogController()
  const critical = list.tabCounts.critical || 0

  return (
    <ListScreen
      title="Audit log"
      description="Every privileged action, with who did it, from where, and what changed."
      actions={<ExportMenu onExport={() => {}} />}
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
      actions={<ExportMenu onExport={() => {}} />}
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
          <>
            <Button
              variant="secondary"
              size="control"
              icon="refresh"
              onClick={() => runBackup.run()}
              disabled={runBackup.isSubmitting}
            >
              {runBackup.isSubmitting ? 'Running…' : 'Run now'}
            </Button>
            <Button size="control" icon="upload">
              Test a restore
            </Button>
          </>
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

export function AdminProfilePage() {
  const { data, isLoading, error, refetch } = useAdminProfileController()

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

  return (
    <PageBody width="narrow">
      <PageHeader
        title="My profile"
        description="Your account, where you are signed in, and what you want to hear about."
        actions={
          <Button variant="secondary" size="control" icon="lock">
            Change password
          </Button>
        }
      />

      <SectionCard title="Account">
        <div className="flex items-center gap-4 border-b border-border-subtle px-4 py-4">
          <Avatar name={data.name} size="lg" tone="inverted" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{data.name}</p>
            <p className="text-xs text-ink-subtle">{data.email}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge tone="accent" size="sm">
                {data.role}
              </Badge>
              <Badge tone={data.twoFactorEnabled ? 'success' : 'danger'} size="sm" dot>
                {data.twoFactorEnabled ? 'Two-factor on' : 'Two-factor off'}
              </Badge>
              <span className="text-2xs text-ink-faint">Joined {data.joinedAt}</span>
            </div>
          </div>
        </div>
        <div className="px-4 py-2">
          <KeyValueList
            columns={2}
            items={[
              { label: 'Phone', value: <span className="tabular">{data.phone}</span> },
              { label: 'Role', value: data.role },
            ]}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Signed in on"
        description="Ending a session signs that device out immediately"
      >
        <ul className="divide-y divide-border-subtle">
          {data.sessions.map((session) => (
            <li key={session.id} className="flex items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-slate-900">{session.device}</span>
                <span className="block text-2xs text-ink-faint">
                  {session.location} · {session.lastActiveAt}
                </span>
              </span>
              {session.current ? (
                <Badge tone="success" size="sm" dot>
                  This device
                </Badge>
              ) : (
                <Button variant="dangerOutline" size="sm">
                  End session
                </Button>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Notify me when" description="Email and push, per event">
        <ul className="divide-y divide-border-subtle">
          {data.notifications.map((preference) => (
            <li key={preference.key} className="flex items-center gap-6 px-4 py-2.5">
              <span className="min-w-0 flex-1 text-xs text-slate-800">{preference.label}</span>
              <span className="flex items-center gap-2 text-2xs text-ink-faint">
                Email
                <Switch id={`${preference.key}-email`} checked={preference.email} onChange={() => {}} />
              </span>
              <span className="flex items-center gap-2 text-2xs text-ink-faint">
                Push
                <Switch id={`${preference.key}-push`} checked={preference.push} onChange={() => {}} />
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </PageBody>
  )
}
