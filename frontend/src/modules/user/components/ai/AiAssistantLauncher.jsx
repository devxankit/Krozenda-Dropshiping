import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { HiOutlineSparkles } from 'react-icons/hi2'
import { useAuthStore } from '../../../../lib/authStore'
import { AUTH_ROUTES } from '../../../../config/routes'
import { useAiAssistantController } from '../../controllers/useAiAssistantController'
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
          className="group fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-600/30 ring-1 ring-white/40 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-blue-600/40 active:scale-95 md:bottom-6 md:right-6"
        >
          {/* Soft halo — decorative only, so it must not swallow the tap. */}
          <span className="pointer-events-none absolute inset-0 animate-pulse-glow rounded-full bg-blue-500/30" />

          <HiOutlineSparkles className="relative h-6 w-6 text-white" />

          <span className="absolute -right-0.5 -top-0.5 rounded-full border-2 border-white bg-amber-400 px-1.5 py-px text-[9px] font-black leading-tight tracking-tight text-slate-900 shadow-2xs">
            AI
          </span>
        </button>
      )}

      {isOpen && <AiChatPanel assistant={assistant} onClose={() => setIsOpen(false)} />}
    </>
  )
}

export default AiAssistantLauncher
