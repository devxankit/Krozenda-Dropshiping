import { Link } from 'react-router-dom'
import { Badge } from '../../../../components/ui'
import { formatMoney } from '../../lib/format'

// The small, repeated pieces every table and detail screen is assembled from.
// They exist so a rupee amount, a date and a status look identical on all 89
// screens without any of them remembering how.

// ---- money ---------------------------------------------------------------
export function MoneyCell({ amount, compact = false, muted = false, className = '' }) {
  return (
    <span
      className={`tabular font-semibold ${muted ? 'text-ink-subtle' : 'text-slate-900'} ${className}`}
    >
      {formatMoney(amount, { compact })}
    </span>
  )
}

// ---- date ----------------------------------------------------------------
export function DateCell({ value, withTime = true, className = '' }) {
  const date = new Date(value)
  const day = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <span className={`whitespace-nowrap text-ink-muted ${className}`}>
      {day}
      {withTime && <span className="tabular text-ink-faint">, {time}</span>}
    </span>
  )
}

// ---- status --------------------------------------------------------------
// Tone and label both come from a map in constants.js. A screen never decides
// what colour a status is.
export function StatusPill({ status, labels = {}, tones = {}, size = 'md' }) {
  return (
    <Badge tone={(tones && tones[status]) || 'neutral'} size={size} dot>
      {(labels && labels[status]) || status}
    </Badge>
  )
}

// ---- identity ------------------------------------------------------------
export function IdCell({ id, to, className = '' }) {
  const content = <span className={`tabular font-semibold ${className}`}>{id}</span>
  if (!to) return <span className="text-slate-900">{content}</span>
  return (
    <Link to={to} className="text-brand-700 transition-colors hover:text-brand-600">
      {content}
    </Link>
  )
}

export function PrimaryCell({ title, subtitle, to }) {
  const heading = <span className="block truncate font-medium text-slate-900">{title}</span>
  return (
    <span className="block min-w-0">
      {to ? (
        <Link to={to} className="block truncate font-medium text-slate-900 hover:text-brand-700">
          {title}
        </Link>
      ) : (
        heading
      )}
      {subtitle && <span className="block truncate text-2xs text-ink-faint">{subtitle}</span>}
    </span>
  )
}
