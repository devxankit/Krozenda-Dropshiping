// Formatting helpers (port of admin/lib/format.js). Indian digit grouping (1,24,68,400) is done by
// hand so it does not depend on Hermes' Intl support.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Same output as Number.prototype.toLocaleString('en-IN', { minimumFractionDigits, maximumFractionDigits }).
export function formatIndian(value, { minimumFractionDigits = 0, maximumFractionDigits = 3 } = {}) {
  const num = Number(value)
  if (!Number.isFinite(num)) return String(value)
  const fixed = Math.abs(num).toFixed(maximumFractionDigits)
  let [int, frac = ''] = fixed.split('.')
  while (frac.length > minimumFractionDigits && frac.endsWith('0')) frac = frac.slice(0, -1)
  if (int.length > 3) {
    const head = int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')
    int = `${head},${int.slice(-3)}`
  }
  const negative = num < 0 && Number(fixed) !== 0
  return `${negative ? '-' : ''}${int}${frac ? `.${frac}` : ''}`
}

export function formatMoney(paise, { compact = false } = {}) {
  const rupees = paise / 100
  if (compact && Math.abs(rupees) >= 10000000) return `₹${(rupees / 10000000).toFixed(2)} Cr`
  if (compact && Math.abs(rupees) >= 100000) return `₹${(rupees / 100000).toFixed(2)} L`
  return `₹${formatIndian(rupees, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function formatCount(value) {
  return formatIndian(value)
}

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
  const d = new Date(then)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}
