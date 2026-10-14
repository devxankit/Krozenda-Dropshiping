import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as shopifyService from '../services/shopifyService'
import { fetchCategoryTree } from '../services/catalogService'
import { toast } from '../../../lib/toast'

const KEYS = {
  settings: ['admin', 'shopify', 'settings'],
  catalogue: (cursor, search) => ['admin', 'shopify', 'catalogue', cursor || 'first', search || ''],
  counts: ['admin', 'shopify', 'counts'],
  imported: (page) => ['admin', 'shopify', 'imported', page],
}

// /admin/catalog/categories answers { items, stats } — an OBJECT, not an
// array — and the items are a FLAT list, not a tree. Unwrapped here so the
// pages never have to know that.
//
// Only categories a product can actually live in are offered: an inactive or
// unapproved one would import the product into somewhere buyers cannot reach.
function usableCategories(data) {
  const items = Array.isArray(data) ? data : data?.items || []
  return items
    .filter((c) => c.isActive !== false && (c.approvalStatus || 'APPROVED') === 'APPROVED')
    .map((c) => ({ id: c.id || c._id, name: c.name }))
}

function errorMessage(err, fallback) {
  return err?.response?.data?.message || err?.message || fallback
}

// ---------------------------------------------------------------------------
export function useShopifyConnectionController() {
  const queryClient = useQueryClient()

  const settingsQuery = useQuery({
    queryKey: KEYS.settings,
    queryFn: shopifyService.fetchShopifySettings,
  })

  const test = useMutation({
    mutationFn: shopifyService.testShopifyConnection,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: KEYS.settings })
      const warnings = data?.warnings || []
      if (warnings.length) toast.error(warnings[0])
      else toast.success('Shopify connection is working.')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not reach Shopify.')),
  })

  const visibility = useMutation({
    mutationFn: shopifyService.setStorefrontVisibility,
    onSuccess: (_data, visible) => {
      queryClient.invalidateQueries({ queryKey: KEYS.settings })
      toast.success(visible ? 'Dropshipping products are visible to customers.' : 'Dropshipping products hidden.')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not change visibility.')),
  })

  return {
    settings: settingsQuery.data || null,
    isLoading: settingsQuery.isLoading,
    error: settingsQuery.error,
    connected: settingsQuery.data?.connected === true,
    testConnection: test.mutate,
    isTesting: test.isPending,
    setVisibility: visibility.mutate,
    isSavingVisibility: visibility.isPending,
  }
}

// ---------------------------------------------------------------------------
// Browsing the connected store, and importing from it.
//
// Shopify pages with CURSORS, not page numbers — there is no way to jump to
// page 5. The cursor stack is what makes a Back button possible at all.
export function useShopifyCatalogueController() {
  const queryClient = useQueryClient()
  const [cursorStack, setCursorStack] = useState([null])
  const [search, setSearch] = useState('')
  const [selection, setSelection] = useState({})

  const cursor = cursorStack[cursorStack.length - 1]

  const catalogueQuery = useQuery({
    queryKey: KEYS.catalogue(cursor, search),
    queryFn: ({ signal }) => shopifyService.fetchShopifyCatalogue({ cursor, limit: 25, search }, { signal }),
    placeholderData: (previous) => previous,
  })

  const countsQuery = useQuery({
    queryKey: KEYS.counts,
    queryFn: ({ signal }) => shopifyService.fetchShopifyCatalogueCounts({ signal }),
  })

  const categoriesQuery = useQuery({
    queryKey: ['admin', 'categories', 'tree'],
    queryFn: fetchCategoryTree,
  })

  const products = catalogueQuery.data?.products || []
  const categories = useMemo(() => usableCategories(categoriesQuery.data), [categoriesQuery.data])

  const importMutation = useMutation({
    mutationFn: shopifyService.importShopifyProducts,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shopify'] })
      setSelection({})
      const failed = (data?.results || []).filter((r) => !r.ok)
      if (data?.importedCount) toast.success(`Imported ${data.importedCount} product(s) for review.`)
      // Name the first failure rather than a count: "1 failed" sends an admin
      // hunting, and the reason is almost always actionable (duplicate SKU).
      if (failed.length) toast.error(failed[0].message)
    },
    onError: (err) => toast.error(errorMessage(err, 'Import failed.')),
  })

  const toggleSelect = useCallback((product) => {
    setSelection((prev) => {
      const next = { ...prev }
      if (next[product.id]) delete next[product.id]
      else next[product.id] = { categoryId: '', sellingPrice: String(product.priceFrom ?? '') }
      return next
    })
  }, [])

  const setSelectionField = useCallback((shopifyProductId, field, value) => {
    setSelection((prev) => ({ ...prev, [shopifyProductId]: { ...prev[shopifyProductId], [field]: value } }))
  }, [])

  const selectedIds = useMemo(() => Object.keys(selection), [selection])

  const importSelected = useCallback(
    ({ activate = false } = {}) => {
      const items = selectedIds.map((id) => ({
        shopifyProductId: id,
        categoryId: selection[id]?.categoryId || undefined,
        sellingPrice: selection[id]?.sellingPrice ? Number(selection[id].sellingPrice) : undefined,
        activate,
      }))
      const missingCategory = items.find((i) => !i.categoryId)
      if (missingCategory) {
        toast.error('Choose a Krozenda category for every selected product.')
        return
      }
      importMutation.mutate(items)
    },
    [selectedIds, selection, importMutation]
  )

  return {
    products,
    isLoading: catalogueQuery.isLoading,
    isFetching: catalogueQuery.isFetching,
    error: catalogueQuery.error,
    counts: countsQuery.data || null,
    categories,

    search,
    setSearch: (value) => {
      setSearch(value)
      setCursorStack([null])
    },

    hasNextPage: catalogueQuery.data?.hasNextPage === true,
    hasPrevPage: cursorStack.length > 1,
    nextPage: () => setCursorStack((s) => [...s, catalogueQuery.data?.cursor || null]),
    prevPage: () => setCursorStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),

    selection,
    selectedIds,
    toggleSelect,
    setSelectionField,
    clearSelection: () => setSelection({}),

    importSelected,
    isImporting: importMutation.isPending,
  }
}

// ---------------------------------------------------------------------------
// The review queue: what has been imported, and what the admin does to it
// before customers see it.
export function useImportedProductsController() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: KEYS.imported(page),
    queryFn: ({ signal }) => shopifyService.fetchImportedProducts({ page, limit: 25 }, { signal }),
    placeholderData: (previous) => previous,
  })

  const categoriesQuery = useQuery({
    queryKey: ['admin', 'categories', 'tree'],
    queryFn: fetchCategoryTree,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'shopify'] })

  const update = useMutation({
    mutationFn: ({ productId, ...payload }) => shopifyService.updateImportedProduct(productId, payload),
    onSuccess: (data) => {
      invalidate()
      toast.success(data?.isActive ? 'Product is live for customers.' : 'Saved.')
    },
    onError: (err) => {
      const code = err?.response?.data?.code
      // These two are refusals the admin can consciously override, so the
      // toast says what to do rather than only what went wrong.
      if (code === 'NO_STOCK') {
        toast.error(`${err.response.data.message} Use "Publish anyway" to override.`)
        return
      }
      if (code === 'BELOW_COST') {
        toast.error(err.response.data.message)
        return
      }
      toast.error(errorMessage(err, 'Could not update the product.'))
    },
  })

  const bulk = useMutation({
    mutationFn: shopifyService.bulkUpdateImportedProducts,
    onSuccess: (data) => {
      invalidate()
      toast.success(data?.message || 'Updated.')
    },
    onError: (err) => toast.error(errorMessage(err, 'Bulk update failed.')),
  })

  const remove = useMutation({
    mutationFn: shopifyService.removeImportedProduct,
    onSuccess: () => {
      invalidate()
      toast.success('Removed from Krozenda. It is still in your Shopify store.')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not remove the product.')),
  })

  // Memoised, not `query.data?.products || []`: a fresh [] on every render
  // would make the stats useMemo below recompute every time.
  const rows = useMemo(() => query.data?.products || [], [query.data])

  return {
    rows,
    total: query.data?.total ?? 0,
    page,
    setPage,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    categories: usableCategories(categoriesQuery.data),

    stats: useMemo(
      () => ({
        total: query.data?.total ?? rows.length,
        live: rows.filter((r) => r.isActive).length,
        draft: rows.filter((r) => !r.isActive).length,
        outOfStock: rows.filter((r) => (r.stock ?? 0) <= 0).length,
      }),
      [rows, query.data?.total]
    ),

    save: update.mutate,
    isSaving: update.isPending,
    publish: (productId, opts = {}) => update.mutate({ productId, isActive: true, ...opts }),
    unpublish: (productId) => update.mutate({ productId, isActive: false }),
    bulkPublish: (productIds, opts = {}) => bulk.mutate({ productIds, isActive: true, ...opts }),
    bulkUnpublish: (productIds) => bulk.mutate({ productIds, isActive: false }),
    isBulkSaving: bulk.isPending,
    remove: remove.mutate,
    isRemoving: remove.isPending,
  }
}

// ---------------------------------------------------------------------------
// Fulfilment: delivery rates, the cancel window, webhook health, and the
// queue of paid orders waiting to reach Shopify.
export function useShopifyFulfilmentController() {
  const queryClient = useQueryClient()
  const [pushStatus, setPushStatus] = useState('')

  const settingsQuery = useQuery({
    queryKey: KEYS.settings,
    queryFn: shopifyService.fetchShopifySettings,
  })

  const webhooksQuery = useQuery({
    queryKey: ['admin', 'shopify', 'webhooks'],
    queryFn: ({ signal }) => shopifyService.fetchWebhookHealth({ signal }),
    // Reaches out to Shopify, so do not refetch it on every focus.
    staleTime: 60_000,
    retry: false,
  })

  const pushesQuery = useQuery({
    queryKey: ['admin', 'shopify', 'pushes', pushStatus],
    queryFn: ({ signal }) => shopifyService.fetchOrderPushes({ status: pushStatus }, { signal }),
    refetchInterval: 30_000,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'shopify'] })

  const saveSettings = useMutation({
    mutationFn: shopifyService.updateFulfilmentSettings,
    onSuccess: () => {
      invalidate()
      toast.success('Fulfilment settings saved.')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not save.')),
  })

  const register = useMutation({
    mutationFn: shopifyService.registerWebhooks,
    onSuccess: (data) => {
      invalidate()
      if (data?.failed) toast.error(`${data.registered} subscribed, ${data.failed} failed.`)
      else toast.success(`Subscribed to ${data?.registered} topic(s).`)
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not subscribe to Shopify webhooks.')),
  })

  const unregister = useMutation({
    mutationFn: shopifyService.unregisterWebhooks,
    onSuccess: () => {
      invalidate()
      toast.success('Webhook subscriptions removed.')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not remove subscriptions.')),
  })

  const retry = useMutation({
    mutationFn: shopifyService.retryOrderPush,
    onSuccess: () => {
      invalidate()
      toast.success('Sent to Shopify again.')
    },
    onError: (err) => toast.error(errorMessage(err, 'Retry failed.')),
  })

  const runNow = useMutation({
    mutationFn: shopifyService.runOrderPushesNow,
    onSuccess: (data) => {
      invalidate()
      toast.success(`Queue drained: ${data?.pushed ?? 0} sent.`)
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not drain the queue.')),
  })

  const syncNow = useMutation({
    mutationFn: shopifyService.syncImportedProducts,
    onSuccess: (data) => {
      invalidate()
      toast.success(`Checked ${data?.checked ?? 0} product(s); ${data?.changed ?? 0} updated.`)
    },
    onError: (err) => toast.error(errorMessage(err, 'Sync failed.')),
  })

  return {
    settings: settingsQuery.data || null,
    isLoading: settingsQuery.isLoading,

    webhooks: webhooksQuery.data || null,
    webhooksError: webhooksQuery.error,
    isLoadingWebhooks: webhooksQuery.isLoading,

    pushes: pushesQuery.data?.pushes || [],
    pushCounts: pushesQuery.data?.counts || {},
    pushStatus,
    setPushStatus,
    isLoadingPushes: pushesQuery.isLoading,

    saveSettings: saveSettings.mutate,
    isSaving: saveSettings.isPending,
    registerWebhooks: register.mutate,
    isRegistering: register.isPending,
    unregisterWebhooks: unregister.mutate,
    isUnregistering: unregister.isPending,
    retryPush: retry.mutate,
    isRetrying: retry.isPending,
    runPushesNow: runNow.mutate,
    isRunning: runNow.isPending,
    syncNow: syncNow.mutate,
    isSyncing: syncNow.isPending,
  }
}

// ---------------------------------------------------------------------------
// The money view: what each dropshipping platform was sent, what Krozenda
// made on it, and every payment state that needs a human.
export function useShopifyMoneyController() {
  const earningsQuery = useQuery({
    queryKey: ['admin', 'shopify', 'earnings'],
    queryFn: ({ signal }) => shopifyService.fetchSupplierEarnings({}, { signal }),
  })

  const exceptionsQuery = useQuery({
    queryKey: ['admin', 'shopify', 'exceptions'],
    queryFn: ({ signal }) => shopifyService.fetchPaymentExceptions({ signal }),
    refetchInterval: 60_000,
  })

  return {
    suppliers: earningsQuery.data?.suppliers || [],
    totals: earningsQuery.data?.totals || null,
    isLoading: earningsQuery.isLoading,
    error: earningsQuery.error,

    exceptions: exceptionsQuery.data || null,
    exceptionCount: exceptionsQuery.data?.total ?? 0,
    isLoadingExceptions: exceptionsQuery.isLoading,
  }
}
