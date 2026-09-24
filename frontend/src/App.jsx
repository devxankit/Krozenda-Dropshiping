import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster, ToastBar, toast as hotToast } from 'react-hot-toast'
import { HiXMark } from 'react-icons/hi2'
import { queryClient } from './lib/queryClient'
import { AppRoutes } from './routes'
import { ScrollToTop } from './components/common/ScrollToTop'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ScrollToTop />
        <AppRoutes />
        <Toaster
          position="top-right"
          reverseOrder={false}
          gutter={10}
          containerStyle={{
            top: 20,
            right: 20,
            zIndex: 999999,
          }}
          toastOptions={{
            duration: 4000,
            style: {
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              padding: '12px 16px',
              borderRadius: '16px',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)',
              maxWidth: '420px',
            },
            success: {
              duration: 3500,
              iconTheme: {
                primary: '#10b981',
                secondary: '#ffffff',
              },
            },
            error: {
              duration: 5500,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#ffffff',
              },
            },
          }}
        >
          {/* Every toast gets a close button in its top-right corner, so a
              message can be dismissed instead of waited out. A loading toast
              has none: it closes itself when its work finishes. */}
          {(t) => (
            <ToastBar toast={t} style={{ ...t.style, position: 'relative', paddingRight: t.type === 'loading' ? undefined : 36 }}>
              {({ icon, message }) => (
                <>
                  {icon}
                  {message}
                  {t.type !== 'loading' && (
                    <button
                      type="button"
                      onClick={() => hotToast.dismiss(t.id)}
                      aria-label="Close notification"
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                      <HiXMark className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </>
              )}
            </ToastBar>
          )}
        </Toaster>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
