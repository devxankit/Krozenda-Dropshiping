import { useNetworkStatus } from '../../lib/useNetworkStatus'

// Connectivity notice.
//
// Deliberately NOT a permanently reserved strip at the top of the layout
// (§131): it is fixed-positioned and only occupies space while it has
// something to say, so the page below never shifts when it appears or goes
// away. It also sits above the safe-area inset so it is not tucked under a
// notch or the Android status bar inside the WebView.
export function NetworkBanner() {
  const { isOnline, justReconnected } = useNetworkStatus()

  if (isOnline && !justReconnected) return null

  const offline = !isOnline

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center px-3 pt-[calc(env(safe-area-inset-top,0px)+8px)]"
    >
      <div
        className={`pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold shadow-lg transition-opacity ${
          offline ? 'bg-slate-900 text-white' : 'bg-emerald-600 text-white'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${offline ? 'bg-amber-400' : 'bg-white'}`}
          aria-hidden="true"
        />
        <span>
          {offline
            ? "You're offline. Please check your internet connection."
            : 'Back online.'}
        </span>
      </div>
    </div>
  )
}
