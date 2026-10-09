// The single source of chart styling. Nothing in charts/ picks a colour, a tick size or a grid
// stroke on its own. Same values as the web's chartTheme (recharts props become plain constants
// used by the react-native-svg charts in ./index.jsx).

export const SERIES = Object.freeze(['#2563eb', '#0d9488', '#7c3aed', '#db2777'])

// Status hues are NOT part of the categorical set - they mean a state.
export const STATUS = Object.freeze({
  good: '#15803d',
  warning: '#b45309',
  critical: '#b91c1c',
})

export const INK = Object.freeze({
  axis: '#94a3b8',
  label: '#475569',
  strong: '#0f172a',
})

export const GRID = '#f1f5f9'

export const CURSOR_LINE = '#cbd5e1'
export const CURSOR_FILL = '#f8fafc'
export const SURFACE = '#ffffff'
export const BORDER = '#e2e8f0'

// Shared axis metrics (web: tick fontSize 11, tickMargin 8, y axis width 52).
export const AXIS = Object.freeze({ fontSize: 11, tickMargin: 8, yWidth: 52, xHeight: 27 })

export const CHART_MARGIN = Object.freeze({ top: 8, right: 8, bottom: 0, left: 0 })

// Rupee axis ticks. Indian units, because a Rs 1.2 crore axis labelled "12,000,000" is unreadable.
export function formatAxisRupees(paise) {
  const rupees = paise / 100
  if (Math.abs(rupees) >= 10000000) return `₹${(rupees / 10000000).toFixed(1)}Cr`
  if (Math.abs(rupees) >= 100000) return `₹${Math.round(rupees / 100000)}L`
  if (Math.abs(rupees) >= 1000) return `₹${Math.round(rupees / 1000)}k`
  return `₹${rupees}`
}

export function formatAxisCount(value) {
  if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`
  return String(value)
}
