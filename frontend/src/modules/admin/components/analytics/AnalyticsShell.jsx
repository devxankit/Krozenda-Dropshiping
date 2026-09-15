import { useLocation, useNavigate } from 'react-router-dom'
import { Button, SegmentedControl, Tabs } from '../../../../components/ui'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { PageBody, PageHeader, RefreshControl } from '../shell'
import { ErrorState, InlineAlert, PageSkeleton } from '../feedback'
import { KpiGrid } from '../dashboard'
import { DASHBOARD_RANGES } from '../../controllers/useDashboardController'

const TABS = Object.freeze([
  { id: ADMIN_ROUTES.ANALYTICS_SALES, label: 'Sales' },
  { id: ADMIN_ROUTES.ANALYTICS_VENDORS, label: 'Vendors' },
  { id: ADMIN_ROUTES.ANALYTICS_CATALOG, label: 'Catalog' },
  { id: ADMIN_ROUTES.ANALYTICS_CUSTOMERS, label: 'Customers' },
])

// Kept as a named export because the finance overview renders the same strip
// of headline figures; it is the shared KPI tile in a four-column grid.
export function KpiStrip({ kpis = [] }) {
  return <KpiGrid kpis={kpis} columns={4} />
}

// The four analytics screens share a header, a tab strip, a range picker, an
// export and all four states — so each page is only its own charts.
export function AnalyticsShell({ title, description, controller, onExport, children }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { range, setRange, data, isLoading, isFetching, error, refetch, updatedAt, isLive } =
    controller

  return (
    <PageBody>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <SegmentedControl items={DASHBOARD_RANGES} activeId={range} onChange={setRange} />
            <RefreshControl
              updatedAt={updatedAt}
              isFetching={isFetching}
              onRefresh={refetch}
              live={isLive}
            />
            {/* Only the screens that can export one show the control. */}
            {onExport && (
              <Button
                variant="secondary"
                size="control"
                icon="download"
                disabled={!data}
                onClick={() => onExport(data, range)}
              >
                Export CSV
              </Button>
            )}
          </>
        }
      />

      <Tabs items={TABS} activeId={pathname} onChange={(id) => navigate(id)} />

      {/* A screen still reading fixtures says so, so nobody mistakes a
          placeholder for a measurement. */}
      {isLive === false && (
        <InlineAlert tone="info" title="Sample data">
          This view is not wired to the reporting API yet — the figures below are illustrative.
        </InlineAlert>
      )}

      {isLoading && <PageSkeleton rows={2} />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {data && (
        <>
          <KpiGrid kpis={data.kpis} columns={4} />
          {children(data)}
        </>
      )}
    </PageBody>
  )
}
