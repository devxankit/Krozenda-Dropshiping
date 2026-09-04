const SIZE_CLASSES = Object.freeze({
  xs: 'h-6 w-6 text-2xs',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
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
  const base = `inline-flex shrink-0 items-center justify-center overflow-hidden font-semibold ${SIZE_CLASSES[size]} ${SHAPE_CLASSES[shape]} ${className}`

  if (src) {
    return <img src={src} alt={name} className={`${base} object-cover`} />
  }

  const toneClass =
    tone === 'inverted'
      ? 'bg-surface-inverted text-white'
      : 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100'

  return (
    <span className={`${base} ${toneClass}`} aria-hidden="true" title={name || undefined}>
      {initials(name)}
    </span>
  )
}
