import { Icon } from '../../../../components/ui'

// SVG `fill` and `stroke` are attributes, not CSS — a Tailwind class cannot
// reach them. These mirror the `slate-800` and `brand-900` tokens and are the
// only place in the module that names a colour directly.
const RULE = '#1e293b'
const ACCENT_RULE = '#1e3a8a'

const PLATFORM_STATS = Object.freeze([
  { value: '318', label: 'Active sellers' },
  { value: '1,04,220', label: 'Live SKUs' },
  { value: '₹1.24 Cr', label: 'GMV this month' },
])

// The brand panel is drawn, not photographed: concentric rings over a dot
// field, so there is no image asset to swap when the client's real brand
// arrives — only tokens.
function BrandPanel() {
  return (
    <div className="relative hidden shrink-0 flex-col justify-between overflow-hidden bg-surface-inverted p-12 text-white lg:flex lg:w-[46%]">
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-50"
        aria-hidden="true"
      >
        <defs>
          <pattern id="admin-auth-dots" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.5" fill={RULE} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#admin-auth-dots)" />
        <circle cx="88%" cy="16%" r="230" fill="none" stroke={RULE} strokeWidth="1" />
        <circle cx="88%" cy="16%" r="160" fill="none" stroke={RULE} strokeWidth="1" />
        <circle cx="88%" cy="16%" r="95" fill="none" stroke={ACCENT_RULE} strokeWidth="1" />
      </svg>

      <div className="relative flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-base font-bold">
          K
        </span>
        <span className="text-base font-bold tracking-tight">Krozenda</span>
        <span className="rounded-sm bg-slate-800 px-1.5 py-1 text-2xs font-semibold tracking-widest text-ink-faint">
          ADMIN
        </span>
      </div>

      <div className="relative">
        <h2 className="max-w-[15ch] text-[2.4rem] font-bold leading-[1.15] tracking-tight text-balance">
          One panel. Three business models.
        </h2>
        <p className="mt-4 max-w-[44ch] text-sm leading-relaxed text-ink-faint">
          Marketplace, direct dropshipping and own stock — one catalog, one settlement engine,
          governed from a single console.
        </p>

        <dl className="mt-10 flex border-t border-slate-800">
          {PLATFORM_STATS.map((stat, index) => (
            <div
              key={stat.label}
              className={`flex-1 pt-5 ${index > 0 ? 'border-l border-slate-800 pl-5' : 'pr-5'}`}
            >
              <dd className="tabular text-xl font-bold tracking-tight">{stat.value}</dd>
              <dt className="mt-1 text-xs text-ink-subtle">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>

      <p className="relative flex items-center gap-2 text-xs text-ink-subtle">
        <Icon name="lock" className="h-3.5 w-3.5" />
        Two-factor authentication required · every privileged action is logged
      </p>
    </div>
  )
}

export function AuthShell({ title, description, children, footer, aside }) {
  return (
    <div className="admin-root flex min-h-screen bg-surface">
      <BrandPanel />

      <div className="flex flex-1 flex-col justify-between py-12">
        <div className="flex justify-end px-12">{aside}</div>

        <div className="mx-auto flex w-full max-w-[23.75rem] flex-col gap-6 px-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            {description && (
              <p className="mt-2 text-sm leading-relaxed text-ink-subtle">{description}</p>
            )}
          </div>
          {children}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-12 text-2xs text-ink-faint">
          <span>© {new Date(Date.now()).getFullYear()} Krozenda · Operated by Appzeto</span>
          {footer}
        </div>
      </div>
    </div>
  )
}
