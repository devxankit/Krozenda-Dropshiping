// The seller screens only read the range list from the web controller (the admin dashboard query
// itself is admin-only and not part of the seller app).
export const DASHBOARD_RANGES = Object.freeze([
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
  { id: 'fy', label: 'This financial year' },
])

export const DASHBOARD_REFRESH_MS = 60_000
