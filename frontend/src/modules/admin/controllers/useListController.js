// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useCallback, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { DEFAULT_ROWS_PER_PAGE } from '../constants'

// The shared engine behind every list screen: tab, filters, sort, selection
// and paging, plus the query that reads them. A domain controller supplies a
// query key and a fetcher; it does not re-implement any of this.
//
// Rule 05 lives here — the ~28 list screens differ only in their columns and
// their filter schema, so those are the only things passed in.
export function useListController({ queryKey, queryFn, defaultTab = 'all', defaultSort = null }) {
  const [tab, setTab] = useState(defaultTab)
  const [filters, setFilters] = useState({})
  const [sort, setSort] = useState(defaultSort)
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE)
  const [selectedKeys, setSelectedKeys] = useState([])

  const params = useMemo(
    () => ({ tab, filters, sort, page, rowsPerPage }),
    [tab, filters, sort, page, rowsPerPage],
  )

  const query = useQuery({
    queryKey: [...queryKey, params],
    queryFn: () => queryFn(params),
    // Keeps the previous page on screen while the next one loads, so paging
    // does not flash the whole table back to skeletons.
    placeholderData: keepPreviousData,
  })

  // Any change to what the list is showing resets paging and selection —
  // a selection carried across a filter change acts on rows nobody can see.
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
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }
}
