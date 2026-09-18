import { HiOutlineBuildingStorefront } from 'react-icons/hi2'

// The dark card every unauthenticated vendor screen sits in — sign-in,
// password reset and sign-up. Extracted from VendorLoginPage so the sign-up
// flow cannot drift from the sign-in flow visually; `width` is the only thing
// the two genuinely disagree about, since a registration form needs more than
// one column and a login form does not.
const WIDTHS = Object.freeze({
  sm: 'max-w-md',
  lg: 'max-w-2xl',
})

export function VendorAuthShell({ title, subtitle, width = 'sm', children }) {
  return (
    <div className="vendor-auth min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 sm:p-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-brand-900/30 via-slate-950 to-slate-950 pointer-events-none" />

      <div
        className={`relative w-full ${WIDTHS[width]} rounded-2xl border border-slate-800 bg-slate-900/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl`}
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 font-bold text-white text-xl shadow-lg shadow-brand-600/30">
            <HiOutlineBuildingStorefront className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-white tracking-tight">{title}</h1>
          <p className="mt-1.5 text-xs text-slate-400 max-w-xs">{subtitle}</p>
        </div>

        {children}
      </div>
    </div>
  )
}
