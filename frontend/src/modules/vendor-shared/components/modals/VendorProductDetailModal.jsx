import { Badge, Button, Modal } from '../../../../components/ui'
import { ProductBarcode } from '../../../../components/common/ProductBarcode'

// Read-only product view for the seller panel — what a barcode scan opens,
// and the "View details" action on a product row. Editing stays in the
// existing Edit / Update-stock modals, reachable from the footer.

const APPROVAL_TONE = { APPROVED: 'success', PENDING: 'warning', REJECTED: 'danger' }

function formatRupees(amount) {
  if (amount === null || amount === undefined) return '—'
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-2xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{children ?? '—'}</dd>
    </div>
  )
}

export function VendorProductDetailModal({ product, isOpen, onClose, onEdit, onUpdateStock }) {
  if (!product) return null

  const stock = product.variants?.length > 0 ? product.variantStock : product.stock

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Product details"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onUpdateStock(product)}>
            Update stock
          </Button>
          <Button onClick={() => onEdit(product)}>Edit product</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex gap-4">
          <img
            src={product.images?.[0] || '/images/default-product.png'}
            alt=""
            className="h-20 w-20 shrink-0 rounded-lg border border-slate-100 bg-white object-contain p-1"
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <h3 className="text-base font-bold text-slate-900">{product.name}</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={product.isActive ? 'success' : 'neutral'} size="sm">
                {product.status}
              </Badge>
              <Badge tone={APPROVAL_TONE[product.approvalStatus] || 'neutral'} size="sm">
                {product.approvalStatus}
              </Badge>
            </div>
            {product.approvalStatus === 'REJECTED' && product.rejectionReason && (
              <p className="text-xs text-danger-600">{product.rejectionReason}</p>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="SKU">{product.sku || '—'}</Field>
          <Field label="Category">{product.category?.name || '—'}</Field>
          <Field label="Brand">{product.brand?.name || '—'}</Field>
          <Field label="Selling price">
            <span className="tabular">{formatRupees(product.price)}</span>
          </Field>
          <Field label="Sale price">
            <span className="tabular">{formatRupees(product.salePrice)}</span>
          </Field>
          <Field label="MRP">
            <span className="tabular">{formatRupees(product.mrp)}</span>
          </Field>
          <Field label="Stock">
            <span className={`tabular ${stock > 0 ? '' : 'text-danger-600'}`}>
              {stock > 0 ? `${stock.toLocaleString('en-IN')} units` : 'Out of stock'}
            </span>
          </Field>
          <Field label="HSN / GST">
            {[product.hsnCode, product.gstRate != null ? `${product.gstRate}%` : null].filter(Boolean).join(' · ') ||
              '—'}
          </Field>
          <Field label="Weight">{product.weight != null ? `${product.weight} kg` : '—'}</Field>
        </dl>

        {product.shortDescription && <p className="text-sm text-slate-600">{product.shortDescription}</p>}

        {product.barcode && (
          <ProductBarcode
            code={product.barcode}
            imageUrl={`/vendor/products/${product.id}/barcode.png?v=6`}
            qrUrl={`/vendor/products/${product.id}/qrcode.png`}
            product={product}
          />
        )}
      </div>
    </Modal>
  )
}
