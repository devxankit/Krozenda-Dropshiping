// Path constants for the buyer app (same names as the web app's config/routes.js, minus the
// /app prefix — Expo Router paths). Nothing outside this file should write a raw path string.
export const AUTH_ROUTES = Object.freeze({
  ROOT: '/auth',
  WELCOME: '/auth/welcome',
  LOGIN: '/auth/login',
})

export const USER_ROUTES = Object.freeze({
  ROOT: '/',
  DASHBOARD: '/dashboard',
  CATEGORIES: '/categories',
  LISTING: '/listing',
  SEARCH: '/search',
  CART: '/cart',
  WISHLIST: '/wishlist',
  WALLET: '/wallet',
  ORDERS: '/orders',
  NOTIFICATIONS: '/notifications',
  COUPONS: '/coupons',
  SUPPORT: '/support',
  RETURNS: '/returns',
  SETTINGS: '/settings',
  PROFILE: '/profile',
  PROFILE_EDIT: '/profile/edit',
  ADDRESSES: '/profile/addresses',
  CHECKOUT_ADDRESS: '/checkout/address',
  CHECKOUT_DELIVERY: '/checkout/delivery',
  CHECKOUT_SUMMARY: '/checkout/summary',
  CHECKOUT_PAYMENT: '/checkout/payment',
  CHECKOUT_SUCCESS: '/checkout/success',
})

export const userPath = Object.freeze({
  product: (productId) => `/product/${productId}`,
  order: (orderId) => `/orders/${orderId}`,
  orderTrack: (orderId) => `/orders/${orderId}/track`,
  orderInvoice: (orderId) => `/orders/${orderId}/invoice`,
  orderInvoicePreview: (orderId) => `/orders/${orderId}/invoice/preview`,
  orderReview: (orderId) => `/orders/${orderId}/review`,
  listing: (params = {}) => {
    const qs = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '' && value !== false) qs.set(key, String(value))
    }
    const query = qs.toString()
    return query ? `/listing?${query}` : '/listing'
  },
  search: (query) => `/search${query ? `?q=${encodeURIComponent(query)}` : ''}`,
})

// Public CMS pages (served by GET /cms/... on the web as /p/:slug etc.)
export const CMS_SLUGS = Object.freeze({
  TERMS: 'terms',
  PRIVACY: 'privacy-policy',
  RETURN: 'return-policy',
  SHIPPING: 'shipping-policy',
  ABOUT: 'about',
  COD: 'cod-policy',
})

// Public CMS page routes (Expo Router files in src/app: terms.js, privacy.js, ...; /p/[slug] for any other slug).
export const CMS_ROUTES = Object.freeze({
  TERMS: '/terms',
  PRIVACY: '/privacy',
  RETURN: '/return-policy',
  SHIPPING: '/shipping-policy',
  ABOUT: '/about',
  COD: '/cod-policy',
  page: (slug) => `/p/${slug}`,
})
