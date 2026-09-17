// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing components are allowed to call into.

import { useQueries } from '@tanstack/react-query'
import { api } from '../../../lib/axios'
import { productCardListSchema, categoryListSchema, brandListSchema } from '../schemas/productSchema'
import { fetchCategories, fetchBrands } from '../services/productService'

// The home page's six independent data sources.
//
// The point of useQueries here rather than one aggregate call is that each
// section owns its own loading and failure. Previously all six lived in a
// single Promise.allSettled inside a useEffect, with a `loading` flag shared
// between them — so one slow endpoint held up the whole page, and one empty
// response triggered the hardcoded fallback products.
//
// Now: the rails that have data render, the ones that do not are hidden, and a
// failing recommendations call cannot take the categories with it (§55).
//
// Categories and brands go through the SAME query keys the rest of the app
// uses (['catalog','categories'], ['catalog','brands']) with the same long
// staleTime, which is what collapses the header's copy, this page's copy and
// the filter panel's copy into one request per session (§32).

const HOME_RAIL_LIMIT = 8

async function fetchRail(params, signal) {
  const { data } = await api.get('/catalog/products', { params, signal })
  return productCardListSchema.parse(data.data.items)
}

async function fetchBanners(signal) {
  const { data } = await api.get('/catalog/banners', { signal })
  return data?.data?.items ?? []
}

async function fetchTopCoupon(signal) {
  const { data } = await api.get('/catalog/coupons', { params: { limit: 1 }, signal })
  return data?.data?.items ?? []
}

export function useHomeFeed() {
  const results = useQueries({
    queries: [
      {
        queryKey: ['catalog', 'categories'],
        queryFn: ({ signal }) => fetchCategories({ signal }),
        staleTime: 10 * 60_000,
        gcTime: 30 * 60_000,
      },
      {
        queryKey: ['catalog', 'products', { flashSale: true, limit: HOME_RAIL_LIMIT }],
        queryFn: ({ signal }) => fetchRail({ flashSale: 'true', limit: HOME_RAIL_LIMIT }, signal),
        staleTime: 2 * 60_000,
      },
      {
        queryKey: ['catalog', 'products', { trending: true, limit: HOME_RAIL_LIMIT }],
        queryFn: ({ signal }) => fetchRail({ trending: 'true', limit: HOME_RAIL_LIMIT }, signal),
        staleTime: 2 * 60_000,
      },
      {
        queryKey: ['catalog', 'brands'],
        queryFn: ({ signal }) => fetchBrands({ signal }),
        staleTime: 10 * 60_000,
        gcTime: 30 * 60_000,
      },
      {
        queryKey: ['catalog', 'banners'],
        queryFn: ({ signal }) => fetchBanners(signal),
        staleTime: 10 * 60_000,
      },
      {
        queryKey: ['catalog', 'coupons', 'top'],
        queryFn: ({ signal }) => fetchTopCoupon(signal),
        staleTime: 5 * 60_000,
      },
    ],
  })

  const [categoriesQ, flashQ, trendingQ, brandsQ, bannersQ, couponsQ] = results

  return {
    categories: categoriesQ.data ?? [],
    flashSale: flashQ.data ?? [],
    trending: trendingQ.data ?? [],
    brands: brandsQ.data ?? [],
    banners: bannersQ.data ?? [],
    coupons: couponsQ.data ?? [],

    // Per-section loading, so each rail shows its own skeleton and none of
    // them waits on the slowest.
    isLoading: {
      categories: categoriesQ.isLoading,
      flashSale: flashQ.isLoading,
      trending: trendingQ.isLoading,
      brands: brandsQ.isLoading,
      banners: bannersQ.isLoading,
    },
  }
}

// Re-exported so callers do not need to know which schema file these live in.
export { categoryListSchema, brandListSchema }
