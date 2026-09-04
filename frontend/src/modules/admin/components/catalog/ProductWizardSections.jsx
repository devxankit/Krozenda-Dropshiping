import { Badge, Input, RadioCards, Select } from '../../../../components/ui'
import { PRODUCT_TYPE_LABELS } from '../../constants'
import { FormSection } from '../forms'
import { PRODUCT_TYPE_OPTIONS } from '../../lib/productDraft'

const GST_OPTIONS = [0, 5, 12, 18, 28].map((rate) => ({
  value: String(rate),
  label: rate === 18 ? '18% — standard rate' : `${rate}%`,
}))

export function ProductTypeSection({ value, onChange }) {
  return (
    <FormSection
      title="Product type"
      description="Determines which steps apply and how stock is counted"
      columns={1}
    >
      <RadioCards
        name="productType"
        value={value}
        onChange={onChange}
        options={PRODUCT_TYPE_OPTIONS}
        columns={5}
      />
    </FormSection>
  )
}

// `value`/`onChange` cover the fields the create actually submits; the rest
// of the wizard is still illustrative until the product API exists.
export function IdentifiersSection({ draft, value, onChange }) {
  return (
    <FormSection
      title="Identifiers & tax"
      description="Snapshotted onto every order line — never recomputed from the current settings"
    >
      <Input
        id="product-name"
        label="Product name"
        required
        size="control"
        containerClassName="col-span-2"
        placeholder="Nirvaan Triply Stainless Steel Kadai, 1.2 L"
        value={value?.name ?? ''}
        onChange={(event) => onChange?.({ ...value, name: event.target.value })}
        description="Shown to buyers exactly as typed"
      />
      <Input
        id="sku"
        label="SKU"
        required
        size="control"
        value={value?.sku ?? draft.sku}
        onChange={(event) => onChange?.({ ...value, sku: event.target.value })}
        description="Unique across the whole catalog"
      />
      <Input
        id="barcode"
        label="Barcode (EAN-13)"
        defaultValue="8901234567894"
        size="control"
        description="Optional; printed on packing slips"
      />
      <Input
        id="hsn"
        label="HSN code"
        required
        defaultValue="7323"
        size="control"
        error="HSN must be 6 or 8 digits for a taxable supply"
      />
      <Select
        id="gst"
        label="GST rate"
        required
        options={GST_OPTIONS}
        defaultValue="18"
        size="control"
        description="Applied at checkout and on the invoice"
      />
      <Input
        id="moq"
        label="Minimum order quantity"
        defaultValue="1"
        size="control"
        description="Enforced per buyer tier below"
      />
      <Select
        id="origin"
        label="Country of origin"
        required
        options={[{ value: 'IN', label: 'India' }]}
        defaultValue="IN"
        size="control"
        description="Required on the tax invoice"
      />
    </FormSection>
  )
}

export function ProductWizardRail({ draft, type }) {
  return (
    <div className="flex flex-col gap-4">
      <FormSection title="Before this can go live" columns={1}>
        <ul className="flex flex-col gap-2.5">
          {draft.readiness.map((item) => (
            <li key={item.label} className="flex items-start gap-2 text-xs">
              <Badge tone={item.tone} size="sm" dot>
                {item.state}
              </Badge>
              <span className="min-w-0">
                <span className="block font-semibold text-slate-900">{item.label}</span>
                <span className="block text-2xs text-ink-faint">{item.note}</span>
              </span>
            </li>
          ))}
        </ul>
      </FormSection>

      <FormSection title="Selling as" columns={1}>
        <p className="text-xs leading-relaxed text-ink-muted">
          A <strong className="font-semibold text-slate-900">{PRODUCT_TYPE_LABELS[type]}</strong>{' '}
          product. {draft.typeNote}
        </p>
      </FormSection>
    </div>
  )
}
