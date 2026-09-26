import { HiOutlineBuildingStorefront } from 'react-icons/hi2'
import { Link } from 'react-router-dom'

export function VendorAuthShell({
  title,
  subtitle,
  width = 'sm', // 'sm' (login: ~440px) | 'lg' (register: ~640px)
  children,
}) {
  const maxWidthClass = width === 'lg' ? 'max-w-2xl' : 'max-w-md'

  return (
    <div className="min-h-screen w-full bg-slate-50 font-sans text-slate-800 flex flex-col justify-between">
      {/* Clean Top Navigation Bar */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <Link to="/app/dashboard" className="flex items-center space-x-2.5 group">
          <div className="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-xs group-hover:bg-brand-700 transition-colors">
            <HiOutlineBuildingStorefront className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-base font-black tracking-tight text-slate-900 font-sans">KROZENDA</span>
              <span className="px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-md bg-brand-50 text-brand-700 border border-brand-200">
                SELLER
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium">Dropshipping Supplier Portal</p>
          </div>
        </Link>

        <Link
          to="/app/dashboard"
          className="text-xs font-semibold text-slate-600 hover:text-brand-600 transition-colors flex items-center space-x-1"
        >
          <span>Marketplace</span>
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </header>

      {/* Main Centered Form Container */}
      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 my-auto flex items-center justify-center">
        <div className={`w-full ${maxWidthClass}`}>
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-5">
            {/* Header */}
            <div className="border-b border-slate-100 pb-4 text-center sm:text-left">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
              {subtitle && <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>}
            </div>

            {/* Form Slot */}
            <div>{children}</div>
          </div>
        </div>
      </main>

      {/* Clean Bottom Footer */}
      <footer className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-slate-200/60">
        <p>&copy; {new Date().getFullYear()} Krozenda E-Commerce. All rights reserved.</p>
        <div className="flex items-center space-x-4 text-slate-500">
          <Link to="/app/terms" className="hover:text-slate-700 transition-colors">
            Terms of Service
          </Link>
          <Link to="/app/privacy" className="hover:text-slate-700 transition-colors">
            Privacy Policy
          </Link>
          <Link to="/seller/login" className="hover:text-slate-700 transition-colors">
            Seller Support
          </Link>
        </div>
      </footer>
    </div>
  )
}
