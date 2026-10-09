// Layer rule: controllers/ hold orchestration (react-query, derived state).

import { useCallback, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { DEFAULT_ROWS_PER_PAGE } from '../constants'

// The shared engine behind every list screen: tab, filters, sort, selection and paging, plus the
// query that reads them. A domain controller supplies a query key and a fetcher.
export function useListController({
  queryKey,
  queryFn,
  defaultTab = 'all',
  defaultSort = null,
  defaultRowsPerPage = DEFAULT_ROWS_PER_PAGE,
}) {
  const [tab, setTab] = useState(defaultTab)
  const [filters, setFilters] = useState({})
  const [sort, setSort] = useState(defaultSort)
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage)
  const [selectedKeys, setSelectedKeys] = useState([])

  const params = useMemo(
    () => ({ tab, filters, sort, page, rowsPerPage }),
    [tab, filters, sort, page, rowsPerPage],
  )

  const query = useQuery({
    queryKey: [...queryKey, params],
    queryFn: () => queryFn(params),
    // Keeps the previous page on screen while the next one loads.
    placeholderData: keepPreviousData,
  })

  // Any change to what the list is showing resets paging and selection.
  const changeTab = useCallback((next) => {
    setTab(next)
    setPage(1)
    setSelectedKeys([])
  }, [])

  const changeFilters = useCallback((next) => {
    setFilters(next)
    setPage(1)
    setSelectedKeys([])
  }, [])

  const clearFilters = useCallback(() => {
    setFilters({})
    setPage(1)
    setSelectedKeys([])
  }, [])

  const changeSort = useCallback((next) => {
    setSort(next)
    setPage(1)
  }, [])

  const changeRowsPerPage = useCallback((next) => {
    setRowsPerPage(next)
    setPage(1)
  }, [])

  return {
    tab,
    changeTab,
    filters,
    changeFilters,
    clearFilters,
    sort,
    changeSort,
    page,
    setPage,
    rowsPerPage,
    changeRowsPerPage,
    selectedKeys,
    setSelectedKeys,

    items: query.data?.items ?? [],
    totalItems: query.data?.totalItems ?? 0,
    totalPages: query.data?.totalPages ?? 1,
    tabCounts: query.data?.tabCounts ?? {},
    // The whole payload, for list endpoints that return something alongside the page.
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}
