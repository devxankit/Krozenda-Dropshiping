import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Icon, Select } from '../../../../components/ui'
import { ADMIN_ROUTES, adminPath } from '../../../../config/routes'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton, PermissionGate } from '../../components/feedback'
import { SectionCard, formatMoney } from '../../components/display'
import { AccountingEmpty, RangePicker } from '../../components/accounting/AccountingShell'
import { downloadCsv, rupees } from '../../lib/exportCsv'
import { ADMIN_PERMISSIONS } from '../../constants'
import {
  useAccountingReportController,
  useCommissionOptionsController,
  useReportCatalogueController,
} from '../../controllers/useAccountingController'

// /admin/accounting/reports — five reports, one runner.
//
// Each report returns { columns, rows, totals } from the backend, so this
// screen renders any of them without knowing what a "commission report" is.
// That is also why the totals can be trusted: they are summed on the same
// ledger the rows came from, not re-added here.

export function AccountingReportsPage() {
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
        title="Accounting reports"
        description="Every report reads the same ledger the dashboard does, so the totals agree by construction."
      />

      <SectionCard title="Available reports">
        <ul className="divide-y divide-border-subtle">
          {data.items.map((report) => (
            <li key={report.key}>
              <Link
                to={adminPath.accountingReport(report.key)}
                className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-muted"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-muted text-ink-subtle">
                  <Icon name="reports" className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-slate-900">{report.name}</span>
                  <span className="block truncate text-2xs text-ink-subtle">{report.description}</span>
                </span>
                <span className="hidden shrink-0 gap-1 sm:flex">
                  {report.formats.map((format) => (
                    <span
                      key={format}
                      className="rounded bg-surface-sunken px-1.5 py-0.5 text-2xs uppercase text-ink-faint"
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
    </PageBody>
  )
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

// One formatter per declared column format, so the runner never has to guess
// from a column's name whether it holds money.
const FORMATTERS = {
  money: (value) => formatMoney(Number(value) || 0),
  count: (value) => Number(value || 0).toLocaleString('en-IN'),
  percent: (value) => `${value}%`,
  date: (value) =>
    value
      ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—',
  datetime: (value) => (value ? new Date(value).toLocaleString('en-IN') : '—'),
  status: (value) => value,
  text: (value) => (value === null || value === undefined || value === '' ? '—' : value),
}

const isNumeric = (format) => format === 'money' || format === 'count' || format === 'percent'

export function AccountingReportRunnerPage() {
  const { reportKey } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, error, refetch, range, filters, setFilters } =
    useAccountingReportController(reportKey)
  const options = useCommissionOptionsController()

  if (isLoading) {
    return (
      <PageBody>
        <PageSkeleton rows={4} />
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

  function exportCsv() {
    downloadCsv(`${data.key}-report.csv`, [
      {
        title: `${data.name}${data.range ? ` — ${data.range.label}` : ' — all time'}`,
        columns: data.columns.map((column) => ({
          header: column.header,
          value: (row) =>
            column.format === 'money'
              ? rupees(Number(row[column.key]) || 0)
              : row[column.key] === null || row[column.key] === undefined
                ? ''
                : row[column.key],
        })),
        rows: data.rows,
      },
    ])
  }

  const totalEntries = Object.entries(data.totals)

  return (
    <PageBody>
      <PageHeader
        title={data.name}
        description={data.description}
        actions={
          <>
            <Button
              variant="secondary"
              size="control"
              icon="arrowLeft"
              onClick={() => navigate(ADMIN_ROUTES.ACCOUNTING_REPORTS)}
            >
              All reports
            </Button>
            <PermissionGate permission={ADMIN_PERMISSIONS.ACCOUNTING_REPORT_EXPORT}>
              <Button
                variant="secondary"
                size="control"
                icon="download"
                disabled={data.rows.length === 0}
                onClick={exportCsv}
              >
                Export CSV
              </Button>
            </PermissionGate>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <RangePicker {...range} />
        <Select
          id="report-seller"
          size="control"
          value={filters.sellerId || ''}
          onChange={(event) => setFilters({ ...filters, sellerId: event.target.value || undefined })}
          placeholder="All sellers"
          options={options.data?.sellers || []}
          containerClassName="w-56"
        />
      </div>

      {data.rows.length === 0 ? (
        <AccountingEmpty
          title="No rows for this report"
          hint="Nothing matched this period and filter. The report shows only what is actually on the ledger."
          icon="reports"
        />
      ) : (
        <SectionCard
          title={`${data.rows.length} row${data.rows.length === 1 ? '' : 's'}`}
          description={`Generated ${new Date(data.generatedAt).toLocaleString('en-IN')}${data.range ? ` · ${data.range.label}` : ' · all time'}`}
        >
          <div className="admin-scroll overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-surface-muted text-2xs uppercase tracking-wider text-ink-muted">
                  {data.columns.map((column) => (
                    <th
                      key={column.key}
                      className={`whitespace-nowrap px-4 py-2 font-semibold ${
                        isNumeric(column.format) ? 'text-right' : 'text-left'
                      }`}
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {data.rows.map((row, index) => (
                  <tr key={index} className="transition-colors hover:bg-surface-muted/60">
                    {data.columns.map((column) => (
                      <td
                        key={column.key}
                        className={`whitespace-nowrap px-4 py-2.5 ${
                          isNumeric(column.format)
                            ? 'tabular text-right font-medium text-slate-900'
                            : 'text-ink-muted'
                        }`}
                      >
                        {(FORMATTERS[column.format] || FORMATTERS.text)(row[column.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {totalEntries.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border-strong bg-surface-muted/70">
                    {data.columns.map((column, index) => {
                      const total = data.totals[column.key]
                      return (
                        <td
                          key={column.key}
                          className={`whitespace-nowrap px-4 py-2.5 font-bold text-slate-900 ${
                            isNumeric(column.format) ? 'tabular text-right' : 'text-left'
                          }`}
                        >
                          {index === 0 && total === undefined
                            ? 'Total'
                            : total === undefined
                              ? ''
                              : (FORMATTERS[column.format] || FORMATTERS.text)(total)}
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </SectionCard>
      )}
    </PageBody>
  )
}
