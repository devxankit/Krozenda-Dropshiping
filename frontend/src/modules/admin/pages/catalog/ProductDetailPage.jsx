import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Switch, Table } from '../../../../components/ui'
import { ProductBarcode } from '../../../../components/common/ProductBarcode'
import { ADMIN_ROUTES, userPath } from '../../../../config/routes'
import { PageBody, PageHeader } from '../../components/shell'
import { ErrorState, PageSkeleton, PermissionGate } from '../../components/feedback'
import { DateCell, SectionCard } from '../../components/display'
import { ProductFormDrawer } from '../../components/catalog/CatalogForms'
import { ConfirmDialog } from '../../components/overlay/ConfirmDialog'
import { ADMIN_PERMISSIONS } from '../../constants'
import {
  useBrandsController,
  useCategoryTreeController,
  useProductDetailController,
  useProductWriteController,
} from '../../controllers/useCatalogController'

const MANAGE = ADMIN_PERMISSIONS.CATALOG_MANAGE

const APPROVAL_TONE = { APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger' }
const APPROVAL_LABEL = { APPROVED: 'Approved', PENDING: 'Pending approval', REJECTED: 'Rejected' }

const STATUS_TONE = { Active: 'success', Draft: 'warning', Inactive: 'neutral' }
const STATUS_OPTIONS = [
  { id: 'Active', label: 'Active (Live)' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Inactive', label: 'Inactive' },
]
// Same wording as the form.
const STATUS_HELP = {
  Active: 'Active: Visible and purchasable across the storefront.',
  Draft: 'Draft: Stored as unpublished draft. Invisible to customers.',
  Inactive: 'Inactive: Disabled from catalog browsing and customer checkout.',
}

function formatRupees(amount) {
  if (amount === null || amount === undefined) return '—'
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function orDash(value, suffix = '') {
  return value === null || value === undefined || value === '' ? '—' : `${value}${suffix}`
}

// The detail page mirrors the Add / Edit product form (ProductFormDrawer in
// CatalogForms.jsx): same numbered sections, same labels, same order — so what
// an admin typed in is exactly what they read back here.
function FormSection({ step, title, required = false, aside, children }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600 ring-1 ring-brand-200">
            {step}
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            {title} {required && <span className="text-rose-500">*</span>}
          </h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children, className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="text-2xs font-semibold text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-900">{children}</dd>
    </div>
  )
}

function ProductGallery({ images, name }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const active = images[Math.min(activeIndex, images.length - 1)]

  return (
    <FormSection
      step={2}
      title="Images & Gallery"
      required
      aside={<span className="text-2xs font-semibold text-slate-400">{images.length}/5</span>}
    >
      {/* Capped at a normal preview size: full width of the page made a single
          product photo ~900px tall. */}
      <div className="flex aspect-square w-full max-w-[320px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {active ? (
          <img src={active} alt={name} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xl font-bold text-brand-600">{name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((src, index) => (
            <button
              key={`${src}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 transition-colors ${
                index === activeIndex ? 'border-brand-600' : 'border-slate-200 hover:border-slate-300'
              }`}
              aria-label={`Show image ${index + 1}`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
              {/* The form's "Main Cover" is always the first image. */}
              {index === 0 && (
                <span className="absolute bottom-0.5 left-0.5 rounded bg-brand-600 px-1 py-0.5 text-[8px] font-bold uppercase text-white">
                  ★ Cover
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </FormSection>
  )
}

const VARIANT_COLUMNS = [
  {
    key: 'name',
    header: 'Variant',
    render: (v) => (
      <div className="flex items-center gap-2.5">
        {v.image && <img src={v.image} alt="" className="h-8 w-8 rounded object-cover" />}
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{v.name}</p>
          <p className="truncate text-2xs text-ink-subtle">
            {Object.entries(v.attributes || {})
              .map(([key, value]) => `${key}: ${value}`)
              .join(' · ')}
          </p>
        </div>
      </div>
    ),
  },
  { key: 'sku', header: 'SKU', render: (v) => <span className="tabular">{v.sku || '—'}</span> },
  {
    key: 'price',
    header: 'Price',
    align: 'right',
    render: (v) => (
      <span className="tabular">
        {v.salePrice != null ? (
          <>
            {formatRupees(v.salePrice)}{' '}
            <span className="text-2xs text-ink-faint line-through">{formatRupees(v.price)}</span>
          </>
        ) : (
          formatRupees(v.price)
        )}
      </span>
    ),
  },
  {
    key: 'stock',
    header: 'Stock',
    align: 'right',
    render: (v) => <span className={`tabular ${v.stock <= 0 ? 'text-danger-700' : ''}`}>{v.stock}</span>,
  },
  {
    key: 'isActive',
    header: 'Status',
    render: (v) => (
      <Badge tone={v.isActive ? 'success' : 'neutral'} size="sm" dot>
        {v.isActive ? 'Active' : 'Hidden'}
      </Badge>
    ),
  },
]

const TIER_COLUMNS = [
  { key: 'minQty', header: 'Min. quantity', render: (t) => <span className="tabular">{t.minQty}+</span> },
  { key: 'price', header: 'Unit price', align: 'right', render: (t) => <span className="tabular">{formatRupees(t.price)}</span> },
]

export function ProductDetailPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const { product, isLoading, error, refetch } = useProductDetailController(productId)
  const categories = useCategoryTreeController()
  const brands = useBrandsController()

  const [isEditing, setIsEditing] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  const writer = useProductWriteController({ onSaved: () => setIsEditing(false) })

  const categoryItems = useMemo(
    () => (categories.data?.items || []).filter((c) => c.isActive),
    [categories.data],
  )
  const brandItems = useMemo(() => (brands.data?.items || []).filter((b) => b.isActive), [brands.data])

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

  const status = product.status || (product.isActive ? 'Active' : 'Inactive')
  const isLowStock =
    product.lowStockThreshold != null && product.stock > 0 && product.stock <= product.lowStockThreshold
  const discount =
    product.mrp != null && product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0

  return (
    <>
      <PageBody>
        <PageHeader
          title={product.name}
          trail={[{ label: product.sku || product.name }]}
          actions={
            <>
              <Button variant="secondary" size="sm" icon="arrowLeft" onClick={() => navigate(ADMIN_ROUTES.PRODUCTS)}>
                Back
              </Button>
              {product.isActive && product.approvalStatus === 'APPROVED' && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon="externalLink"
                  onClick={() => window.open(userPath.product(product.id), '_blank', 'noopener')}
                >
                  View on store
                </Button>
              )}
              <PermissionGate permission={MANAGE}>
                <Button variant="dangerOutline" size="sm" icon="delete" onClick={() => setIsRemoving(true)}>
                  Delete
                </Button>
                <Button size="sm" icon="edit" onClick={() => setIsEditing(true)}>
                  Edit product
                </Button>
              </PermissionGate>
            </>
          }
        >
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
            <Badge tone={STATUS_TONE[status] || 'neutral'} dot>
              {status}
            </Badge>
            <Badge tone={APPROVAL_TONE[product.approvalStatus] || 'neutral'}>
              {APPROVAL_LABEL[product.approvalStatus] || product.approvalStatus}
            </Badge>
            {product.fulfillmentProvider === 'CJ' && <Badge tone="accent">CJ Dropshipping</Badge>}
            <span className="text-border-strong">·</span>
            <span>
              Added <DateCell value={product.createdAt} withTime={false} />
            </span>
          </div>
        </PageHeader>

        {product.approvalStatus === 'REJECTED' && product.rejectionReason && (
          <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-xs text-danger-700">
            <span className="font-semibold">Rejection reason:</span> {product.rejectionReason}
          </div>
        )}

        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          {/* 1. BASIC DETAILS */}
          <FormSection step={1} title="Basic Details">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Product Name" className="sm:col-span-2">
                {product.name}
              </Field>
              <Field label="SKU Identifier">
                <span className="tabular">{orDash(product.sku)}</span>
              </Field>
              <Field label="Category">{product.category?.name || '—'}</Field>
              <Field label="Brand (Optional)" className="sm:col-span-2">
                {product.brand?.name || 'No brand'}
              </Field>
              <Field label="Short Description (Optional)" className="sm:col-span-2">
                {product.shortDescription || '—'}
              </Field>
              <Field label="Description (Optional)" className="sm:col-span-2">
                <span className="whitespace-pre-line font-normal text-slate-700">{product.description || '—'}</span>
              </Field>
            </dl>
          </FormSection>

          {/* 2. IMAGES & GALLERY */}
          <ProductGallery images={product.images} name={product.name} />

          {/* 3. PRICING & TAX */}
          <FormSection step={3} title="Pricing & Tax">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Selling Price (₹)">
                <span className="tabular">{formatRupees(product.price)}</span>
              </Field>
              <Field label="MRP (₹, Optional)">
                <span className="tabular">{formatRupees(product.mrp)}</span>
                {discount > 0 && (
                  <Badge tone="success" size="sm" className="ml-1.5">
                    {discount}% off
                  </Badge>
                )}
              </Field>
              <Field label="Cost Price (₹, Optional)">
                <span className="tabular">{formatRupees(product.costPrice)}</span>
              </Field>
              <Field label="Tax / GST (Optional)">{product.gstRate != null ? `${product.gstRate}%` : '—'}</Field>
            </dl>
          </FormSection>

          {/* 4. INVENTORY */}
          <FormSection step={4} title="Inventory">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Stock Quantity">
                <span className={`tabular ${product.stock <= 0 ? 'text-danger-700' : ''}`}>{product.stock}</span>
                {product.stock <= 0 && (
                  <Badge tone="danger" size="sm" className="ml-1.5">
                    Out of stock
                  </Badge>
                )}
                {isLowStock && (
                  <Badge tone="warning" size="sm" className="ml-1.5">
                    Low stock
                  </Badge>
                )}
              </Field>
              <Field label="Low Stock Threshold (Optional)">{orDash(product.lowStockThreshold)}</Field>
            </dl>
          </FormSection>

          {/* 5. SHIPPING */}
          <FormSection step={5} title="Shipping">
            <dl>
              <Field label="Weight (kg)">{orDash(product.weight, ' kg')}</Field>
            </dl>
          </FormSection>

          {/* 6. PRODUCT STATUS, with the form's two spotlight toggles */}
          <FormSection
            step={6}
            title="Product Status"
            required
            aside={
              <Badge tone={STATUS_TONE[status] || 'neutral'} dot size="sm">
                {status}
              </Badge>
            }
          >
            <ul className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" aria-label="Product status">
              {STATUS_OPTIONS.map((option) => (
                <li
                  key={option.id}
                  aria-current={status === option.id ? 'true' : undefined}
                  className={`rounded-lg px-2 py-1.5 text-center text-xs font-semibold ${
                    status === option.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-400'
                  }`}
                >
                  {option.label}
                </li>
              ))}
            </ul>
            <p className="text-2xs text-slate-500">{STATUS_HELP[status]}</p>

            <PermissionGate permission={MANAGE}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-amber-200/90 bg-gradient-to-r from-amber-50/80 to-orange-50/30 p-3.5">
                  <Switch
                    id="product-flash-sale"
                    checked={product.isFlashsale}
                    disabled={writer.setFlashSaleStatus.isSubmitting}
                    onChange={() =>
                      writer.setFlashSaleStatus.run({ id: product.id, isFlashsale: !product.isFlashsale })
                    }
                    label="🔥 Flash Sale Deal"
                    description="Highlight in countdown deals and urgent flash promotions."
                  />
                </div>
                <div className="rounded-xl border border-indigo-200/90 bg-gradient-to-r from-indigo-50/80 to-purple-50/30 p-3.5">
                  <Switch
                    id="product-trending"
                    checked={product.isTrending}
                    disabled={writer.setTrendingStatus.isSubmitting}
                    onChange={() => writer.setTrendingStatus.run({ id: product.id, isTrending: !product.isTrending })}
                    label="📈 Trending Product"
                    description="Feature in Trending Picks and high-margin showcases."
                  />
                </div>
              </div>
            </PermissionGate>
          </FormSection>

          {/* The form shows the barcode when editing; so does this page. */}
          {product.barcode && (
            <ProductBarcode
              code={product.barcode}
              imageUrl={`/admin/catalog/products/${product.id}/barcode.png?v=6`}
              qrUrl={`/admin/catalog/products/${product.id}/qrcode.png`}
              product={product}
              className="max-w-xl"
            />
          )}

          {/* Not fields on the form, but real data a CJ product arrives with —
              shown only when the product has any. */}
          {product.variants.length > 0 && (
            <SectionCard
              title="Variants"
              description={`${product.variants.length} variant(s) · ${product.variantStock} units in stock`}
            >
              <Table className="rounded-none border-0" columns={VARIANT_COLUMNS} data={product.variants} getRowKey={(v) => v.id} />
            </SectionCard>
          )}

          {product.priceTiers.length > 0 && (
            <SectionCard title="Bulk price tiers" description={`Minimum order quantity: ${product.moq}`}>
              <Table className="rounded-none border-0" columns={TIER_COLUMNS} data={product.priceTiers} getRowKey={(t) => t.minQty} />
            </SectionCard>
          )}
        </div>
      </PageBody>

      {isEditing && (
        <ProductFormDrawer
          key={product.id}
          isOpen
          onClose={() => setIsEditing(false)}
          product={product}
          categories={categoryItems}
          brands={brandItems}
          writer={writer}
        />
      )}

      <ConfirmDialog
        isOpen={isRemoving}
        onClose={() => setIsRemoving(false)}
        title={`Delete product: "${product.name}"?`}
        description="This product will be permanently deleted from catalog and store listings."
        confirmLabel="Delete product"
        tone="danger"
        isSubmitting={writer.remove.isSubmitting}
        onConfirm={() =>
          writer.remove
            .runAsync({ id: product.id })
            .then(() => navigate(ADMIN_ROUTES.PRODUCTS, { replace: true }))
            // The failure is already toasted by useAdminMutation; staying put is the right outcome.
            .catch(() => setIsRemoving(false))
        }
      />
    </>
  )
}
