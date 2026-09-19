import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Pagination, Table } from '../../../../components/ui'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, NoData } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { CJ_PRODUCT_COLUMNS } from '../../tableColumns/cjColumns'
import { useCjOnboardedProductsController } from '../../controllers/useCjController'

const PAGE_SIZE = 20

export function CjProductsPage() {
  const [pageNum, setPageNum] = useState(1)
  const { data, isLoading, error, refetch } = useCjOnboardedProductsController({ pageNum, pageSize: PAGE_SIZE })

  const list = data?.list || []
  const total = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <PageBody>
      <PageHeader
        title="CJ Products"
        description="Products onboarded from CJ's live catalogue into Krozenda's own catalog. Customers only ever see this data, never CJ directly."
        actions={
          <Link to={ADMIN_ROUTES.CJ_CATALOGUE}>
            <Button size="control" icon="add">
              Onboard from catalogue
            </Button>
          </Link>
        }
      />

      <SectionCard title="Onboarded products" description={`${total} total`}>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : (
          <>
            <Table
              columns={CJ_PRODUCT_COLUMNS}
              data={list}
              getRowKey={(row) => row._id}
              isLoading={isLoading}
              density="compact"
              emptyState={
                <NoData
                  message="No CJ products onboarded yet"
                  hint="Browse the live CJ catalogue and onboard a product to see it here."
                />
              }
            />
            {total > 0 && (
              <div className="border-t border-border-subtle p-3">
                <Pagination
                  page={pageNum}
                  totalPages={totalPages}
                  totalItems={total}
                  rowsPerPage={PAGE_SIZE}
                  onPageChange={setPageNum}
                  itemLabel="products"
                />
              </div>
            )}
          </>
        )}
      </SectionCard>
    </PageBody>
  )
}
