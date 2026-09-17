import { useEffect, useState } from 'react'

// Is the on-screen keyboard up?
//
// This exists because of what a fixed bottom bar does when a keyboard opens.
// Android WebViews resize the viewport, so `position: fixed; bottom: 0` is
// dragged up to sit on top of the keyboard; iOS leaves the layout viewport
// alone and the bar hides behind it instead. Either way the bar moves, which
// is the "hilna" a fixed element is supposed to prevent.
//
// The fix is not more CSS — it is to take the bar out of the way while typing,
// which is what a native app does too. Nothing on a bottom nav is useful
// mid-keystroke.
//
// visualViewport is the only API that reports the keyboard honestly. Where it
// is missing (older WebViews) this returns false, and the bar simply behaves
// as it did before.
const KEYBOARD_THRESHOLD_PX = 150

export function useKeyboardOpen() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return undefined

    const check = () => {
      // The gap between the layout viewport and what is actually visible. A
      // keyboard takes hundreds of pixels; the URL bar collapsing takes far
      // less, and the threshold is what keeps the two apart — the bar must not
      // disappear just because someone scrolled.
      const hidden = window.innerHeight - vv.height
      setIsOpen(hidden > KEYBOARD_THRESHOLD_PX)
    }

    check()
    vv.addEventListener('resize', check)
    return () => vv.removeEventListener('resize', check)
  }, [])

  return isOpen
}
