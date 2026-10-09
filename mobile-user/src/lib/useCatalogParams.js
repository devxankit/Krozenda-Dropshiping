import { useCallback, useMemo } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'

// Catalog filter/sort/page state, held in the route's query string (same keys as the web app:
// q, category, brand, minPrice, maxPrice, rating, inStock, minDiscount, flashSale, trending,
// source, sort, page, limit) so a deep link such as /listing?category=<id> opens a filtered view.
//
// Only non-default values are written. Filter changes update the current route's params in place
// (router.setParams) rather than stacking a new screen per change.

export const DEFAULT_SORT = 'newest'
export const DEFAULT_PAGE_SIZE = 20
// Mirrors the server cap (backend/utils/pagination.js maxLimit).
const MAX_PAGE_SIZE = 50

const SORT_VALUES = ['newest', 'price_asc', 'price_desc', 'rating', 'discount', 'popular']
// 'all' is the default and never written to the URL - only 'dropship' and 'normal' narrow the
// result set.
const SOURCE_VALUES = ['all', 'dropship', 'normal']

const ALL_KEYS = [
  'q',
  'category',
  'brand',
  'minPrice',
  'maxPrice',
  'rating',
  'inStock',
  'minDiscount',
  'flashSale',
  'trending',
  'source',
  'sort',
  'page',
  'limit',
]

function readInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === null || value === undefined || value === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

// expo-router gives string | string[] | undefined.
function one(value) {
  if (Array.isArray(value)) return value[0] ?? null
  return value === undefined ? null : value
}

export function useCatalogParams() {
  const router = useRouter()
  const raw = useLocalSearchParams()

  // A stable signature so memoisation does not depend on the identity of the params object.
  const signature = JSON.stringify(ALL_KEYS.map((key) => one(raw[key])))

  const params = useMemo(() => {
    const values = JSON.parse(signature)
    const read = (key) => values[ALL_KEYS.indexOf(key)] || null
    const brandParam = read('brand')
    return {
      search: read('q')?.trim() || '',
      category: read('category') || '',
      // Multi-select, comma separated.
      brands: brandParam ? brandParam.split(',').filter(Boolean) : [],
      minPrice: read('minPrice') ? readInt(read('minPrice'), 0, { min: 0 }) : null,
      maxPrice: read('maxPrice') ? readInt(read('maxPrice'), 0, { min: 0 }) : null,
      rating: read('rating') ? readInt(read('rating'), 0, { min: 0, max: 5 }) : null,
      inStock: read('inStock') === 'true',
      minDiscount: read('minDiscount') ? readInt(read('minDiscount'), 0, { min: 0, max: 100 }) : null,
      flashSale: read('flashSale') === 'true',
      trending: read('trending') === 'true',
      source: SOURCE_VALUES.includes(read('source')) ? read('source') : 'all',
      sort: SORT_VALUES.includes(read('sort')) ? read('sort') : DEFAULT_SORT,
      page: readInt(read('page'), 1, { min: 1 }),
      limit: readInt(read('limit'), DEFAULT_PAGE_SIZE, { min: 1, max: MAX_PAGE_SIZE }),
    }
  }, [signature])

  // Any filter change resets to page 1 - staying on page 7 of a result set that now has two pages
  // is how a filtered search ends up looking empty.
  const setParams = useCallback(
    (patch, { resetPage = true } = {}) => {
      const next = {}
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

        next[urlKey] = isDefault ? undefined : String(serialised)
      }
      if (resetPage && !('page' in patch)) next.page = undefined
      router.setParams(next)
    },
    [router],
  )

  const clearFilters = useCallback(() => {
    // The query and the category are the context the user navigated in with - "clear filters"
    // should not also drop them.
    const cleared = {}
    for (const key of ALL_KEYS) if (key !== 'q' && key !== 'category') cleared[key] = undefined
    router.setParams(cleared)
  }, [router])

  // What the API actually receives. Empty values are omitted so the request URL (and therefore
  // the react-query cache key) is stable.
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
        params.flashSale,
        params.trending,
      ].filter(Boolean).length,
    [params],
  )

  return { params, apiParams, setParams, clearFilters, activeFilterCount }
}

