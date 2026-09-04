import { Link, useParams } from 'react-router-dom'
import { Button, Icon, Select } from '../../../../components/ui'
import { adminPath } from '../../../../config/routes'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton } from '../../components/feedback'
import { SectionCard, formatMoney } from '../../components/display'
import {
  useReportCatalogueController,
  useReportRunController,
} from '../../controllers/useMarketingController'

export function ReportsPage() {
  const { data, isLoading, error, refetch } = useReportCatalogueController()

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
    <PageBody>
      <PageHeader
        title="Reports"
        description="Every report runs through one runner: set the parameters, preview the result, export it."
      />

      {data.groups.map((group) => (
        <SectionCard key={group.label} title={group.label}>
          <ul className="divide-y divide-border-subtle">
            {group.reports.map((report) => (
              <li key={report.key}>
                <Link
                  to={adminPath.reportRunner(report.key)}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-muted"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-muted text-ink-subtle">
                    <Icon name="reports" className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-slate-900">{report.name}</span>
                    <span className="block truncate text-2xs text-ink-subtle">
                      {report.description}
                    </span>
                  </span>
                  <span className="shrink-0 text-2xs text-ink-faint">
                    {report.lastRunAt ? `Last run ${report.lastRunAt}` : 'Never run'}
                  </span>
                  <span className="hidden shrink-0 gap-1 sm:flex">
                    {report.formats.map((format) => (
                      <span
                        key={format}
                        className="rounded bg-surface-sunken px-1.5 py-0.5 text-2xs text-ink-faint"
                      >
                        {format}
                      </span>
                    ))}
                  </span>
                  <Icon name="chevronRight" className="h-3.5 w-3.5 shrink-0 text-border-strong" />
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      ))}
    </PageBody>
  )
}

// Money columns arrive in paise; a report column named `revenue` or `aov` is
// formatted as currency, everything else as a plain figure.
const MONEY_KEYS = new Set(['revenue', 'aov', 'amount', 'net', 'gross'])

export function ReportRunnerPage() {
  const { reportKey } = useParams()
  const { data, isLoading, error, refetch } = useReportRunController(reportKey)

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
    <PageBody>
      <PageHeader
        title={data.name}
        trail={[{ label: data.name }]}
        description={data.description}
        actions={
          <>
            <Button variant="secondary" size="control" icon="refresh">
              Run again
            </Button>
            {data.formats.map((format) => (
              <Button key={format} variant="secondary" size="control" icon="download">
                {format}
              </Button>
            ))}
          </>
        }
      />

      <SectionCard title="Parameters" description="Changing a parameter re-runs the report">
        <div className="grid gap-4 p-4 sm:grid-cols-3">
          {data.parameters.map((parameter) => (
            <div key={parameter.key} className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-900">{parameter.label}</label>
              {parameter.options ? (
                <Select
                  id={parameter.key}
                  size="control"
                  options={parameter.options}
                  defaultValue={parameter.options[0]?.value}
                />
              ) : (
                <div className="flex h-control items-center gap-2 rounded-md border border-border bg-surface px-3 text-xs text-slate-900">
                  <Icon name="calendar" className="h-3.5 w-3.5 text-ink-faint" />
                  {parameter.value}
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      <InlineAlert tone="info" title={`Showing 6 of ${data.rowCount} rows`}>
        The preview is capped so the screen stays fast. An export contains every row for the
        chosen period.
      </InlineAlert>

      <SectionCard title="Preview">
        <div className="admin-scroll overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-xs">
            <thead>
              <tr className="border-y border-border bg-surface-muted">
                {data.columns.map((column) => (
                  <th
                    key={column.key}
                    className={`px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-ink-faint ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, index) => (
                <tr key={index} className="border-b border-border-subtle last:border-b-0">
                  {data.columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-2 ${column.align === 'right' ? 'tabular text-right text-slate-900' : 'text-ink-muted'}`}
                    >
                      {MONEY_KEYS.has(column.key)
                        ? formatMoney(row[column.key])
                        : typeof row[column.key] === 'number'
                          ? row[column.key].toLocaleString('en-IN')
                          : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </PageBody>
  )
}
