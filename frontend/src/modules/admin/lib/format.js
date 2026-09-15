// Formatting helpers shared across the panel. Kept out of the component files
// so those export components only (and stay fast-refresh friendly).

// Indian grouping (1,24,68,400) is not what en-US produces, and this is a
// rupee product — so the locale is pinned rather than left to the browser.
export function formatMoney(paise, { compact = false } = {}) {
  const rupees = paise / 100
  if (compact && Math.abs(rupees) >= 10000000) return `₹${(rupees / 10000000).toFixed(2)} Cr`
  if (compact && Math.abs(rupees) >= 100000) return `₹${(rupees / 100000).toFixed(2)} L`
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function formatCount(value) {
  return value.toLocaleString('en-IN')
}

// How long ago the server computed what is on screen. Deliberately coarse:
// the point is "this is current" or "this is stale", not a stopwatch.
export function formatRelativeTime(iso, now = Date.now()) {
  if (!iso) return null

  const then = Date.parse(iso)
  if (Number.isNaN(then)) return null

  const seconds = Math.max(0, Math.round((now - then) / 1000))
  if (seconds < 45) return 'just now'

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`

  return new Date(then).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
