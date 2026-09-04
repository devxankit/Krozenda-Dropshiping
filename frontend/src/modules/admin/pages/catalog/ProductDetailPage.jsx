import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge, Button, Tabs } from '../../../../components/ui'
import { BUSINESS_MODEL_LABELS } from '../../../../config/constants'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, PageSkeleton, PermissionGate } from '../../components/feedback'
import {
  PRODUCT_DETAIL_TABS,
  ProductMetaRail,
  ProductTabPanel,
} from '../../components/catalog/ProductPanels'
import { ADMIN_PERMISSIONS, PRODUCT_TYPE_LABELS, REVIEW_STATUS_LABELS, REVIEW_STATUS_TONE } from '../../constants'
import { useProductDetailController } from '../../controllers/useCatalogController'

export function ProductDetailPage() {
  const { productId } = useParams()
  const { product, isLoading, error, refetch } = useProductDetailController(productId)
  const [tab, setTab] = useState('general')

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
        title={product.name}
        trail={[{ label: product.name }]}
        actions={
          <>
            <Button variant="secondary" size="control" icon="externalLink">
              View on storefront
            </Button>
            <PermissionGate permission={ADMIN_PERMISSIONS.CATALOG_MANAGE}>
              <Button variant="secondary" size="control" icon="edit">
                Edit
              </Button>
            </PermissionGate>
            <PermissionGate permission={ADMIN_PERMISSIONS.CATALOG_APPROVE}>
              <Button size="control" icon="check">
                Approve
              </Button>
            </PermissionGate>
          </>
        }
      >
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-ink-subtle">
          <Badge tone={REVIEW_STATUS_TONE[product.status]} dot>
            {REVIEW_STATUS_LABELS[product.status]}
          </Badge>
          <span className="tabular">{product.sku}</span>
          <span className="text-border-strong">·</span>
          <span>{PRODUCT_TYPE_LABELS[product.type]}</span>
          <span className="text-border-strong">·</span>
          <span>{BUSINESS_MODEL_LABELS[product.model]}</span>
          <span className="text-border-strong">·</span>
          <span>{product.seller.name}</span>
        </div>
      </PageHeader>

      {product.issues.length > 0 && (
        <InlineAlert
          tone="warning"
          title={`${product.issues.length} issue to resolve before this goes live`}
        >
          {product.issues.map((issue) => (
            <p key={issue.field}>
              <strong className="font-semibold">{issue.field}</strong> — {issue.message}
            </p>
          ))}
        </InlineAlert>
      )}

      <Tabs items={PRODUCT_DETAIL_TABS} activeId={tab} onChange={setTab} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <ProductTabPanel tab={tab} product={product} />
        </div>
        <ProductMetaRail product={product} />
      </div>
    </PageBody>
  )
}
