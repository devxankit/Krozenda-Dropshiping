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

export const DEFAULT_PRODUCT_IMAGE = '/images/default-product.png'

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
  fallbackSrc = DEFAULT_PRODUCT_IMAGE,
  onClick,
}) {
  // If no primary src is provided, use fallbackSrc directly.
  const resolvedInitialSrc = src || fallbackSrc || null
  const initialIsFallback = !src && !!fallbackSrc

  const [currentSrc, setCurrentSrc] = useState(resolvedInitialSrc)
  const [isFallback, setIsFallback] = useState(initialIsFallback)
  const [status, setStatus] = useState(resolvedInitialSrc ? 'loading' : 'empty')
  const [statusSrc, setStatusSrc] = useState(src)

  if (statusSrc !== src) {
    setStatusSrc(src)
    const nextFallback = !src && !!fallbackSrc
    setIsFallback(nextFallback)
    setCurrentSrc(src || fallbackSrc || null)
    setStatus(src || fallbackSrc ? 'loading' : 'empty')
  }

  const showPlaceholder = status === 'error' || (status === 'empty' && !currentSrc)

  const handleImgError = () => {
    if (!isFallback && fallbackSrc) {
      setIsFallback(true)
      setCurrentSrc(fallbackSrc)
      setStatus('loading')
    } else {
      setStatus('error')
    }
  }

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

      {showPlaceholder ? (
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
      ) : currentSrc ? (
        <img
          src={currentSrc}
          {...(!isFallback && srcSet ? { srcSet, sizes } : {})}
          alt={alt || 'Product'}
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
          //
          // react/no-unknown-property disagrees, but its list is not version
          // gated and this config already declares React 18.3. Verified by
          // rendering to static markup: lowercase emits fetchpriority="high"
          // with no warning, camelCase emits nothing. The runtime wins.
          // eslint-disable-next-line react/no-unknown-property
          fetchpriority={priority ? 'high' : 'auto'}
          decoding={priority ? 'sync' : 'async'}
          onLoad={() => setStatus('loaded')}
          onError={handleImgError}
          className={`absolute inset-0 h-full w-full transition-opacity duration-200 ${
            isFallback
              ? 'object-contain p-2'
              : fit === 'cover'
                ? 'object-cover'
                : 'object-contain'
          } ${status === 'loaded' ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
        />
      ) : null}
    </div>
  )
}
