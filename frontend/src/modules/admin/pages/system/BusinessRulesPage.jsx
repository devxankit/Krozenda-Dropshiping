import { SettingsShell } from '../../components/system/SettingsShell'
import {
  DropshipModelSection,
  PayoutSection,
  ReturnsSection,
  SellerModelSection,
} from '../../components/system/BusinessRuleSections'
import { useBusinessRulesController } from '../../controllers/useSystemController'

const CHANGED_LABELS = {
  commissionRate: 'commission rate',
  minimumPayoutAmount: 'minimum payout',
  rtoCostBearer: 'RTO cost bearer',
}

// The billing specification's platform_configurations document, as forms.
// Nothing financial is hardcoded anywhere in the panel — it is read from here.
export function BusinessRulesPage() {
  const controller = useBusinessRulesController()
  const changed = (controller.data?.changed || []).map((key) => CHANGED_LABELS[key] || key)

  return (
    <SettingsShell
      title="Business rules"
      description="Fee, tax, settlement and payout parameters. Changes apply to orders placed from the moment you save — orders already in flight keep the values snapshotted when they were placed."
      controller={controller}
      changed={changed}
    >
      {(rules) => (
        <>
          <SellerModelSection rules={rules} />
          <DropshipModelSection rules={rules} />
          <PayoutSection rules={rules} />
          <ReturnsSection rules={rules} />
        </>
      )}
    </SettingsShell>
  )
}
