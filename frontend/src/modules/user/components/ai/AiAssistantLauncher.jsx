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
          // Sits ABOVE the mobile bottom navbar rather than inside it: the
          // navbar is `md:hidden fixed bottom-0` and roughly 60px tall, so
          // bottom-[76px] clears it with room to spare, and the md breakpoint
          // drops the button back down once the navbar is gone. z-40 keeps it
          // under the navbar's z-50 and well under the chat panel's z-60.
          className="group fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 shadow-[0_8px_24px_-6px_rgba(37,99,235,0.6)] ring-1 ring-white/50 transition-all duration-200 hover:scale-105 hover:shadow-[0_10px_28px_-6px_rgba(37,99,235,0.7)] active:scale-95 md:bottom-6 md:right-6"
        >
          {/* Soft halo — decorative only, so it must not swallow the tap. */}
          <span className="pointer-events-none absolute inset-0 animate-pulse-glow rounded-full bg-blue-500/30" />

          {/* Top-edge sheen. Without it a flat gradient circle reads as a
              sticker; this is what makes it look like a raised object. */}
          <span className="pointer-events-none absolute inset-x-2 top-1 h-4 rounded-full bg-white/25 blur-[6px]" />

          <AiSparkIcon className="relative h-7 w-7 text-white drop-shadow-sm" accent="#FBBF24" />

          {/* Badge sits ON the rim rather than floating clear of it, so the
              button still reads as one object. */}
          <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-1.5 py-[1px] text-[9px] font-black leading-[1.35] tracking-wide text-slate-900 shadow-sm ring-2 ring-white">
            AI
          </span>
        </button>
      )}

      {isOpen && <AiChatPanel assistant={assistant} onClose={() => setIsOpen(false)} />}
    </>
  )
}

export default AiAssistantLauncher
