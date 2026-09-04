// Money is held in paise everywhere in this panel — rupee floats drift under
// settlement arithmetic. Operators still type rupees, so the conversion
// happens at the edge of the form and nowhere else.

/** '1,234.50' -> 123450 paise. Returns 0 for anything unparseable. */
export function toPaise(input) {
  if (input === '' || input === null || input === undefined) return 0
  const rupees = Number(String(input).replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(rupees)) return 0
  return Math.round(rupees * 100)
}

/** 123450 paise -> '1234.50', for putting a stored figure back in an input. */
export function toRupeeInput(paise) {
  if (!paise) return ''
  return (paise / 100).toFixed(2)
}

/** Plain grouped rupees for totals rendered beside an input. */
export function formatRupees(paise) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** A voucher opens with two empty lines — the minimum a double entry needs. */
export const blankVoucherLines = () => [
  { code: '', debit: 0, credit: 0 },
  { code: '', debit: 0, credit: 0 },
]
