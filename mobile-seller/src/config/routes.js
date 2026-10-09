// Path constants for the seller app (same sections as the web app's /seller/* panel, minus the
// /seller prefix - Expo Router paths). Nothing outside this file should write a raw path string.
export const AUTH_ROUTES = Object.freeze({
  LOGIN: '/login',
  REGISTER: '/register',
})

export const SELLER_ROUTES = Object.freeze({
  ROOT: '/dashboard',
  STATUS: '/status',
  DASHBOARD: '/dashboard',
  PRODUCTS: '/products',
  INVENTORY: '/inventory',
  CATEGORIES: '/categories',
  BRANDS: '/brands',
  ORDERS: '/orders',
  SHIPPING: '/shipping',
  SHIPPING_SETTINGS: '/shipping/settings',
  CUSTOMERS: '/customers',
  COUPONS: '/coupons',
  RETURNS: '/returns',
  REVIEWS: '/reviews',
  EARNINGS: '/earnings',
  ANALYTICS: '/analytics',
  REVENUE: '/revenue',
  REPORTS: '/reports',
  TICKETS: '/tickets',
  NOTIFICATIONS: '/notifications',
  PROFILE: '/profile',
  KYC_DOCUMENTS: '/kyc-documents',
  SETTINGS: '/settings',
})
