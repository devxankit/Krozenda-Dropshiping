// CSS-only tooltip: no positioning library, no portal, no state. It shows on
// hover and on keyboard focus, which is the part hand-rolled tooltips usually
// drop. Anything that needs to escape an overflow container is a Popover, not
// a tooltip.

const PLACEMENT = Object.freeze({
  top: 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-1.5 -translate-x-1/2',
  left: 'right-full top-1/2 mr-1.5 -translate-y-1/2',
  right: 'left-full top-1/2 ml-1.5 -translate-y-1/2',
})

export function Tooltip({ label, placement = 'top', children, className = '' }) {
  if (!label) return children

  return (
    <span className={`group/tooltip relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-popover hidden whitespace-nowrap rounded-md bg-surface-inverted px-2 py-1 text-2xs font-medium text-white shadow-overlay group-hover/tooltip:block group-focus-within/tooltip:block ${PLACEMENT[placement]}`}
      >
        {label}
      </span>
    </span>
  )
}
