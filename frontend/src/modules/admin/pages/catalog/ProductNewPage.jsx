import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button } from '../../../../components/ui'
import { ADMIN_ROUTES } from '../../../../config/routes'
import { PageBody, PageHeader } from '../../components/shell'
import { InlineAlert } from '../../components/feedback'
import { FormActions, Stepper, UnsavedIndicator } from '../../components/forms'
import { CommissionChain, PriceTierTable } from '../../components/catalog'
import {
  IdentifiersSection,
  ProductTypeSection,
  ProductWizardRail,
} from '../../components/catalog/ProductWizardSections'
import { BUSINESS_MODEL } from '../../../../config/constants'
import { PRODUCT_TYPE } from '../../constants'
import { useProductWriteController } from '../../controllers/useCatalogController'
import { WIZARD_STEPS, draftProduct } from '../../lib/productDraft'

export function ProductNewPage() {
  const navigate = useNavigate()
  const [type, setType] = useState(PRODUCT_TYPE.SIMPLE)
  const draft = draftProduct(type)
  const [fields, setFields] = useState({ name: '', sku: draft.sku })

  const writer = useProductWriteController({
    onSaved: () => navigate(ADMIN_ROUTES.PRODUCTS),
  })

  const save = (status) =>
    writer.create.run({
      ...fields,
      type,
      model: BUSINESS_MODEL.OWN_STOCK,
      category: 'Home & Kitchen › Cookware',
      brand: 'Nirvaan Steelworks',
      // Retail is the first tier; the other tiers are wholesale bands.
      price: draft.priceTiers?.[0]?.price ?? 0,
      stock: 0,
      status,
    })

  return (
    <PageBody>
      <PageHeader
        title="New product"
        trail={[{ label: 'New product' }]}
        actions={
          <>
            <Button variant="quiet" size="control" onClick={() => navigate(ADMIN_ROUTES.PRODUCTS)}>
              Discard
            </Button>
            <Button
              variant="secondary"
              size="control"
              isLoading={writer.create.isSubmitting}
              onClick={() => save('draft')}
            >
              Save draft
            </Button>
            <Button
              size="control"
              isLoading={writer.create.isSubmitting}
              onClick={() => save('submitted')}
            >
              Submit for approval
            </Button>
          </>
        }
      >
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-ink-subtle">
          <Badge tone="neutral">Draft</Badge>
          <span>Own stock · Krozenda warehouse, Bhiwandi</span>
          <span className="text-border-strong">·</span>
          <span>Saved 12 seconds ago</span>
        </div>
      </PageHeader>

      <Stepper steps={WIZARD_STEPS(type)} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <ProductTypeSection value={type} onChange={setType} />
          <IdentifiersSection draft={draft} value={fields} onChange={setFields} />

          <PriceTierTable
            tiers={draft.priceTiers}
            actions={
              <Button variant="secondary" size="sm" icon="add">
                Add tier
              </Button>
            }
          />

          <InlineAlert tone="warning" title="Distributor margin falls below the 8% floor">
            Raise the price to ₹818 or above, or record an override reason before submitting.
          </InlineAlert>

          <CommissionChain commission={draft.commission} />
        </div>

        <ProductWizardRail draft={draft} type={type} />
      </div>

      <FormActions
        status={<UnsavedIndicator count={3} fields={['SKU', 'HSN', 'price tiers']} />}
        note="Submitting writes an entry to the audit log"
      >
        <Button
          variant="secondary"
          size="control"
          isLoading={writer.create.isSubmitting}
          onClick={() => save('draft')}
        >
          Save draft
        </Button>
        <Button
          size="control"
          iconRight="arrowRight"
          isLoading={writer.create.isSubmitting}
          onClick={() => save('submitted')}
        >
          Submit for approval
        </Button>
      </FormActions>
    </PageBody>
  )
}
