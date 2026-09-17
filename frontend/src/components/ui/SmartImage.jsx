import { useState } from 'react'

// One image component for the whole buyer app, because every product image,
// banner, avatar and review photo needs the same six things and none of the
// screens were doing all six:
//
//   1. A fixed aspect-ratio box, so the page does not reflow when the image
//      arrives (this is the main source of layout shift on the listing grid).
//   2. A placeholder while loading, instead of a flash of empty box.
//   3. A real fallback when the URL is broken or missing — a broken <img>
//      collapses to its alt text and drags the card's layout with it.
//   4. srcset/sizes, so a 400px tile downloads the 400px derivative the
//      backend generates rather than the 1000px canonical file.
//   5. Explicit loading/decoding hints, eager only for the LCP image.
//   6. An alt text that is actually required at the call site.
//
// `ratio` is a plain CSS aspect-ratio string. Tailwind's aspect-* utilities
// are avoided here so an arbitrary ratio does not need a safelist entry.

const PLACEHOLDER_ICON = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="w-8 h-8 text-slate-300">
    <path
      d="M3 16.5 8.25 11.25a2 2 0 0 1 2.83 0L15 15m-1.5-1.5 1.69-1.69a2 2 0 0 1 2.82 0L21 15M4.5 4.5h15a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V6a1.5 1.5 0 0 1 1.5-1.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export function SmartImage({
  src,
  srcSet = null,
  // What share of the viewport this image occupies at each breakpoint. Without
  // it the browser assumes 100vw and picks the largest candidate in the
  // srcset, which defeats the whole point of having one.
  sizes = '(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 45vw',
  alt,
  ratio = '1 / 1',
  fit = 'contain',
  className = '',
  imgClassName = '',
  // The one image above the fold (hero banner, product detail main image)
  // should NOT be lazy — lazy-loading the LCP element delays it by a round
  // trip for no benefit.
  priority = false,
  onClick,
}) {
  // A card recycled to a different product (a new page of results, a
  // carousel) must reset its load state, or it keeps the previous image's
  // error and shows a fallback over a perfectly good URL.
  //
  // Done as a render-phase adjustment rather than an effect: React re-runs
  // this component immediately with the new state, before anything is
  // committed to the DOM, so there is no flash of the stale image and no extra
  // paint. (This is React's documented "adjusting state when a prop changes".)
  const [status, setStatus] = useState(src ? 'loading' : 'empty')
  const [statusSrc, setStatusSrc] = useState(src)
  if (statusSrc !== src) {
    setStatusSrc(src)
    setStatus(src ? 'loading' : 'empty')
  }

  const showFallback = status === 'error' || status === 'empty'

  return (
    <div
      className={`relative overflow-hidden bg-slate-50 ${className}`}
      // Reserving the box before the image loads is what keeps CLS at zero.
      style={{ aspectRatio: ratio }}
      onClick={onClick}
    >
      {status === 'loading' && (
        <div className="absolute inset-0 animate-pulse bg-slate-100" aria-hidden="true" />
      )}

      {showFallback ? (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-50 text-slate-400"
          // The alt text is already on the <img> path; here the box is
          // decorative and the surrounding card carries the product name.
          role="img"
          aria-label={alt || 'Image unavailable'}
        >
          {PLACEHOLDER_ICON}
          <span className="text-[9px] font-semibold uppercase tracking-wide">No image</span>
        </div>
      ) : (
        <img
          src={src}
          {...(srcSet ? { srcSet, sizes } : {})}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          // fetchpriority is the other half of "this is the LCP image"; without
          // it the browser still queues an eager image behind other requests.
          //
          // Spelled lowercase deliberately. React only learned the camelCase
          // `fetchPriority` in 19; on the 18.x this app runs, that spelling is
          // an unknown prop — React warns and drops it, so the attribute never
          // reaches the DOM and the hint does nothing. Lowercase passes
          // straight through as a plain attribute, which is what the browser
          // reads anyway.
          fetchpriority={priority ? 'high' : 'auto'}
          decoding={priority ? 'sync' : 'async'}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          className={`absolute inset-0 h-full w-full transition-opacity duration-200 ${
            fit === 'cover' ? 'object-cover' : 'object-contain'
          } ${status === 'loaded' ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
        />
      )}
    </div>
  )
}
