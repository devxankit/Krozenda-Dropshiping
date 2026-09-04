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
