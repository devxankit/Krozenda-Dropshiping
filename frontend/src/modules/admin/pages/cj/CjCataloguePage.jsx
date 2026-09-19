import { useState } from 'react'
import { Badge, Button, Checkbox, Input, Modal, Pagination, Select, Skeleton } from '../../../../components/ui'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, InlineAlert, NoData, PageSkeleton } from '../../components/feedback'
import { SectionCard } from '../../components/display'
import { FormSection } from '../../components/forms'
import {
  useCjCatalogueSearchController,
  useCjCategoriesController,
  useCjProductDetailController,
  useCjOnboardingController,
  useKrozendaCategoriesController,
} from '../../controllers/useCjController'
import { flattenCjCategories, catalogPriceInr } from '../../tableColumns/cjColumns'

// THE RULE THIS SCREEN EXISTS TO ENFORCE (master plan §2): this is a LIVE
// search against CJ every time — never a cached/imported catalogue. Nothing
// here is written to Krozenda's DB until the admin explicitly onboards one
// product from the detail modal.
//
// Every field this screen reads comes from the backend's normalized DTO
// (services/cj/cjProductAdapter.js) — never CJ's raw response shape. Search
// only fires on Enter/Search-click/category-change (never per keystroke),
// which is what actually avoids request-per-character here — a debounce
// timer would be solving a problem this screen doesn't have.

const PAGE_SIZE = 24

function OnboardModal({ product, variants, onClose }) {
  const { onboard, isOnboarding, error } = useCjOnboardingController()
  const categoriesQuery = useKrozendaCategoriesController()

  const [krozendaCategoryId, setKrozendaCategoryId] = useState('')
  const [pricingMode, setPricingMode] = useState('AUTOMATIC')
  const [marginType, setMarginType] = useState('PERCENT')
  const [marginValue, setMarginValue] = useState('20')
  const [sellingPrice, setSellingPrice] = useState('')
  const [selectedVariantIds, setSelectedVariantIds] = useState(
    () => new Set((variants || []).map((v) => v.externalVariantId))
  )

  const categoryOptions = (categoriesQuery.data || []).map((c) => ({ value: c._id, label: c.name }))
  const hasVariants = (variants || []).length > 0

  function toggleVariant(id) {
    setSelectedVariantIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    await onboard({
      cjProductId: product.externalProductId,
      krozendaCategoryId,
      pricingMode,
      marginRule: pricingMode === 'AUTOMATIC' ? { type: marginType, value: Number(marginValue) || 0 } : null,
      sellingPrice: pricingMode === 'MANUAL' && !hasVariants ? Number(sellingPrice) || undefined : undefined,
      variantSelections: hasVariants
        ? (variants || [])
            .filter((v) => selectedVariantIds.has(v.externalVariantId))
            .map((v) => ({ cjVariantId: v.externalVariantId }))
        : null,
    })
    onClose(true)
  }

  return (
    <Modal
      isOpen
      onClose={() => onClose(false)}
      title="Onboard CJ product"
      description={product.title}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="control" onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button
            size="control"
            isLoading={isOnboarding}
            disabled={!krozendaCategoryId || (hasVariants && selectedVariantIds.size === 0)}
            onClick={handleSubmit}
          >
            Onboard product
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <InlineAlert tone="danger" title="Could not onboard this product">
            {error?.response?.data?.message || error.message}
          </InlineAlert>
        )}

        <FormSection title="Category mapping" columns={1}>
          <Select
            id="onboardCategory"
            label="Krozenda category"
            size="control"
            value={krozendaCategoryId}
            onChange={(e) => setKrozendaCategoryId(e.target.value)}
            options={[{ value: '', label: 'Select a category' }, ...categoryOptions]}
          />
        </FormSection>

        <FormSection title="Pricing" columns={2}>
          <Select
            id="onboardPricingMode"
            label="Pricing mode"
            size="control"
            value={pricingMode}
            onChange={(e) => setPricingMode(e.target.value)}
            options={[
              { value: 'AUTOMATIC', label: 'Automatic (cost + shipping + margin)' },
              { value: 'MANUAL', label: 'Manual' },
            ]}
          />
          {pricingMode === 'AUTOMATIC' ? (
            <div className="flex gap-2">
              <Select
                id="onboardMarginType"
                label="Margin type"
                size="control"
                value={marginType}
                onChange={(e) => setMarginType(e.target.value)}
                options={[
                  { value: 'PERCENT', label: 'Percent' },
                  { value: 'FLAT', label: 'Flat' },
                ]}
              />
              <Input
                id="onboardMarginValue"
                label={marginType === 'PERCENT' ? 'Margin %' : 'Margin ₹'}
                type="number"
                size="control"
                value={marginValue}
                onChange={(e) => setMarginValue(e.target.value)}
              />
            </div>
          ) : (
            !hasVariants && (
              <Input
                id="onboardSellingPrice"
                label="Selling price (₹)"
                type="number"
                size="control"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
              />
            )
          )}
        </FormSection>

        {hasVariants && (
          <FormSection title={`Variants (${selectedVariantIds.size}/${variants.length} selected)`} columns={1}>
            <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
              {variants.map((v) => (
                <Checkbox
                  key={v.externalVariantId}
                  id={`variant-${v.externalVariantId}`}
                  checked={selectedVariantIds.has(v.externalVariantId)}
                  onChange={() => toggleVariant(v.externalVariantId)}
                  label={v.title}
                  description={`Cost ${catalogPriceInr(v.sourcePrice)}`}
                />
              ))}
            </div>
          </FormSection>
        )}
      </div>
    </Modal>
  )
}

function ProductDetailModal({ productId, onClose }) {
  const { data, isLoading, error } = useCjProductDetailController(productId)
  const [onboardOpen, setOnboardOpen] = useState(false)

  return (
    <Modal isOpen onClose={onClose} title="CJ product detail" size="lg">
      {isLoading && <PageSkeleton rows={3} />}
      {error && <ErrorState error={error} />}
      {data && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            {data.images?.[0] && (
              <img src={data.images[0]} alt="" className="h-24 w-24 rounded-md border border-border object-cover" />
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900">{data.title}</p>
              <p className="mt-1 text-xs text-ink-subtle">CJ Product ID: {data.externalProductId}</p>
              <p className="text-xs text-ink-subtle">
                Cost {catalogPriceInr(data.sourcePrice)} · Category {data.sourceCategory?.name || '—'}
              </p>
            </div>
          </div>

          {data.images?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {data.images.slice(0, 6).map((src) => (
                <img key={src} src={src} alt="" className="h-16 w-16 shrink-0 rounded-md border border-border object-cover" />
              ))}
            </div>
          )}

          {data.variants?.length > 0 && (
            <p className="text-xs text-ink-subtle">{data.variants.length} variant(s) available</p>
          )}

          <div className="flex justify-end">
            <Button size="control" onClick={() => setOnboardOpen(true)}>
              Onboard this product
            </Button>
          </div>
        </div>
      )}

      {onboardOpen && (
        <OnboardModal
          product={data}
          variants={data.variants}
          onClose={(onboarded) => {
            setOnboardOpen(false)
            if (onboarded) onClose()
          }}
        />
      )}
    </Modal>
  )
}

function ProductCard({ product, onView }) {
  return (
    <button
      type="button"
      onClick={onView}
      className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface text-left transition-shadow hover:shadow-md"
    >
      <div className="aspect-square w-full bg-surface-muted">
        {product.primaryImage && (
          <img src={product.primaryImage} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <p className="line-clamp-2 text-xs font-medium text-slate-900">{product.title}</p>
        <p className="text-2xs text-ink-subtle">{product.sourceCategory?.name || '—'}</p>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">{catalogPriceInr(product.sourcePrice)}</span>
          {product.isFreeShipping && (
            <Badge tone="success" size="sm">
              Free shipping
            </Badge>
          )}
        </div>
      </div>
    </button>
  )
}

// Mirrors ProductCard's exact layout (image square, title, subtitle, price
// row) so the loading state doesn't jump/reflow once real cards swap in.
function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2.5 w-1/3" />
        <Skeleton className="mt-1 h-4 w-1/2" />
      </div>
    </div>
  )
}

function ProductGridSkeleton({ count = PAGE_SIZE }) {
  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function CjCataloguePage() {
  const [keyword, setKeyword] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [pageNum, setPageNum] = useState(1)
  const [openProductId, setOpenProductId] = useState(null)

  const { data: categoryTree } = useCjCategoriesController()
  const categoryLeaves = flattenCjCategories(categoryTree)

  const { data, isLoading, isFetching, error, refetch } = useCjCatalogueSearchController({
    keyword: keyword || undefined,
    categoryId: categoryId || undefined,
    page: pageNum,
    limit: PAGE_SIZE,
  })

  const items = data?.items || []
  const pagination = data?.pagination || { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 }

  function runSearch() {
    setKeyword(keywordInput)
    setPageNum(1)
  }

  return (
    <PageBody>
      <PageHeader
        title="CJ Catalogue"
        description="Live search against CJ Dropshipping — every card here comes straight from CJ's API, nothing is imported until you onboard it."
      />

      <SectionCard title="Search">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <Input
            id="cjKeyword"
            label="Keyword"
            size="control"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            containerClassName="w-56"
          />
          <Select
            id="cjCategoryFilter"
            label="Category"
            size="control"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              setPageNum(1)
            }}
            options={[{ value: '', label: 'All categories' }, ...categoryLeaves]}
            containerClassName="w-72"
          />
          <Button size="control" isLoading={isFetching} onClick={runSearch}>
            Search
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Products" description={data ? `${pagination.total.toLocaleString('en-IN')} matches on CJ` : undefined}>
        {error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <ProductGridSkeleton />
        ) : items.length === 0 ? (
          <NoData message="No CJ products found" hint="Try a different keyword or category." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {items.map((product) => (
                <ProductCard
                  key={product.externalProductId}
                  product={product}
                  onView={() => setOpenProductId(product.externalProductId)}
                />
              ))}
            </div>
            <div className="border-t border-border-subtle p-3">
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                rowsPerPage={pagination.limit}
                onPageChange={setPageNum}
                itemLabel="products"
              />
            </div>
          </>
        )}
      </SectionCard>

      {openProductId && (
        <ProductDetailModal productId={openProductId} onClose={() => setOpenProductId(null)} />
      )}
    </PageBody>
  )
}
