// Shape and copy for the create-product wizard, kept out of the page so the
// page stays composition-only (rule 03). The Variants step is skipped for
// every type except Variable — the wizard adapts rather than showing a step
// that does nothing.

import { PRODUCT_TYPE, PRODUCT_TYPE_LABELS } from '../constants'

export const PRODUCT_TYPE_OPTIONS = Object.freeze([
  { value: PRODUCT_TYPE.SIMPLE, label: 'Simple', description: 'One SKU, one price' },
  { value: PRODUCT_TYPE.VARIABLE, label: 'Variable', description: 'Size, colour, options' },
  { value: PRODUCT_TYPE.BULK, label: 'Bulk', description: 'Sold by weight or crate' },
  { value: PRODUCT_TYPE.WHOLESALE, label: 'Wholesale', description: 'B2B tiers only' },
  { value: PRODUCT_TYPE.PACK_SIZE, label: 'Pack size', description: 'Multipacks of one SKU' },
])

const TYPE_NOTES = Object.freeze({
  [PRODUCT_TYPE.SIMPLE]: 'One SKU with one price per buyer tier.',
  [PRODUCT_TYPE.VARIABLE]: 'Each variant carries its own SKU, stock and price.',
  [PRODUCT_TYPE.BULK]: 'Quantity is a measure, not a count — set the unit on the inventory step.',
  [PRODUCT_TYPE.WHOLESALE]: 'Hidden from retail buyers; only B2B tiers apply.',
  [PRODUCT_TYPE.PACK_SIZE]: 'Stock is drawn from the base SKU and divided by the pack size.',
})

export function WIZARD_STEPS(type) {
  const variantsApply = type === PRODUCT_TYPE.VARIABLE
  return [
    { id: 'basics', label: 'Type & basics', hint: 'Complete', state: 'done' },
    { id: 'pricing', label: 'Pricing & tax', hint: 'In progress', state: 'current' },
    {
      id: 'variants',
      label: 'Variants',
      hint: variantsApply ? 'Not started' : `Skipped for ${PRODUCT_TYPE_LABELS[type]}`,
      state: 'todo',
    },
    { id: 'inventory', label: 'Inventory', hint: 'Not started', state: 'todo' },
    { id: 'media', label: 'Media & SEO', hint: 'Not started', state: 'todo' },
  ]
}

export function draftProduct(type) {
  return {
    sku: 'KZ-HK-STL-1200',
    typeNote: TYPE_NOTES[type],
    priceTiers: [
      { role: 'retail_customer', label: 'Retail customer', mrp: 149900, price: 119900, minQty: 1, margin: 32.4 },
      { role: 'wholesaler', label: 'Wholesaler', mrp: 149900, price: 102000, minQty: 25, margin: 20.6 },
      { role: 'dealer', label: 'Dealer', mrp: 149900, price: 96500, minQty: 50, margin: 16.1 },
      { role: 'distributor', label: 'Distributor', mrp: 149900, price: 78000, minQty: 100, margin: 3.7 },
    ],
    commission: {
      resolvedFrom: 'category',
      type: 'percentage',
      value: 12.5,
      chain: [
        { scope: 'product', label: 'Product override', value: null, applies: false },
        { scope: 'vendor', label: 'Vendor rate', value: null, applies: false },
        { scope: 'category', label: 'Home & Kitchen', value: 12.5, applies: true },
        { scope: 'company', label: 'Company rate', value: null, applies: false },
        { scope: 'default', label: 'Platform default', value: 15, applies: false },
      ],
    },
    readiness: [
      { label: 'Category approved', state: 'Done', tone: 'success', note: 'Home & Kitchen › Cookware › Steel' },
      { label: 'Brand awaiting approval', state: 'Waiting', tone: 'warning', note: '“Nirvaan Steelworks” submitted 1 Sep' },
      { label: 'Product approval', state: 'Not sent', tone: 'neutral', note: 'Submit once the two issues are fixed' },
    ],
  }
}
