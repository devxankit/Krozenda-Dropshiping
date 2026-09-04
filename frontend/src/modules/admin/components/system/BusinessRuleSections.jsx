import { Badge, Input, RadioCards, SegmentedControl, Select, Switch } from '../../../../components/ui'
import { FormRow, FormSection } from '../forms'

// The billing specification's platform_configurations document, as forms.
// Kept out of the page so the page stays composition-only (rule 03).

export const BEARER_ITEMS = Object.freeze([
  { id: 'buyer', label: 'Buyer' },
  { id: 'seller', label: 'Seller' },
  { id: 'platform', label: 'Platform' },
])

const APPROVAL_OPTIONS = Object.freeze([
  {
    value: 'automatic',
    label: 'Fully automated',
    description: 'Batches release on schedule with no human step',
  },
  {
    value: 'maker_checker',
    label: 'Maker–checker',
    description:
      'The system prepares a draft; an admin approves it with a two-factor code before funds move',
  },
])

export function SellerModelSection({ rules }) {
  return (
    <>
      <FormSection
        title="Marketplace seller model"
        description="Applies when the vendor is the seller of record and Krozenda charges a commission."
        badge={<Badge tone="brand">Model B</Badge>}
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-900">Commission type</label>
          <SegmentedControl
            items={[
              { id: 'percentage', label: 'Percentage' },
              { id: 'fixed', label: 'Fixed amount' },
            ]}
            activeId={rules.sellerModel.commissionType}
            onChange={() => {}}
          />
        </div>
        <Input id="commissionRate" label="Commission rate" size="control" suffix="%" defaultValue={rules.sellerModel.commissionRate} description="Changed from 12.5%" />
        <Input id="gstOnCommission" label="GST on commission" size="control" suffix="%" defaultValue={rules.sellerModel.gstOnCommissionRate} description="Charged on the commission invoice" />
        <Input id="tcs" label="TCS under section 52" size="control" suffix="%" defaultValue={rules.sellerModel.tcsSec52Rate} description="Collected on net taxable supplies" />
        <Input id="tds" label="TDS under section 194-O" size="control" suffix="%" defaultValue={rules.sellerModel.tdsSec194oRate} description="Deducted from the seller payout" />
        <Input id="sellerHold" label="Settlement hold" size="control" suffix="days" defaultValue={rules.sellerModel.settlementHoldDays} description="Covers the return window" />
      </FormSection>

      <FormSection title="Shipping" columns={1}>
        <FormRow
          label="Who pays for shipping"
          description="Applied at checkout unless a coupon or the free-shipping threshold overrides it"
          className="border-b-0 px-0 py-0"
        >
          <SegmentedControl
            items={BEARER_ITEMS}
            activeId={rules.sellerModel.shippingBearer}
            onChange={() => {}}
          />
        </FormRow>
      </FormSection>
    </>
  )
}

export function DropshipModelSection({ rules }) {
  return (
    <>
      <FormSection
        title="Dropshipping model"
        description="Applies when Krozenda is the merchant of record and buys from the supplier at cost."
        badge={<Badge tone="success">Model A</Badge>}
      >
        <Input id="margin" label="Default retail margin" size="control" suffix="%" defaultValue={rules.dropshipModel.defaultMarginPercentage} description="Over the supplier cost price" />
        <Input id="dropHold" label="Settlement hold" size="control" suffix="days" defaultValue={rules.dropshipModel.settlementHoldDays} description="Before the supplier is paid" />
        <Select id="mor" label="Merchant of record" size="control" options={[{ value: 'krozenda', label: 'Krozenda entity' }]} defaultValue="krozenda" description="Determines who issues the buyer invoice" />
      </FormSection>

      <FormSection title="Input tax credit" columns={1}>
        <Switch
          id="itc"
          checked={rules.dropshipModel.b2bGstCreditEnabled}
          onChange={() => {}}
          label="Claim input tax credit on supplier invoices"
          description="Suppliers issue a B2B tax invoice to Krozenda; output GST is offset against the input credit"
        />
      </FormSection>
    </>
  )
}

export function PayoutSection({ rules }) {
  return (
    <>
      <FormSection title="Payouts" columns={1}>
        <Switch
          id="autoPayout"
          checked={rules.payouts.autoPayoutEnabled}
          onChange={() => {}}
          label="Run payouts automatically"
          description={`A nightly job groups eligible sub-orders into one batch per vendor. Last run ${rules.payouts.lastRunAt}.`}
        />
        <RadioCards
          name="approvalMode"
          label="Approval mode"
          value={rules.payouts.approvalMode}
          onChange={() => {}}
          options={APPROVAL_OPTIONS}
        />
      </FormSection>

      <FormSection title="Payout limits">
        <Input id="minPayout" label="Minimum payout" size="control" defaultValue="₹250" description="Changed from ₹100" />
        <Select id="schedule" label="Payout schedule" size="control" options={[{ value: 'weekly', label: rules.payouts.schedule }]} defaultValue="weekly" description="Overridable per vendor" />
        <Select id="mode" label="Transfer mode" size="control" options={[{ value: 'imps', label: rules.payouts.transferMode }]} defaultValue="imps" description="Falls back to NEFT above ₹5,00,000" />
      </FormSection>
    </>
  )
}

export function ReturnsSection({ rules }) {
  return (
    <FormSection
      title="Returns & return to origin"
      description="The platform default is no returns. These settings govern the permitted exceptions and who absorbs an RTO."
    >
      <Input id="returnWindow" label="Return window" size="control" suffix="days" defaultValue={rules.returns.windowDays} description="Damaged, wrong or missing item only" />
      <Input id="evidence" label="Minimum evidence photos" size="control" defaultValue={rules.returns.minimumEvidencePhotos} description="Checked by an admin before approval" />
      <Select
        id="rtoBearer"
        label="RTO shipping cost"
        size="control"
        options={BEARER_ITEMS.map((item) => ({
          value: item.id,
          label: `Borne by the ${item.label.toLowerCase()}`,
        }))}
        defaultValue={rules.returns.rtoCostBearer}
        description="Changed from platform"
      />
    </FormSection>
  )
}
