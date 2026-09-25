import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as service from '../services/productImportService'

// Re-exported so pages can name a panel's import endpoint without reaching
// into services/.
export { IMPORT_BASE } from '../services/productImportService'

// React-query wrappers for the CSV import flow. `base` is one of
// IMPORT_BASE and is part of every query key, so the admin and seller
// panels never share cached batches.

const BUSY = ['PROCESSING', 'APPROVING']

export function useImportHistory(base, page) {
  return useQuery({
    queryKey: ['product-import', base, 'list', page],
    queryFn: () => service.fetchImports(base, { page }),
    placeholderData: keepPreviousData,
    // Keep the history live while any batch is still being processed.
    refetchInterval: (query) =>
      query.state.data?.items?.some((b) => BUSY.includes(b.status)) ? 2000 : false,
  })
}

export function useImportBatch(base, id) {
  return useQuery({
    queryKey: ['product-import', base, 'batch', id],
    queryFn: () => service.fetchImport(base, id),
    enabled: Boolean(id),
    refetchInterval: (query) => (BUSY.includes(query.state.data?.status) ? 1500 : false),
  })
}

export function useImportRows(base, id, { page, filter, enabled }) {
  return useQuery({
    queryKey: ['product-import', base, 'rows', id, filter, page],
    queryFn: () => service.fetchImportRows(base, id, { page, filter }),
    enabled: Boolean(id) && enabled,
    placeholderData: keepPreviousData,
  })
}

// `productQueryKeys` are the product-list caches to refresh once a batch
// lands in the catalog (they differ between the admin and seller panels).
export function useImportActions(base, { productQueryKeys = [] } = {}) {
  const queryClient = useQueryClient()
  const refreshImports = () => queryClient.invalidateQueries({ queryKey: ['product-import', base] })

  const upload = useMutation({
    mutationFn: (payload) => service.uploadImport(base, payload),
    onSuccess: refreshImports,
  })
  const setExcluded = useMutation({
    mutationFn: ({ id, ...payload }) => service.setImportRowsExcluded(base, id, payload),
    onSuccess: refreshImports,
  })
  const approve = useMutation({
    mutationFn: (id) => service.approveImport(base, id),
    onSettled: () => {
      refreshImports()
      productQueryKeys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
    },
  })
  const reject = useMutation({
    mutationFn: ({ id, reason }) => service.rejectImport(base, id, reason),
    onSuccess: refreshImports,
  })

  return {
    upload,
    setExcluded,
    approve,
    reject,
    downloadTemplate: () => service.downloadImportTemplate(base),
  }
}

// Admin preview mode: approve imported previews from the product list.
// Refreshes the product list (the products turn live) and the import history.
export function useApprovePreviewProducts(base, { productQueryKeys = [] } = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => service.approvePreviewProducts(base, payload),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['product-import', base] })
      productQueryKeys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
    },
  })
}
