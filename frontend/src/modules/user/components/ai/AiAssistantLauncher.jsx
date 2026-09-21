import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../../../lib/authStore'
import { AUTH_ROUTES } from '../../../../config/routes'
import { useAiAssistantController } from '../../controllers/useAiAssistantController'
import { AiSparkIcon } from './AiSparkIcon'
import { AiChatPanel } from './AiChatPanel'

/**
 * The floating AI entry point, mounted once for the whole customer app (see
 * modules/user/routes.jsx) so it survives navigation between screens and stays
 * put while a screen scrolls.
 *
 * Shown to signed-out visitors too. Half the customer app (dashboard, catalog,
 * product pages) is public, so hiding the button there makes the feature look
 * broken rather than gated. Everything it can answer is account data, so a
 * guest who taps it is sent to sign in and returned here afterwards — the same
 * redirect ProtectedRoute performs.
 */
export function AiAssistantLauncher() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const navigate = useNavigate()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  // Tracks whether the assistant has ever been opened this session, purely to
  // keep the history request off the critical path for customers who never
  // touch it.
  const [hasOpened, setHasOpened] = useState(false)

  // Owned here rather than inside the panel so an in-progress conversation
  // survives closing and reopening the sheet — the panel unmounts, this does
  // not. Gated on `isAuthenticated` as well, so a guest never fires a history
  // request that could only come back 401.
  const assistant = useAiAssistantController({ historyEnabled: hasOpened && isAuthenticated })

  const open = () => {
    if (!isAuthenticated) {
      navigate(AUTH_ROUTES.LOGIN, { state: { from: location } })
      return
    }
    setHasOpened(true)
    setIsOpen(true)
  }

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={open}
          aria-label="Open AI Assistant"
          className="group fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-indigo-600 to-blue-700 p-0.5 shadow-[0_8px_24px_-4px_rgba(37,99,235,0.65)] ring-2 ring-white/90 transition-all duration-300 hover:scale-110 hover:shadow-[0_12px_32px_-4px_rgba(37,99,235,0.85)] active:scale-95 md:bottom-6 md:right-6"
        >
          {/* Ambient pulse halo */}
          <span className="pointer-events-none absolute -inset-1 animate-pulse rounded-full bg-blue-400/40 blur-sm" />

          {/* 3D AI Assistant Avatar Container */}
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-900">
            <img
              src="/images/ai_assistant_avatar.jpg"
              alt="AI Assistant"
              className="h-full w-full object-cover scale-[1.14] transition-transform duration-300 group-hover:scale-125"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const fallback = e.currentTarget.parentElement?.querySelector('.ai-fallback-icon')
                if (fallback) fallback.classList.remove('hidden')
              }}
            />
            <div className="ai-fallback-icon hidden flex items-center justify-center">
              <AiSparkIcon className="h-7 w-7 text-white drop-shadow-sm" accent="#38BDF8" />
            </div>
          </div>

          {/* Gold AI Badge */}
          <span className="absolute -right-1 -top-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-1.5 py-[1px] text-[9px] font-black leading-[1.35] tracking-wide text-slate-900 shadow-sm ring-2 ring-white">
            AI
          </span>
        </button>
      )}

      {isOpen && <AiChatPanel assistant={assistant} onClose={() => setIsOpen(false)} />}
    </>
  )
}

export default AiAssistantLauncher
