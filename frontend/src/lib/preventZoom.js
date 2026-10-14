// Disables user-side zooming (pinch-to-zoom, iOS Safari gestures, Ctrl+wheel,
// keyboard zoom shortcuts) — but ONLY on touch / phone devices.
//
// Desktop browsers keep zoom fully enabled so users can zoom in/out normally.
// "Mobile" here means a touch-primary device with no hover-capable pointer:
// phones and tablets, including the site running inside the native Flutter app
// WebView on a phone. Desktops and laptops — even touch-enabled ones, which
// still expose a hover-capable mouse/trackpad — are treated as desktop and keep
// zoom. We deliberately key off pointer/hover rather than screen width so that
// a desktop user with a narrow browser window still keeps zoom.
function isTouchDevice() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(hover: none) and (pointer: coarse)').matches ?? false
}

// index.html pins the page with `maximum-scale=1.0, user-scalable=no`, which
// kills pinch-zoom on every device. On desktop we rewrite the viewport tag so
// browser/trackpad zoom is allowed again. (Desktop keyboard and Ctrl+wheel zoom
// are governed by the listeners below — which we skip on desktop — not by this
// tag, but relaxing it also restores pinch-zoom on desktop touchscreens.)
function allowViewportZoom() {
  const meta = document.querySelector('meta[name="viewport"]')
  if (!meta) return
  meta.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover')
}

export function initPreventZoom() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  // Desktop / non-touch: leave browser zoom fully enabled and bail out before
  // attaching any of the zoom-blocking listeners below.
  if (!isTouchDevice()) {
    allowViewportZoom()
    return
  }

  // ── Touch devices (phones, tablets, native app WebView): block zoom ──────────

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
