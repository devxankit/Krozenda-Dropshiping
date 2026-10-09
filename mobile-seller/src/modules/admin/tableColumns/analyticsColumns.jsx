import { MoneyCell, PrimaryCell } from '../../../components/admin/display'

// Rule 07: column definitions are DATA. Only PRODUCT_REVENUE_COLUMNS is used by the seller app.
// (`cellClassName: 'tabular'` is the web's Tailwind class; the ui Table maps it to tabular numerals.)
export const PRODUCT_REVENUE_COLUMNS = Object.freeze([
  { key: 'name', header: 'Product', render: (product) => <PrimaryCell title={product.name} /> },
  { key: 'units', header: 'Units', width: '5rem', align: 'right', cellClassName: 'tabular' },
  {
    key: 'netSales',
    header: 'Net sales',
    width: '8rem',
    align: 'right',
    render: (product) => <MoneyCell amount={product.netSales} compact />,
  },
  {
    key: 'sellerEarnings',
    header: 'Earned',
    width: '8rem',
    align: 'right',
    render: (product) => <MoneyCell amount={product.sellerEarnings} compact />,
  },
])
