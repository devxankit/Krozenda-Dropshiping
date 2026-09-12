// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import * as service from '../services/marketingService'
import { useAdminMutation } from './useAdminMutation'
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
export const useCmsPagesController = (query = {}) => {
  const q = useQuery({
    queryKey: ['admin', 'marketing', 'cms', query],
    queryFn: () => service.fetchCmsPages(query),
  })
  return { data: q.data, isLoading: q.isLoading, error: q.error, refetch: q.refetch }
}

const CMS_PAGES = [['admin', 'marketing', 'cms']]

export const useCmsPageWriteController = ({ onSaved } = {}) => ({
  create: useAdminMutation({
    mutationFn: service.createCmsPage,
    invalidate: CMS_PAGES,
    success: (page) => `${page.title} created successfully`,
    onDone: onSaved,
  }),
  update: useAdminMutation({
    mutationFn: service.updateCmsPage,
    invalidate: CMS_PAGES,
    success: (page) => `${page.title} updated successfully`,
    onDone: onSaved,
  }),
  setStatus: useAdminMutation({
    mutationFn: service.updateCmsPageStatus,
    invalidate: CMS_PAGES,
    success: (page) => `${page.title} is now ${page.status}`,
  }),
  remove: useAdminMutation({
    mutationFn: service.deleteCmsPage,
    invalidate: CMS_PAGES,
    success: 'CMS page removed successfully',
  }),
})


// Banners are a real backend resource — writes invalidate the same key the
// list above reads, the same way catalog's brand writer does.
const BANNERS = [['admin', 'marketing', 'banners']]

export const useBannerWriteController = ({ onSaved } = {}) => ({
  create: useAdminMutation({
    mutationFn: service.createBanner,
    invalidate: BANNERS,
    success: (banner) => `${banner.title} created`,
    onDone: onSaved,
  }),
  update: useAdminMutation({
    mutationFn: service.updateBanner,
    invalidate: BANNERS,
    success: (banner) => `${banner.title} updated`,
    onDone: onSaved,
  }),
  setStatus: useAdminMutation({
    mutationFn: service.updateBannerStatus,
    invalidate: BANNERS,
    success: (banner) => `${banner.title} is now ${banner.status}`,
  }),
  remove: useAdminMutation({
    mutationFn: service.deleteBanner,
    invalidate: BANNERS,
    success: 'Banner removed',
  }),
})
// FAQs are a real backend resource, same shape as CMS pages.
export const useFaqsController = (query = {}) => {
  const q = useQuery({
    queryKey: ['admin', 'marketing', 'faqs', query],
    queryFn: () => service.fetchFaqs(query),
  })
  return { data: q.data, isLoading: q.isLoading, error: q.error, refetch: q.refetch }
}

const FAQS = [['admin', 'marketing', 'faqs']]

export const useFaqWriteController = ({ onSaved } = {}) => ({
  create: useAdminMutation({
    mutationFn: service.createFaq,
    invalidate: FAQS,
    success: 'FAQ added successfully',
    onDone: onSaved,
  }),
  update: useAdminMutation({
    mutationFn: service.updateFaq,
    invalidate: FAQS,
    success: 'FAQ updated successfully',
    onDone: onSaved,
  }),
  setStatus: useAdminMutation({
    mutationFn: service.updateFaqStatus,
    invalidate: FAQS,
    success: (faq) => `FAQ is now ${faq.status}`,
  }),
  remove: useAdminMutation({
    mutationFn: service.deleteFaq,
    invalidate: FAQS,
    success: 'FAQ removed',
  }),
})

export const useTemplatesController = () => useResource(['admin', 'marketing', 'templates'], service.fetchTemplates)
export const useReportCatalogueController = () => useResource(['admin', 'reports'], service.fetchReportCatalogue)

export const useReportRunController = (reportKey) =>
  useResource(['admin', 'reports', reportKey], () => service.fetchReportRun(reportKey), Boolean(reportKey))
