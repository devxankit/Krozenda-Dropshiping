// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import * as service from '../services/marketingService'
import { useListController } from './useListController'

export const useCouponListController = () =>
  useListController({ queryKey: ['admin', 'marketing', 'coupons'], queryFn: service.fetchCoupons })

export const useCampaignListController = () =>
  useListController({ queryKey: ['admin', 'marketing', 'campaigns'], queryFn: service.fetchCampaigns })

export const useReviewListController = () =>
  useListController({ queryKey: ['admin', 'marketing', 'reviews'], queryFn: service.fetchReviews })

function useResource(key, queryFn, enabled = true) {
  const query = useQuery({ queryKey: key, queryFn, enabled })
  return { data: query.data, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}

export const useOffersController = () => useResource(['admin', 'marketing', 'offers'], service.fetchOffers)
export const useBannersController = () => useResource(['admin', 'marketing', 'banners'], service.fetchBanners)
export const useCmsPagesController = () => useResource(['admin', 'marketing', 'cms'], service.fetchCmsPages)
export const useTemplatesController = () => useResource(['admin', 'marketing', 'templates'], service.fetchTemplates)
export const useReportCatalogueController = () => useResource(['admin', 'reports'], service.fetchReportCatalogue)

export const useReportRunController = (reportKey) =>
  useResource(['admin', 'reports', reportKey], () => service.fetchReportRun(reportKey), Boolean(reportKey))
