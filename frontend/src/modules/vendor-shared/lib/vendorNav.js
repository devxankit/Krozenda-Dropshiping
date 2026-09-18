// `isApproved` only adds or removes the Verification status entry. Everything
// else stays in the tree whatever the vendor's state — VendorSidebar renders
// the unreachable ones as locked rather than hiding them, so the shape of the
// panel does not change under a seller as they get approved.
export const getVendorNavTree = (isPartner = false, isApproved = true) => {
  const prefix = isPartner ? '/partner' : '/seller'
  return [
    {
      id: 'overview',
      label: 'Overview',
      items: [{ label: 'Dashboard', to: `${prefix}/dashboard`, icon: 'dashboard' }],
    },
    {
      id: 'catalog',
      label: 'Catalog',
      items: [
        { label: 'Products', to: `${prefix}/products`, icon: 'products' },
        { label: 'Inventory', to: `${prefix}/inventory`, icon: 'inventory' },
        { label: 'Categories', to: `${prefix}/categories`, icon: 'categories' },
        { label: 'Brands', to: `${prefix}/brands`, icon: 'brands' },
      ],
    },
    {
      id: 'sales',
      label: 'Sales',
      items: [
        { label: 'Orders', to: `${prefix}/orders`, icon: 'orders' },
        { label: 'Shipping', to: `${prefix}/shipping`, icon: 'shipments' },
        { label: 'Customers', to: `${prefix}/customers`, icon: 'customers' },
        { label: 'Coupons', to: `${prefix}/coupons`, icon: 'coupons' },
        { label: 'Returns & Refunds', to: `${prefix}/returns`, icon: 'returns' },
        { label: 'Reviews & Ratings', to: `${prefix}/reviews`, icon: 'reviews' },
      ],
    },
    {
      id: 'finance',
      label: 'Finance',
      items: [
        { label: 'Earnings & Settlements', to: `${prefix}/earnings`, icon: 'settlements' },
        { label: 'Analytics', to: `${prefix}/analytics`, icon: 'analytics' },
      ],
    },
    {
      id: 'support',
      label: 'Support',
      items: [
        { label: 'Support Tickets', to: `${prefix}/tickets`, icon: 'support' },
        { label: 'Notifications', to: `${prefix}/notifications`, icon: 'notifications' },
      ],
    },
    {
      id: 'account',
      label: 'Account',
      items: [
        // Drops out of the nav once there is nothing left to chase.
        ...(isApproved ? [] : [{ label: 'Verification Status', to: `${prefix}/status`, icon: 'shield' }]),
        { label: 'Store Profile', to: `${prefix}/profile`, icon: 'store' },
        { label: 'KYC Documents', to: `${prefix}/kyc-documents`, icon: 'kyc' },
        { label: 'Settings', to: `${prefix}/settings`, icon: 'settings' },
      ],
    },
  ]
}

export function isVendorItemActive(item, pathname) {
  if (pathname === item.to) return true
  if (pathname.startsWith(`${item.to}/`)) return true
  return false
}
