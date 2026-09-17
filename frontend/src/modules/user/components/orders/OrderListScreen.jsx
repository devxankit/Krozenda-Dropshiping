import { useEffect, useState } from 'react'
import { HiChevronRight, HiMagnifyingGlass } from 'react-icons/hi2'
import { Link, useSearchParams } from 'react-router-dom'
import { WebHeader } from '../../../../components/layout/WebHeader'
import { BottomNavbar } from '../../../../components/layout/BottomNavbar'
import { SmartImage } from '../../../../components/ui/SmartImage'
import { Pagination } from '../../../../components/ui/Pagination'
import { EmptyResult, ErrorState, ListSkeleton } from '../../../../components/ui/AsyncBoundary'
import { USER_ROUTES, userPath } from '../../../../config/routes'
import { usePageMeta } from '../../../../lib/usePageMeta'
import { useOrdersController } from '../../controllers/useOrdersController'

const TABS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Shipped', value: 'SHIPPED' },
  { label: 'Delivered', value: 'DELIVERED' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

const STATUS_META = {
  PENDING: { label: 'Pending', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  PROCESSING: { label: 'Processing', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  SHIPPED: { label: 'Shipped', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  DELIVERED: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-800 border-red-200' },
}

const SEARCH_DEBOUNCE_MS = 400

function formatOrderNumber(id) {
  return id.slice(-8).toUpperCase()
}

export function OrderListScreen() {
  // Tab and page live in the URL, so a buyer who taps into an order and comes
  // back with the Android back button lands on the same tab and page they
  // left — rather than being reset to "All, page 1" every time.
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') || ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') || '')
  const query = searchParams.get('q') || ''

  usePageMeta({ title: 'My Orders', noindex: true })

  useEffect(() => {
    if (searchDraft === query) return undefined
    const timer = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (searchDraft.trim()) next.set('q', searchDraft.trim())
          else next.delete('q')
          next.delete('page')
          return next
        },
        { replace: true },
      )
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchDraft, query, setSearchParams])

  const { orders, pagination, isLoading, isFetching, error, refetch } = useOrdersController({
    status: status || undefined,
    page,
  })

  const setParam = (key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, String(value))
      else next.delete(key)
      if (key !== 'page') next.delete('page')
      return next
    })
  }

  // Search is applied client-side over the current page only, and the UI says
  // so. The orders endpoint has no text search, and pretending otherwise —
  // filtering one page and calling the result "your orders" — would quietly
  // hide matches sitting on page 2.
  const visibleOrders = query
    ? orders.filter(
        (order) =>
          formatOrderNumber(order.id).toLowerCase().includes(query.toLowerCase()) ||
          order.previewItems.some((item) => item.name.toLowerCase().includes(query.toLowerCase())),
      )
    : orders

  return (
    <div className="flex min-h-screen w-full flex-col justify-between bg-slate-50 font-sans text-slate-800">
      <div className="hidden md:block">
        <WebHeader />
      </div>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-4 pb-28 sm:px-6 md:py-8 md:pb-12 lg:px-8">
        <div className="space-y-4 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-xl font-black text-slate-900 md:text-2xl">My Orders</h1>
              <p className="mt-1 text-xs text-slate-500">Track your shipments and request returns.</p>
            </div>

            <div className="flex w-full items-center rounded-2xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 sm:w-72">
              <HiMagnifyingGlass className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                inputMode="search"
                enterKeyHint="search"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Search this page…"
                aria-label="Search orders on this page"
                className="w-full bg-transparent px-2 text-xs font-semibold text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Filter orders by status"
            className="flex items-center gap-2 overflow-x-auto border-t border-slate-100 pt-3"
          >
            {TABS.map((tab) => (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={status === tab.value}
                onClick={() => setParam('status', tab.value)}
                className={`whitespace-nowrap rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
                  status === tab.value
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <ListSkeleton count={4} />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : orders.length === 0 ? (
          <EmptyResult
            icon={'📦'}
            title={status ? `No ${STATUS_META[status]?.label.toLowerCase()} orders` : 'No orders yet'}
            description={
              status
                ? 'Try a different tab to see your other orders.'
                : 'Once you place an order it will appear here with its status and tracking.'
            }
            action={
              !status && (
                <Link
                  to={USER_ROUTES.LISTING}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Start shopping
                </Link>
              )
            }
          />
        ) : visibleOrders.length === 0 ? (
          <EmptyResult
            icon={'🔍'}
            title={`No orders on this page match “${query}”`}
            description="Order search only covers the page you are on. Try another page, or clear the search."
            action={
              <button
                type="button"
                onClick={() => setSearchDraft('')}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
              >
                Clear search
              </button>
            }
          />
        ) : (
          <>
            <div
              className={`space-y-4 transition-opacity ${isFetching ? 'opacity-60' : 'opacity-100'}`}
              aria-busy={isFetching}
            >
              {visibleOrders.map((order) => {
                const meta = STATUS_META[order.status] || STATUS_META.PENDING
                const extraItems = order.itemCount - order.previewItems.length

                return (
                  <Link
                    key={order.id}
                    to={userPath.order(order.id)}
                    className="group block space-y-4 overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:p-6"
                  >
                    <div className="flex flex-row items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="min-w-0 space-y-0.5">
                        <span className="block truncate text-xs font-black text-slate-900 sm:text-sm">
                          Order #{formatOrderNumber(order.id)}
                        </span>
                        <time
                          dateTime={order.createdAt}
                          className="block truncate text-[11px] font-semibold text-slate-500"
                        >
                          Placed on{' '}
                          {new Date(order.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </time>
                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold sm:text-xs ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                    </div>

                    <div className="flex w-full min-w-0 items-center gap-3 py-1">
                      <div className="flex shrink-0 -space-x-2">
                        {order.previewItems.map((item, i) => (
                          <SmartImage
                            key={i}
                            src={item.image}
                            sizes="48px"
                            alt={item.name}
                            ratio="1 / 1"
                            className="w-10 shrink-0 rounded-xl border border-slate-200 bg-white sm:w-12"
                          />
                        ))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-xs font-bold text-slate-900 sm:text-sm">
                          {order.previewItems.map((item) => item.name).join(', ')}
                          {extraItems > 0 && ` +${extraItems} more`}
                        </p>
                        <span className="text-[11px] font-medium text-slate-500">
                          {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <div className="shrink-0">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Total amount
                        </span>
                        <span className="text-sm font-black text-blue-700 sm:text-base">
                          {'₹'}
                          {order.total.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-blue-600 transition-transform group-hover:translate-x-1">
                        <span className="hidden sm:inline">View order details</span>
                        <span className="sm:hidden">Details</span>
                        <HiChevronRight className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                rowsPerPage={pagination.limit}
                onPageChange={(next) => {
                  setParam('page', next)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                itemLabel="orders"
                size="touch"
              />
            )}
          </>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <BottomNavbar />
      </div>
    </div>
  )
}
