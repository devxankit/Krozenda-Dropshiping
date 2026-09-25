import { useState } from 'react'
import { Badge, Checkbox, Icon } from '../../../components/ui'

// One staged product in the import preview: everything the CSV said about it,
// its fetched images, and what approving will do with it.

function formatRupees(amount) {
  if (amount === null || amount === undefined) return '—'
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

const ROW_STATUS = {
  VALID: { label: 'Ready', tone: 'success' },
  INVALID: { label: 'Has errors', tone: 'danger' },
  CREATED: { label: 'Created', tone: 'success' },
  UPDATED: { label: 'Updated', tone: 'brand' },
  SKIPPED: { label: 'Skipped', tone: 'neutral' },
  FAILED: { label: 'Failed', tone: 'danger' },
}

const ACTION = {
  CREATE: { label: 'New product', tone: 'brand' },
  UPDATE: { label: 'Updates existing', tone: 'accent' },
  SKIP: { label: 'Already exists — skip', tone: 'neutral' },
}

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-semibold uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="mt-0.5 truncate text-xs text-slate-900">{children ?? '—'}</dd>
    </div>
  )
}

function Gallery({ images }) {
  const [active, setActive] = useState(0)
  if (!images.length) {
    return (
      <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-surface-subtle text-ink-faint">
        <Icon name="file" className="h-6 w-6" />
      </div>
    )
  }
  return (
    <div className="flex w-28 shrink-0 flex-col gap-1.5">
      <img
        src={images[Math.min(active, images.length - 1)]}
        alt=""
        className="h-28 w-28 rounded-lg border border-border object-cover"
        loading="lazy"
      />
      {images.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show image ${i + 1}`}
              className={`h-6 w-6 overflow-hidden rounded border ${i === active ? 'border-brand-600 ring-1 ring-brand-600' : 'border-border'}`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function VariantTable({ variants }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface-subtle text-2xs font-semibold uppercase tracking-wider text-ink-subtle">
          <tr>
            <th scope="col" className="px-3 py-2">Variant</th>
            <th scope="col" className="px-3 py-2">Attributes</th>
            <th scope="col" className="px-3 py-2">SKU</th>
            <th scope="col" className="px-3 py-2 text-right">Price</th>
            <th scope="col" className="px-3 py-2 text-right">Sale</th>
            <th scope="col" className="px-3 py-2 text-right">Stock</th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => (
            <tr key={v.name} className="border-t border-border">
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  {v.image && <img src={v.image} alt="" className="h-6 w-6 rounded object-cover" loading="lazy" />}
                  <span className="font-medium text-slate-900">{v.name}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-ink-muted">
                {Object.entries(v.attributes || {}).map(([k, val]) => `${k}: ${val}`).join(', ') || '—'}
              </td>
              <td className="px-3 py-2 font-mono text-2xs text-ink-muted">{v.sku || '—'}</td>
              <td className="tabular px-3 py-2 text-right">{v.price === null ? 'Same' : formatRupees(v.price)}</td>
              <td className="tabular px-3 py-2 text-right">{v.salePrice === null ? '—' : formatRupees(v.salePrice)}</td>
              <td className="tabular px-3 py-2 text-right">{v.stock}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ImportRowCard({ row, canReview, onToggle, isToggling }) {
  const [expanded, setExpanded] = useState(false)
  const p = row.product
  const status = ROW_STATUS[row.status] || ROW_STATUS.VALID
  const action = row.status === 'VALID' ? ACTION[row.action] : null
  const selectable = canReview && row.status === 'VALID'
  const dims = p.dimensions ? `${p.dimensions.lengthCm} × ${p.dimensions.breadthCm} × ${p.dimensions.heightCm} cm` : null
  const hasDetails = Boolean(p.description || p.shortDescription || p.variants.length)

  return (
    <article
      className={`rounded-xl border bg-surface p-4 transition-colors ${
        row.status === 'INVALID' || row.status === 'FAILED'
          ? 'border-danger-200'
          : row.excluded
            ? 'border-border opacity-60'
            : 'border-border'
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <Gallery images={p.images} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-900">{p.name || <span className="text-ink-faint">No name</span>}</h3>
              <p className="mt-0.5 text-2xs text-ink-subtle">
                <span className="font-mono">{p.sku || 'no SKU'}</span>
                {' · '}
                {row.lines.length > 1 ? `CSV lines ${row.lines.join(', ')}` : `CSV line ${row.lines[0]}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {action && <Badge tone={action.tone} size="sm">{action.label}</Badge>}
              {row.excluded && row.status === 'VALID' && <Badge tone="warning" size="sm">Excluded</Badge>}
              <Badge tone={status.tone} size="sm" dot>{status.label}</Badge>
              {selectable && (
                <Checkbox
                  id={`include-${row.id}`}
                  label="Include"
                  checked={!row.excluded}
                  disabled={isToggling}
                  onChange={() => onToggle(row)}
                />
              )}
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4 lg:grid-cols-6">
            <Field label="Category">{p.category?.name}</Field>
            <Field label="Brand">{p.brand?.name}</Field>
            <Field label="Price">{formatRupees(p.price)}</Field>
            <Field label="Sale price">{p.salePrice === null ? null : formatRupees(p.salePrice)}</Field>
            <Field label="MRP">{p.mrp === null ? null : formatRupees(p.mrp)}</Field>
            <Field label="Stock">{p.stock}</Field>
            <Field label="Weight">{p.weight === null ? null : `${p.weight} kg`}</Field>
            <Field label="Dimensions">{dims}</Field>
            <Field label="HSN / GST">
              {p.hsnCode || p.gstRate !== null ? `${p.hsnCode || '—'} / ${p.gstRate ?? '—'}%` : null}
            </Field>
            <Field label="MOQ">{p.moq}</Field>
            <Field label="Status">{p.status}</Field>
            <Field label="Returnable">{p.isReturnable === null ? null : p.isReturnable ? 'Yes' : 'No'}</Field>
          </dl>

          {row.existingProduct && (
            <p className="mt-3 text-2xs text-ink-subtle">
              Matches existing product <span className="font-semibold text-slate-900">{row.existingProduct.name}</span>
            </p>
          )}

          {row.errors.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-lg bg-danger-50 p-3 text-xs text-danger-700">
              {row.errors.map((e) => (
                <li key={e} className="flex gap-1.5">
                  <Icon name="error" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          )}
          {row.notes.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-warning-700">
              {row.notes.map((n) => (
                <li key={n} className="flex gap-1.5">
                  <Icon name="info" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}
          {row.resultMessage && (
            <p className={`mt-2 text-xs ${row.status === 'FAILED' ? 'text-danger-700' : 'text-success-700'}`}>
              {row.resultMessage}
            </p>
          )}

          {hasDetails && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
              aria-expanded={expanded}
            >
              <Icon name={expanded ? 'chevronUp' : 'chevronDown'} className="h-3.5 w-3.5" />
              {expanded
                ? 'Hide details'
                : `Description${p.variants.length ? ` & ${p.variants.length} variant${p.variants.length === 1 ? '' : 's'}` : ''}`}
            </button>
          )}
          {expanded && (
            <div className="mt-3 flex flex-col gap-3">
              {p.shortDescription && <p className="text-xs font-medium text-slate-700">{p.shortDescription}</p>}
              {p.description && (
                <p className="max-h-48 overflow-y-auto whitespace-pre-line text-xs text-ink-muted">{p.description}</p>
              )}
              {p.variants.length > 0 && <VariantTable variants={p.variants} />}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
