// The web tooltip is hover/focus-only (never shown on touch), so natively it renders its children.
export function Tooltip({ children }) {
  return children ?? null
}
