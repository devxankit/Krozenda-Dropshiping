// Path constants for every module. Modules build their own routes.jsx from
// these; nothing outside this file should write a raw path string.

export const AUTH_ROUTES = Object.freeze({
  ROOT: '/auth',
  WELCOME: '/auth/welcome',
  LOGIN: '/auth/login',
  MOBILE: '/auth/mobile',
  OTP: '/auth/otp',
  VERIFIED: '/auth/verified',
  REGISTER: '/auth/register',
  FORGOT_PASSWORD: '/auth/forgot-password',
})

export const USER_ROUTES = Object.freeze({
  ROOT: '/app',
  DASHBOARD: '/app/dashboard',
  SHOWCASE: '/app/showcase',
})

export const SELLER_ROUTES = Object.freeze({
  ROOT: '/seller',
  DASHBOARD: '/seller/dashboard',
})

export const DROPSHIPPING_PARTNER_ROUTES = Object.freeze({
  ROOT: '/partner',
  DASHBOARD: '/partner/dashboard',
})

export const ADMIN_ROUTES = Object.freeze({
  ROOT: '/admin',
  DASHBOARD: '/admin/dashboard',
})

export const ROUTES = Object.freeze({
  HOME: '/',
  AUTH: AUTH_ROUTES,
  USER: USER_ROUTES,
  SELLER: SELLER_ROUTES,
  DROPSHIPPING_PARTNER: DROPSHIPPING_PARTNER_ROUTES,
  ADMIN: ADMIN_ROUTES,
})
