import { Badge, Button, Icon, Select, Table } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { IMPORT_ERROR_COLUMNS, IMPORT_FIELD_OPTIONS } from '../../tableColumns/catalogColumns'
import { useImportRunController } from '../../controllers/useCatalogController'

export function ImportPage() {
  const { data, isLoading, error, refetch } = useImportRunController()

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
        title="Bulk import"
        description="Upload a CSV or Excel file, map its columns, then review the rows that failed validation."
        actions={
          <>
            <Button variant="secondary" size="control" icon="download">
              Download template
            </Button>
            <Button size="control" icon="upload">
              Upload a file
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">Rows read</p>
          <p className="tabular mt-2 text-xl font-bold text-slate-900">{data.totalRows}</p>
        </div>
        <div className="rounded-lg border border-success-200 bg-success-50 p-4">
          <p className="text-2xs font-semibold uppercase tracking-wider text-success-700">
            Ready to import
          </p>
          <p className="tabular mt-2 text-xl font-bold text-success-700">{data.validRows}</p>
        </div>
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-4">
          <p className="text-2xs font-semibold uppercase tracking-wider text-danger-700">
            Rejected
          </p>
          <p className="tabular mt-2 text-xl font-bold text-danger-700">{data.errorRows}</p>
        </div>
      </div>

      <InlineAlert tone="info" title={`${data.fileName} · uploaded ${data.uploadedAt}`}>
        Nothing is written to the catalog until you import. Rejected rows are never partially
        applied — fix them in the file and upload again, or import the valid rows and re-upload the
        rest.
      </InlineAlert>

      <SectionCard
        title="Column mapping"
        description="Unmapped columns are ignored. The sample is taken from the first data row."
      >
        <div className="divide-y divide-border-subtle">
          {data.mapping.map((row) => (
            <div key={row.column} className="grid items-center gap-3 px-4 py-2.5 sm:grid-cols-[1fr_auto_1fr_1fr]">
              <span className="text-xs font-medium text-slate-900">{row.column}</span>
              <Icon name="arrowRight" className="hidden h-3.5 w-3.5 text-border-strong sm:block" />
              <Select
                id={`map-${row.column}`}
                size="sm"
                options={IMPORT_FIELD_OPTIONS}
                placeholder="Ignore this column"
                defaultValue={row.field || ''}
              />
              <span className="truncate text-2xs text-ink-faint">e.g. {row.sample}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Rows that failed validation"
        description="Every failure names the row, the column and what to change"
        actions={<Badge tone="danger">{data.errors.length} shown</Badge>}
      >
        <Table
          className="rounded-none border-0 border-t"
          columns={IMPORT_ERROR_COLUMNS}
          data={data.errors}
          getRowKey={(issue) => `${issue.row}-${issue.column}`}
          density="compact"
        />
      </SectionCard>
    </PageBody>
  )
}
