// The single source of chart styling. Nothing in charts/ picks a colour, a
// tick size or a grid stroke on its own.
//
// Series colours are literal hex rather than CSS custom properties: recharts
// writes them into SVG fill/stroke attributes, where a `var(--x)` silently
// renders nothing. They mirror the `chart.1..4` Tailwind tokens exactly — if
// one changes, change it in both places.
//
// This four-hue set is validated for colour-vision deficiency against both
// surfaces (adjacent-pair ΔE ≥ 8, normal-vision ≥ 15). Assign in fixed order
// and never cycle: a fifth series folds into "Other" or the chart facets.

export const SERIES = Object.freeze(['#2563eb', '#0d9488', '#7c3aed', '#db2777'])

export const SERIES_SOFT = Object.freeze(['#dbeafe', '#ccfbf1', '#ede9fe', '#fce7f3'])

// Status hues are NOT part of the categorical set — they mean a state, and
// spending one on "series 3" makes both meanings unreadable.
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

// Hover cursor colours. recharts writes these into SVG attributes, where a
// Tailwind class cannot apply — so they live here with the rest of the theme
// rather than being typed into a component.
export const CURSOR_LINE = '#cbd5e1'
export const CURSOR_FILL = '#f8fafc'
export const SURFACE = '#ffffff'
export const BORDER = '#e2e8f0'

// Shared recharts props, so every chart in the panel has the same axis weight,
// tick size and margin without each one restating it.
export const AXIS_PROPS = Object.freeze({
  tick: { fontSize: 11, fill: INK.axis },
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
})

export const X_AXIS_PROPS = Object.freeze({
  ...AXIS_PROPS,
  axisLine: { stroke: BORDER },
})

export const GRID_PROPS = Object.freeze({
  stroke: GRID,
  strokeDasharray: '0',
  vertical: false,
})

export const CHART_MARGIN = Object.freeze({ top: 8, right: 8, bottom: 0, left: 0 })

// ₹ axis ticks. Indian units, because a ₹1.2 crore axis labelled "12,000,000"
// is unreadable to the people using this panel.
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
