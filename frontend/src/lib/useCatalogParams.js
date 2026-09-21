import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

// Catalog filter/sort/page state, held in the URL rather than in component
// state.
//
// Why this matters beyond tidiness: the listing and search screens kept their
// filters in useState, so a refresh, a share, or the Android back button
// inside the Flutter WebView all lost them — and there was no way to link
// anyone to a filtered view. Putting the state in the query string makes
// refresh, share, back and deep-link all work for free, because they are the
// same mechanism.
//
// Only non-default values are written, so a clean browse stays at
// `/app/listing` instead of `/app/listing?page=1&sort=newest&limit=20`.

export const DEFAULT_SORT = 'newest'
export const DEFAULT_PAGE_SIZE = 20
// Mirrors the server cap (backend/utils/pagination.js maxLimit).
const MAX_PAGE_SIZE = 50

const SORT_VALUES = ['newest', 'price_asc', 'price_desc', 'rating', 'discount', 'popular']
// 'all' is the default and never written to the URL — only 'dropship' and
// 'normal' narrow the result set.
const SOURCE_VALUES = ['all', 'dropship', 'normal']

function readInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  // `URLSearchParams.get` returns `null` for an absent key, and `Number(null)`
  // is `0` — a finite number — so without this check a missing param silently
  // clamps to `min` instead of falling back to the caller's default (this is
  // what made `limit` default to 1 instead of 20).
  if (value === null || value === undefined || value === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

export function useCatalogParams() {
  const [searchParams, setSearchParams] = useSearchParams()

  const params = useMemo(() => {
    const brandParam = searchParams.get('brand')
    return {
      search: searchParams.get('q')?.trim() || '',
      category: searchParams.get('category') || '',
      // Multi-select, comma separated in the URL so it stays readable and
      // shareable rather than repeating the key.
      brands: brandParam ? brandParam.split(',').filter(Boolean) : [],
      minPrice: searchParams.get('minPrice') ? readInt(searchParams.get('minPrice'), 0, { min: 0 }) : null,
      maxPrice: searchParams.get('maxPrice') ? readInt(searchParams.get('maxPrice'), 0, { min: 0 }) : null,
      rating: searchParams.get('rating') ? readInt(searchParams.get('rating'), 0, { min: 0, max: 5 }) : null,
      inStock: searchParams.get('inStock') === 'true',
      minDiscount: searchParams.get('minDiscount')
        ? readInt(searchParams.get('minDiscount'), 0, { min: 0, max: 100 })
        : null,
      flashSale: searchParams.get('flashSale') === 'true',
      trending: searchParams.get('trending') === 'true',
      source: SOURCE_VALUES.includes(searchParams.get('source')) ? searchParams.get('source') : 'all',
      sort: SORT_VALUES.includes(searchParams.get('sort')) ? searchParams.get('sort') : DEFAULT_SORT,
      page: readInt(searchParams.get('page'), 1, { min: 1 }),
      limit: readInt(searchParams.get('limit'), DEFAULT_PAGE_SIZE, { min: 1, max: MAX_PAGE_SIZE }),
    }
  }, [searchParams])

  // Any filter change resets to page 1 — staying on page 7 of a result set
  // that now has two pages is how a filtered search ends up looking empty.
  const setParams = useCallback(
    (patch, { replace = false, resetPage = true } = {}) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)

          for (const [key, value] of Object.entries(patch)) {
            const urlKey = key === 'search' ? 'q' : key === 'brands' ? 'brand' : key
            const serialised = Array.isArray(value) ? value.filter(Boolean).join(',') : value

            const isDefault =
              serialised === '' ||
              serialised === null ||
              serialised === undefined ||
              serialised === false ||
              (urlKey === 'sort' && serialised === DEFAULT_SORT) ||
              (urlKey === 'limit' && serialised === DEFAULT_PAGE_SIZE) ||
              (urlKey === 'page' && serialised === 1) ||
              (urlKey === 'source' && serialised === 'all')

            if (isDefault) next.delete(urlKey)
            else next.set(urlKey, String(serialised))
          }

          if (resetPage && !('page' in patch)) next.delete('page')
          return next
        },
        // `replace` for keystroke-level updates (the search box), so typing
        // does not stack one history entry per character and make the back
        // button useless.
        { replace },
      )
    },
    [setSearchParams],
  )

  const clearFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams()
        // The query and the category are the context the user navigated in
        // with — "clear filters" should not also drop them.
        const q = prev.get('q')
        const category = prev.get('category')
        if (q) next.set('q', q)
        if (category) next.set('category', category)
        return next
      },
      { replace: false },
    )
  }, [setSearchParams])

  // What the API actually receives. Empty values are omitted so the request
  // URL (and therefore the react-query cache key) is stable.
  const apiParams = useMemo(() => {
    const out = { page: params.page, limit: params.limit, sort: params.sort }
    if (params.search) out.search = params.search
    if (params.category) out.category = params.category
    if (params.brands.length) out.brand = params.brands.join(',')
    if (params.minPrice != null) out.minPrice = params.minPrice
    if (params.maxPrice != null) out.maxPrice = params.maxPrice
    if (params.rating) out.rating = params.rating
    if (params.inStock) out.inStock = true
    if (params.minDiscount) out.minDiscount = params.minDiscount
    if (params.flashSale) out.flashSale = true
    if (params.trending) out.trending = true
    if (params.source !== 'all') out.source = params.source
    return out
  }, [params])

  const activeFilterCount = useMemo(
    () =>
      [
        params.brands.length > 0,
        params.minPrice != null,
        params.maxPrice != null,
        Boolean(params.rating),
        params.inStock,
        Boolean(params.minDiscount),
        params.source !== 'all',
      ].filter(Boolean).length,
    [params],
  )

  return { params, apiParams, setParams, clearFilters, activeFilterCount }
}
