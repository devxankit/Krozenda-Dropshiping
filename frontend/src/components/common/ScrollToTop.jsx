import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * ScrollToTop
 * 
 * Ensures that every page transition and query parameter change (such as switching
 * categories, sorting, or navigating between tabs) starts from absolute top (0, 0).
 *
 * It resets scroll on:
 * - window
 * - document.documentElement
 * - document.body
 * - #root container
 *
 * Uses useLayoutEffect + requestAnimationFrame + setTimeout fallback to reliably
 * override browser scroll restoration and async component render reflows.
 */
export function ScrollToTop() {
  const { pathname, search } = useLocation()

  useLayoutEffect(() => {
    // Disable automatic browser scroll restoration to prevent landing mid-page
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }

    const resetScroll = () => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      } catch {
        window.scrollTo(0, 0)
      }

      if (document.documentElement) {
        document.documentElement.scrollTop = 0
        document.documentElement.scrollLeft = 0
      }

      if (document.body) {
        document.body.scrollTop = 0
        document.body.scrollLeft = 0
      }

      const root = document.getElementById('root')
      if (root) {
        root.scrollTop = 0
        root.scrollLeft = 0
      }
    }

    // 1. Immediate reset before paint
    resetScroll()

    // 2. Catch post-render DOM insertion & layout shifts
    const rafId = requestAnimationFrame(() => {
      resetScroll()
    })

    // 3. Fallback for async chunks or images that might shift layout
    const timerId = setTimeout(() => {
      resetScroll()
    }, 40)

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(timerId)
    }
  }, [pathname, search])

  return null
}
export default ScrollToTop
