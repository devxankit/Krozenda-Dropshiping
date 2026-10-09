import { formatIndian } from '../../lib/format'

// Tailwind colour helpers for the catalog screens: `bg-warning-500/95`, `border-slate-200/80`.
export function withAlpha(hex, alpha) {
  const h = String(hex).replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

// Formats rupees the way the web's formatRupees does (en-IN grouping, up to 2 decimals).
export function formatRupees(amount) {
  if (amount === null || amount === undefined) return '—'
  return `₹${formatIndian(amount, { maximumFractionDigits: 2 })}`
}
