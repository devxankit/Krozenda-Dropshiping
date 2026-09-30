import { Input, SegmentedControl, Select, Switch } from '../../../../components/ui'
import { SettingsShell } from '../../components/system/SettingsShell'
import { FormSection } from '../../components/forms'
import { InlineAlert } from '../../components/feedback'
import { ADMIN_PERMISSIONS } from '../../constants'
import { useAuthStore } from '../../../../lib/authStore'
import { useBusinessRulesController } from '../../controllers/useSystemController'

// The marketplace's money policy — backend AccountingConfig. Every field is
// read by the ledger, settlement or the payout jobs, so a change here changes
// what happens to money from the next transaction on. The default commission
// rate itself is edited under General → Commission & GST.

const LABELS = {
  maxCommissionPercent: 'commission limit',
  commissionBase: 'commission base',
  gatewayFeePercent: 'gateway fee %',
  gatewayFeeFixed: 'gateway fee (fixed)',
  gatewayFeeBearer: 'gateway fee bearer',
  shippingRevenueBearer: 'shipping fee',
  settlementHoldDays: 'settlement hold',
  requireCodRemittanceBeforeSettlement: 'COD remittance',
  sellerSettlementMode: 'payout mode',
  sellerSettlementWindowDays: 'payout window',
}

const COMMISSION_BASES = [
  { value: 'LINE_NET_OF_SELLER_FUNDED_DISCOUNT', label: 'Net of discounts the seller funded' },
  { value: 'LINE_GROSS', label: 'Full line price, before any discount' },
  { value: 'LINE_NET', label: 'Net of every discount' },
]

const BEARERS = [
  { id: 'PLATFORM', label: 'Platform' },
  { id: 'SELLER', label: 'Seller' },
]

const PAYOUT_MODES = [
  { id: 'AUTO', label: 'Automatic' },
  { id: 'MANUAL', label: 'Manual release' },
]

// A number field that keeps the draft numeric; blank reads as 0.
function NumberField({ id, label, value, onChange, suffix, description, disabled, min = 0, max }) {
  return (
    <Input
      id={id}
      label={label}
      type="number"
      size="control"
      min={min}
      max={max}
      suffix={suffix}
      value={value}
      disabled={disabled}
      description={description}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
    />
  )
}

function Choice({ label, description, items, value, onChange, disabled }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-slate-900">{label}</span>
      {disabled ? (
        <span className="text-xs text-slate-800">{items.find((item) => item.id === value)?.label || value}</span>
      ) : (
        <SegmentedControl items={items} activeId={value} onChange={onChange} />
      )}
      {description && <span className="text-2xs text-ink-subtle">{description}</span>}
    </div>
  )
}

export function BusinessRulesPage() {
  const controller = useBusinessRulesController()
  const canEdit = useAuthStore((state) => state.permissions.includes(ADMIN_PERMISSIONS.ACCOUNTING_COMMISSION_MANAGE))
  const { rules, update } = controller

  return (
    <SettingsShell
      title="Business rules"
      description="How commission, fees, settlement and payouts are worked out. Changes apply from the next transaction; orders already placed keep the values they were placed with."
      controller={controller}
      changed={controller.changed.map((key) => LABELS[key] || key)}
      onSave={canEdit ? controller.save : undefined}
      onDiscard={controller.discard}
      isSaving={controller.isSaving}
    >
      {() =>
        rules && (
          <>
            {!canEdit && (
              <InlineAlert tone="info" title="Read only">
                Changing these needs the commission-management permission.
              </InlineAlert>
            )}
            {rules.settlementHoldDays < rules.returnWindowDays && (
              <InlineAlert tone="warning" title="Hold is shorter than the return window">
                Buyers can return for {rules.returnWindowDays} days, but money is released after {rules.settlementHoldDays}.
                A return after that is recovered from the seller&apos;s next payout instead of netted off.
              </InlineAlert>
            )}

            <FormSection
              title="Commission"
              description={`The default rate (${rules.defaultCommissionPercent}%) is set under General → Commission & GST.`}
              columns={2}
            >
              <NumberField
                id="maxCommissionPercent"
                label="Commission limit"
                suffix="%"
                max={100}
                value={rules.maxCommissionPercent}
                onChange={(v) => update('maxCommissionPercent', v)}
                disabled={!canEdit}
                description="No commission rule can be set above this."
              />
              <Select
                id="commissionBase"
                label="Commission is charged on"
                size="control"
                options={COMMISSION_BASES}
                value={rules.commissionBase}
                disabled={!canEdit}
                onChange={(e) => update('commissionBase', e.target.value)}
              />
            </FormSection>

            <FormSection title="Payment gateway fee" description="Online payments only — COD and wallet have no gateway fee." columns={3}>
              <NumberField
                id="gatewayFeePercent"
                label="Fee"
                suffix="%"
                max={100}
                value={rules.gatewayFeePercent}
                onChange={(v) => update('gatewayFeePercent', v)}
                disabled={!canEdit}
              />
              <NumberField
                id="gatewayFeeFixed"
                label="Plus a fixed fee"
                suffix="₹"
                max={100000}
                value={rules.gatewayFeeFixed}
                onChange={(v) => update('gatewayFeeFixed', v)}
                disabled={!canEdit}
              />
              <Choice
                label="Paid by"
                items={BEARERS}
                value={rules.gatewayFeeBearer}
                onChange={(v) => update('gatewayFeeBearer', v)}
                disabled={!canEdit}
                description="Seller: deducted from their payout."
              />
            </FormSection>

            <FormSection title="Delivery charge" columns={1}>
              <Choice
                label="The delivery charge a buyer pays goes to"
                items={BEARERS}
                value={rules.shippingRevenueBearer}
                onChange={(v) => update('shippingRevenueBearer', v)}
                disabled={!canEdit}
              />
            </FormSection>

            <FormSection title="Settlement" description="When a delivered line can be paid out to its seller." columns={2}>
              <NumberField
                id="settlementHoldDays"
                label="Hold after delivery"
                suffix="days"
                max={180}
                value={rules.settlementHoldDays}
                onChange={(v) => update('settlementHoldDays', v)}
                disabled={!canEdit}
                description={`Buyers can return for ${rules.returnWindowDays} days after delivery.`}
              />
              <Switch
                id="requireCodRemittanceBeforeSettlement"
                checked={rules.requireCodRemittanceBeforeSettlement}
                disabled={!canEdit}
                onChange={(e) => update('requireCodRemittanceBeforeSettlement', e.target.checked)}
                label="Wait for COD cash"
                description="A COD line is paid out only after the courier has remitted the cash."
              />
            </FormSection>

            <FormSection title="Seller payouts" columns={2}>
              <Choice
                label="Payouts"
                items={PAYOUT_MODES}
                value={rules.sellerSettlementMode}
                onChange={(v) => update('sellerSettlementMode', v)}
                disabled={!canEdit}
                description="Automatic: the payout job pays eligible sellers. Manual: an admin releases each payout."
              />
              <NumberField
                id="sellerSettlementWindowDays"
                label="Extra wait before paying"
                suffix="days"
                value={rules.sellerSettlementWindowDays}
                onChange={(v) => update('sellerSettlementWindowDays', v)}
                disabled={!canEdit}
                description="After a settlement becomes eligible, a buffer to catch a problem before money leaves."
              />
            </FormSection>

            {controller.saveError && (
              <InlineAlert tone="danger" title="Not saved">
                {controller.saveError.message}
              </InlineAlert>
            )}
          </>
        )
      }
    </SettingsShell>
  )
}
