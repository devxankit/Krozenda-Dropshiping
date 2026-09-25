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
// Two signals, because neither is enough alone:
//
// 1. Focus. A text field gaining focus on a touch device is the earliest
//    possible sign — it fires BEFORE the keyboard animates in, so the bar is
//    gone before the viewport shrinks and never gets a frame riding on top.
//
// 2. Viewport height against the tallest height seen. The old check compared
//    innerHeight with visualViewport.height, but on Android (Chrome and
//    WebView with adjustResize) the keyboard shrinks BOTH by the same amount,
//    the gap stays ~0 and the keyboard was never detected. Comparing against a
//    remembered full height catches that case, and also notices the keyboard
//    being dismissed with the back button while the field keeps focus.
const KEYBOARD_THRESHOLD_PX = 150

const NON_TEXT_INPUT_TYPES = new Set([
  'button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit',
])

function isTextEntry(el) {
  if (!el || el === document.body) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'TEXTAREA') return !el.readOnly && !el.disabled
  if (tag === 'INPUT') {
    return !NON_TEXT_INPUT_TYPES.has((el.type || 'text').toLowerCase()) && !el.readOnly && !el.disabled
  }
  return false
}

function currentHeight() {
  const vv = window.visualViewport
  return vv ? Math.min(window.innerHeight, vv.height) : window.innerHeight
}

export function useKeyboardOpen() {
  // A screen that mounts with a field already focused (autofocus, or the bar
  // remounting on navigation mid-typing) starts hidden.
  const [isOpen, setIsOpen] = useState(
    () =>
      typeof document !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches ?? false) &&
      isTextEntry(document.activeElement),
  )

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    // A mouse-and-keyboard device has no on-screen keyboard to dodge.
    const touch = window.matchMedia?.('(pointer: coarse)').matches ?? false
    if (!touch) return undefined

    let fullHeight = currentHeight()
    let shrunk = false
    let blurTimer = 0

    const onFocusIn = (e) => {
      if (isTextEntry(e.target)) setIsOpen(true)
    }

    const onFocusOut = () => {
      // Moving from one field to the next fires focusout then focusin; wait a
      // tick so the bar does not flash back in between.
      clearTimeout(blurTimer)
      blurTimer = setTimeout(() => {
        if (!isTextEntry(document.activeElement)) {
          shrunk = false
          setIsOpen(false)
        }
      }, 50)
    }

    const onResize = () => {
      const h = currentHeight()
      if (h > fullHeight) fullHeight = h
      if (fullHeight - h > KEYBOARD_THRESHOLD_PX) {
        shrunk = true
        setIsOpen(true)
      } else if (shrunk) {
        // Keyboard went away (e.g. Android back button) with focus still in
        // the field — bring the bar back.
        shrunk = false
        setIsOpen(false)
      }
    }

    const onOrientation = () => {
      // Portrait and landscape have different full heights; relearn it.
      setTimeout(() => {
        fullHeight = currentHeight()
        onResize()
      }, 300)
    }

    const vv = window.visualViewport
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    window.addEventListener('resize', onResize)
    vv?.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onOrientation)
    return () => {
      clearTimeout(blurTimer)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      window.removeEventListener('resize', onResize)
      vv?.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onOrientation)
    }
  }, [])

  return isOpen
}
