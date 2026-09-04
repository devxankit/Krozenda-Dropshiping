export const getVendorNavTree = (isPartner = false) => {
  const prefix = isPartner ? '/partner' : '/seller'
  return [
    {
      id: 'overview',
      label: 'Overview',
      items: [
        { label: 'Dashboard', to: `${prefix}/dashboard`, icon: 'dashboard' },
      ],
    },
    {
      id: 'catalog',
      label: 'Catalog',
      items: [
        { label: 'Products', to: `${prefix}/products`, icon: 'products', badge: '214' },
        { label: 'Inventory', to: `${prefix}/inventory`, icon: 'inventory' },
      ],
    },
    {
      id: 'fulfilment',
      label: 'Fulfilment',
      items: [
        { label: 'Orders', to: `${prefix}/orders`, icon: 'orders', badge: 6, badgeTone: 'warning' },
        { label: 'Shipments', to: `${prefix}/shipments`, icon: 'shipments' },
      ],
    },
    {
      id: 'finance',
      label: 'Finance & KYC',
      items: [
        { label: 'Settlements', to: `${prefix}/settlements`, icon: 'settlements' },
        { label: 'KYC Documents', to: `${prefix}/kyc-documents`, icon: 'kyc' },
      ],
    },
    {
      id: 'system',
      label: 'Settings',
      items: [
        { label: 'Store Settings', to: `${prefix}/settings`, icon: 'settings' },
      ],
    },
  ]
}

export function isVendorItemActive(item, pathname) {
  if (pathname === item.to) return true
  if (pathname.startsWith(`${item.to}/`)) return true
  return false
}
