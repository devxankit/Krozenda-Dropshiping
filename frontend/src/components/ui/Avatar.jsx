const SIZE_CLASSES = Object.freeze({
  xs: 'h-7 w-7 text-2xs',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-18 w-18 text-lg',
})

const SHAPE_CLASSES = Object.freeze({
  circle: 'rounded-full',
  square: 'rounded-lg',
})

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({
  name = '',
  src,
  size = 'md',
  shape = 'circle',
  tone = 'brand',
  className = '',
}) {
  const base = `inline-flex shrink-0 items-center justify-center overflow-hidden font-semibold aspect-square ${SIZE_CLASSES[size]} ${SHAPE_CLASSES[shape]} ${className}`

  const toneClass =
    tone === 'inverted'
      ? 'bg-surface-inverted text-white'
      : 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100'

  if (src) {
    return (
      <span className={`${base} shadow-sm ring-2 ring-slate-100`}>
        <img src={src} alt={name} className="h-full w-full object-cover" />
      </span>
    )
  }

  return (
    <span className={`${base} ${toneClass}`} aria-hidden="true" title={name || undefined}>
      {initials(name)}
    </span>
  )
}
