import { useEffect, useMemo, useState } from 'react'
import { HiCheck, HiMagnifyingGlass, HiXMark } from 'react-icons/hi2'

// Filter panel shared by the listing screen (sidebar on desktop) and the
// mobile filter sheet.
//
// It holds DRAFT state and only lifts it on "Apply". That is deliberate
// (§29): applying on every checkbox tick fired one API request per click, so
// selecting four brands cost four round trips and three throwaway renders —
// painful on a phone, and worse inside a WebView. The desktop sidebar applies
// immediately only for the cheap single-value controls (sort, in-stock),
// where a round trip per interaction is the expected behaviour anyway.

const RATING_OPTIONS = [
  { label: '4★ & above', value: 4 },
  { label: '3★ & above', value: 3 },
  { label: '2★ & above', value: 2 },
]

const DISCOUNT_OPTIONS = [
  { label: '50% or more', value: 50 },
  { label: '30% or more', value: 30 },
  { label: '10% or more', value: 10 },
]

const PRICE_CEILING = 200000

const SOURCE_OPTIONS = [
  { label: 'All products', value: 'all' },
  { label: 'Dropship only', value: 'dropship' },
  { label: 'Regular stock only', value: 'normal' },
]

export function CatalogFilterPanel({
  params,
  brands,
  categories,
  onApply,
  onClear,
  onClose,
  showCategories = true,
}) {
  const [brandQuery, setBrandQuery] = useState('')

  const applied = useMemo(
    () => ({
      category: params.category,
      brands: params.brands,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      rating: params.rating,
      inStock: params.inStock,
      minDiscount: params.minDiscount,
      source: params.source,
    }),
    [params],
  )

  // A stable signature of what is currently applied, so the draft can be
  // re-synced when the URL changes underneath us (Back button, a link, or
  // "Clear all" pressed from the results header while the sheet is open)
  // without comparing object identity, which changes on every render.
  const appliedSignature = JSON.stringify(applied)

  // Render-phase adjustment rather than an effect: React re-renders with the
  // new draft before committing, so the panel never paints one frame of stale
  // selections.
  const [draft, setDraft] = useState(applied)
  const [draftSignature, setDraftSignature] = useState(appliedSignature)
  if (draftSignature !== appliedSignature) {
    setDraftSignature(appliedSignature)
    setDraft(applied)
  }

  const patch = (next) => setDraft((prev) => ({ ...prev, ...next }))

  const toggleBrand = (brandId) =>
    patch({
      brands: draft.brands.includes(brandId)
        ? draft.brands.filter((b) => b !== brandId)
        : [...draft.brands, brandId],
    })

  const filteredBrands = brands.filter((b) =>
    b.name.toLowerCase().includes(brandQuery.trim().toLowerCase()),
  )

  // min > max is a range that can match nothing. Caught here so the user is
  // told, instead of applying it and showing an unexplained empty result.
  const priceRangeInvalid =
    draft.minPrice != null && draft.maxPrice != null && draft.minPrice > draft.maxPrice

  const handleApply = () => {
    if (priceRangeInvalid) return
    onApply(draft)
    onClose?.()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain p-4">
        {showCategories && categories.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-xs font-black uppercase tracking-wide text-slate-500">
              Category
            </legend>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => patch({ category: '' })}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                  !draft.category ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>All categories</span>
                {!draft.category && <HiCheck className="h-4 w-4" aria-hidden="true" />}
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => patch({ category: category.id })}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                    draft.category === category.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{category.name}</span>
                  {draft.category === category.id && (
                    <HiCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {brands.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-xs font-black uppercase tracking-wide text-slate-500">
              Brand
            </legend>
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <HiMagnifyingGlass className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={brandQuery}
                onChange={(e) => setBrandQuery(e.target.value)}
                placeholder="Search brands"
                aria-label="Search brands"
                className="w-full bg-transparent px-2 text-xs font-semibold text-slate-900 focus:outline-none"
              />
            </div>
            {/* Capped height with its own scroll and overscroll-contain, so a
                long brand list does not turn the page into a nested-scroll
                trap inside the WebView. */}
            <div className="max-h-52 space-y-0.5 overflow-y-auto overscroll-contain pr-1">
              {filteredBrands.length === 0 ? (
                <p className="px-1 py-2 text-xs text-slate-400">No brands match “{brandQuery}”.</p>
              ) : (
                filteredBrands.map((brand) => {
                  const checked = draft.brands.includes(brand.id)
                  return (
                    <label
                      key={brand.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1 py-2 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleBrand(brand.id)}
                        className="h-4 w-4 shrink-0 accent-blue-600"
                      />
                      <span className="truncate text-xs font-semibold text-slate-700">
                        {brand.name}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </fieldset>
        )}

        <fieldset className="space-y-2">
          <legend className="text-xs font-black uppercase tracking-wide text-slate-500">
            Price
          </legend>
          <div className="flex items-center gap-2">
            <label className="flex-1">
              <span className="sr-only">Minimum price</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={PRICE_CEILING}
                value={draft.minPrice ?? ''}
                onChange={(e) =>
                  patch({ minPrice: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })
                }
                placeholder="Min"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
            <span className="text-xs text-slate-400" aria-hidden="true">
              to
            </span>
            <label className="flex-1">
              <span className="sr-only">Maximum price</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={PRICE_CEILING}
                value={draft.maxPrice ?? ''}
                onChange={(e) =>
                  patch({ maxPrice: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })
                }
                placeholder="Max"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </label>
          </div>
          {priceRangeInvalid && (
            <p role="alert" className="text-[11px] font-semibold text-red-600">
              Minimum price cannot be higher than the maximum.
            </p>
          )}
        </fieldset>

        <fieldset className="space-y-1">
          <legend className="text-xs font-black uppercase tracking-wide text-slate-500">
            Customer rating
          </legend>
          {RATING_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => patch({ rating: draft.rating === option.value ? null : option.value })}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                draft.rating === option.value
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{option.label}</span>
              {draft.rating === option.value && <HiCheck className="h-4 w-4" aria-hidden="true" />}
            </button>
          ))}
        </fieldset>

        <fieldset className="space-y-1">
          <legend className="text-xs font-black uppercase tracking-wide text-slate-500">
            Discount
          </legend>
          {DISCOUNT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                patch({ minDiscount: draft.minDiscount === option.value ? null : option.value })
              }
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                draft.minDiscount === option.value
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{option.label}</span>
              {draft.minDiscount === option.value && (
                <HiCheck className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          ))}
        </fieldset>

        <fieldset className="space-y-1">
          <legend className="text-xs font-black uppercase tracking-wide text-slate-500">
            Product type
          </legend>
          {SOURCE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => patch({ source: option.value })}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                draft.source === option.value
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{option.label}</span>
              {draft.source === option.value && <HiCheck className="h-4 w-4" aria-hidden="true" />}
            </button>
          ))}
        </fieldset>

        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-3 py-3">
          <span className="text-xs font-bold text-slate-800">In stock only</span>
          <input
            type="checkbox"
            checked={draft.inStock}
            onChange={(e) => patch({ inStock: e.target.checked })}
            className="h-4 w-4 accent-blue-600"
          />
        </label>
      </div>

      {/* Sticky action bar, padded for the home indicator so "Apply" is never
          under the gesture bar on an iPhone inside the WebView. */}
      <div className="sticky bottom-0 flex items-center gap-2 border-t border-slate-200 bg-white p-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
        <button
          type="button"
          onClick={() => {
            onClear()
            onClose?.()
          }}
          className="flex-1 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          Clear all
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={priceRangeInvalid}
          className="flex-1 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Apply filters
        </button>
      </div>
    </div>
  )
}

// Mobile bottom sheet wrapper.
//
// Escape closes it, the backdrop closes it, focus is moved inside on open and
// body scroll is locked while it is up — and, critically, the lock is released
// in the effect's cleanup so closing the sheet can never leave the page
// permanently unscrollable (§118).
export function FilterSheet({ open, onClose, children, title = 'Filters' }) {
  useEffect(() => {
    if (!open) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-slate-900/40"
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-black text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <HiXMark className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
