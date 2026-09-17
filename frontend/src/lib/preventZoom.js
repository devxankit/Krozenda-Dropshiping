// Disables user-side zooming (pinch-to-zoom, iOS Safari gestures, Ctrl+wheel, keyboard zoom shortcuts)

export function initPreventZoom() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  // 1. Prevent gesture events (iOS Safari / WebKit pinch-to-zoom)
  const preventDefault = (e) => e.preventDefault()
  document.addEventListener('gesturestart', preventDefault)
  document.addEventListener('gesturechange', preventDefault)
  document.addEventListener('gestureend', preventDefault)

  // 2. Prevent multi-touch pinch zoom
  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault()
      }
    },
    { passive: false }
  )

  // 3. Prevent Ctrl + Mouse Wheel (and trackpad pinch-zoom on desktop)
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) {
        e.preventDefault()
      }
    },
    { passive: false }
  )

  // 4. Prevent keyboard zoom shortcuts (Ctrl/Cmd + '+', '-', '0', '=')
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (
        e.key === '+' ||
        e.key === '-' ||
        e.key === '=' ||
        e.key === '_' ||
        e.key === '0' ||
        e.code === 'NumpadAdd' ||
        e.code === 'NumpadSubtract' ||
        e.code === 'Equal' ||
        e.code === 'Minus' ||
        e.code === 'Digit0' ||
        e.code === 'Numpad0'
      ) {
        e.preventDefault()
      }
    }
  })
}
