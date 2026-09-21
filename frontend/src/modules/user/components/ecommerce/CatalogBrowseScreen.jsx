import { useEffect, useMemo, useRef, useState } from 'react'
import {
  HiAdjustmentsHorizontal,
  HiArrowLeft,
  HiListBullet,
  HiMagnifyingGlass,
  HiSquares2X2,
  HiXMark,
} from 'react-icons/hi2'
import { useNavigate } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { Footer } from '../../../../components/layout/Footer'
import { Pagination } from '../../../../components/ui/Pagination'
import {
  EmptyResult,
  ErrorState,
  ProductGridSkeleton,
} from '../../../../components/ui/AsyncBoundary'
import { SectionErrorBoundary } from '../../../../components/common/ErrorBoundary'
import { USER_ROUTES } from '../../../../config/routes'
import { useCatalogParams } from '../../../../lib/useCatalogParams'
import { usePageMeta } from '../../../../lib/usePageMeta'
import {
  useBrandsController,
  useCategoriesController,
  useProductsController,
} from '../../controllers/useProductsController'
import { ProductCard } from './ProductCard'
import { CatalogFilterPanel, FilterSheet } from './CatalogFilterPanel'

// One screen behind both /app/listing and /app/search.
//
// They were two separate implementations of the same thing: a filtered product
// grid. /app/listing fetched `limit: 100` and filtered the whole result in the
// browser; /app/search did not call the API at all and rendered four hardcoded
// shoes. Both kept their filters in component state, so refresh, share and the
// Android back button all lost them.
//
// Now: one screen, server-side filtering/sorting/pagination, all state in the
// URL.

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'popular', label: 'Popularity' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'discount', label: 'Discount' },
  { value: 'rating', label: 'Customer rating' },
]

// 400ms: long enough that a normal typing cadence produces one request per
// word rather than one per keystroke, short enough that the results do not
// feel detached from the input (§27).
const SEARCH_DEBOUNCE_MS = 400

export function CatalogBrowseScreen({ mode = 'listing' }) {
  const navigate = useNavigate()
  const { params, apiParams, setParams, clearFilters, activeFilterCount } = useCatalogParams()

  const [isGridView, setIsGridView] = useState(true)
  const [isFilterSheetOpen, setFilterSheetOpen] = useState(false)

  // The input is uncontrolled-by-URL while typing: the URL (and therefore the
  // request) only catches up after the debounce, so every keystroke is not a
  // history entry or a network call.
  const [searchDraft, setSearchDraft] = useState(params.search)
  const searchDraftRef = useRef(params.search)

  useEffect(() => {
    // Keep the box in sync when the URL changes for a reason other than typing
    // (back button, a link, clearing the query).
    if (params.search !== searchDraftRef.current) {
      searchDraftRef.current = params.search
      setSearchDraft(params.search)
    }
  }, [params.search])

  useEffect(() => {
    if (searchDraft === params.search) return undefined
    const timer = setTimeout(() => {
      searchDraftRef.current = searchDraft
      // `replace` so a 6-letter query leaves ONE history entry, not six — the
      // Android back button has to get the user out of search, not walk them
      // back through their own typing.
      setParams({ search: searchDraft }, { replace: true })
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchDraft, params.search, setParams])

  const { categories } = useCategoriesController()
  const { brands } = useBrandsController()
  const { products, pagination, isLoading, isFetching, error, refetch } =
    useProductsController(apiParams)

  const activeCategory = categories.find((c) => c.id === params.category)

  const heading = useMemo(() => {
    if (params.search) return `Results for “${params.search}”`
    if (activeCategory) return activeCategory.name
    if (params.flashSale) return 'Flash Sale'
    if (params.trending) return 'Trending Now'
    return 'All Products'
  }, [params.search, params.flashSale, params.trending, activeCategory])

  usePageMeta({
    title: heading,
    description: params.search
      ? `Search results for ${params.search} on Krozenda.`
      : activeCategory
        ? `Shop ${activeCategory.name} at wholesale prices on Krozenda.`
        : 'Browse the full Krozenda catalog.',
    // Search result pages are noindex: they are infinite, thin, and duplicate
    // the category pages that should rank instead.
    noindex: Boolean(params.search),
  })

  // Ensure any category change in the browse view always resets to absolute top
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [params.category])

  const goToPage = (page) => {
    setParams({ page }, { resetPage: false })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const filterPanel = (
    <CatalogFilterPanel
      params={params}
      brands={brands}
      categories={categories}
      showCategories={mode === 'listing'}
      onApply={(draft) => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        setParams({
          category: draft.category,
          brands: draft.brands,
          minPrice: draft.minPrice,
          maxPrice: draft.maxPrice,
          rating: draft.rating,
          inStock: draft.inStock,
          minDiscount: draft.minDiscount,
          source: draft.source,
        })
      }}
      onClear={() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        clearFilters()
      }}
      onClose={() => setFilterSheetOpen(false)}
    />
  )

  return (
    <div className="flex min-h-screen w-full flex-col justify-between bg-slate-50 font-sans text-slate-800">
      <div className="hidden md:block">
        <WebHeader />
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 pb-28 pt-4 sm:px-6 md:pb-12 md:pt-8 lg:px-8">
        {/* Search + controls */}
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm sm:p-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
          >
            <HiArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 transition-all focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-600">
            <HiMagnifyingGlass className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              // type="search" gives the WebView keyboard a "Search" action key
              // rather than a newline key.
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search products, brands..."
              aria-label="Search products"
              className="w-full bg-transparent px-2 text-xs font-bold text-slate-900 focus:outline-none"
            />
            {searchDraft && (
              <button
                type="button"
                onClick={() => setSearchDraft('')}
                aria-label="Clear search"
                className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:text-slate-600"
              >
                <HiXMark className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsGridView((v) => !v)}
            aria-label={isGridView ? 'Switch to list view' : 'Switch to grid view'}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:flex"
          >
            {isGridView ? <HiListBullet className="h-4 w-4" /> : <HiSquares2X2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-3 text-xs font-bold text-white shadow-sm hover:bg-blue-700 lg:hidden"
          >
            <HiAdjustmentsHorizontal className="h-4 w-4" aria-hidden="true" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-blue-700">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex gap-6">
          {/* Desktop sidebar */}
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-24 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <CatalogFilterPanel
                params={params}
                brands={brands}
                categories={categories}
                showCategories={mode === 'listing'}
                onApply={(draft) =>
                  setParams({
                    category: draft.category,
                    brands: draft.brands,
                    minPrice: draft.minPrice,
                    maxPrice: draft.maxPrice,
                    rating: draft.rating,
                    inStock: draft.inStock,
                    minDiscount: draft.minDiscount,
                    source: draft.source,
                  })
                }
                onClear={clearFilters}
              />
            </div>
          </aside>

          <div className="min-w-0 flex-1 space-y-4">
            {/* Results header */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-sm">
              <div className="min-w-0">
                <h1 className="truncate text-sm font-black text-slate-900">{heading}</h1>
                <p className="text-[11px] font-semibold text-slate-500" aria-live="polite">
                  {isLoading
                    ? 'Loading…'
                    : pagination
                      ? `${pagination.total.toLocaleString('en-IN')} ${pagination.total === 1 ? 'product' : 'products'}`
                      : ''}
                </p>
              </div>

              <label className="flex shrink-0 items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500">Sort</span>
                <select
                  value={params.sort}
                  onChange={(e) => setParams({ sort: e.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Active filter chips — so the user can always see WHY a result
                set is small, and undo one filter without opening the panel. */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {params.brands.map((brandId) => {
                  const brand = brands.find((b) => b.id === brandId)
                  return (
                    <FilterChip
                      key={brandId}
                      label={brand?.name || 'Brand'}
                      onRemove={() =>
                        setParams({ brands: params.brands.filter((b) => b !== brandId) })
                      }
                    />
                  )
                })}
                {(params.minPrice != null || params.maxPrice != null) && (
                  <FilterChip
                    label={`₹${params.minPrice ?? 0} – ₹${params.maxPrice ?? '∞'}`}
                    onRemove={() => setParams({ minPrice: null, maxPrice: null })}
                  />
                )}
                {params.rating && (
                  <FilterChip
                    label={`${params.rating}★ & above`}
                    onRemove={() => setParams({ rating: null })}
                  />
                )}
                {params.minDiscount && (
                  <FilterChip
                    label={`${params.minDiscount}%+ off`}
                    onRemove={() => setParams({ minDiscount: null })}
                  />
                )}
                {params.inStock && (
                  <FilterChip label="In stock" onRemove={() => setParams({ inStock: false })} />
                )}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] font-bold text-blue-600 hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Results */}
            {isLoading ? (
              <ProductGridSkeleton count={8} />
            ) : error ? (
              <ErrorState error={error} onRetry={refetch} />
            ) : products.length === 0 ? (
              <EmptyResult
                icon={'🔍'}
                title={params.search ? `No products match “${params.search}”` : 'No products found'}
                description={
                  activeFilterCount > 0
                    ? 'Try removing a filter or two — your current combination has no matches.'
                    : 'Nothing is listed here yet. Check back soon.'
                }
                action={
                  activeFilterCount > 0 ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
                    >
                      Clear filters
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(USER_ROUTES.CATEGORIES)}
                      className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
                    >
                      Browse categories
                    </button>
                  )
                }
              />
            ) : (
              <>
                {/* Dimmed rather than replaced while a new page loads, so the
                    grid never blanks out and the page never jumps. */}
                <div
                  className={`transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}
                  aria-busy={isFetching}
                >
                  <div
                    className={
                      isGridView
                        ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4'
                        : 'space-y-3'
                    }
                  >
                    {products.map((product, index) => (
                      // One card that throws must not take the whole grid with
                      // it — the rest of the results stay usable.
                      <SectionErrorBoundary key={product.id} label="This product">
                        <ProductCard
                          product={product}
                          layout={isGridView ? 'grid' : 'list'}
                          // Only the first row is eager; everything else is
                          // lazy, which is what keeps a 20-product page from
                          // firing 20 image requests at once on a phone.
                          priority={index < 4}
                        />
                      </SectionErrorBoundary>
                    ))}
                  </div>
                </div>

                {pagination && pagination.totalPages > 1 && (
                  <div className="pt-2">
                    <Pagination
                      page={pagination.page}
                      totalPages={pagination.totalPages}
                      totalItems={pagination.total}
                      rowsPerPage={pagination.limit}
                      onPageChange={goToPage}
                      itemLabel="products"
                      size="touch"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />

      <FilterSheet open={isFilterSheetOpen} onClose={() => setFilterSheetOpen(false)}>
        {filterPanel}
      </FilterSheet>

      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <BottomNavbar />
      </div>
    </div>
  )
}

function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-1 text-[11px] font-bold text-slate-700">
      <span className="max-w-[10rem] truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${label}`}
        className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <HiXMark className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}
