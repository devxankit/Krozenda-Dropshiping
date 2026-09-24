// Layer rule: controllers/ hold orchestration (react-query, derived state)
// and are the ONLY thing pages/ are allowed to call into.

import { useQuery } from '@tanstack/react-query'
import * as service from '../services/marketingService'
import { useAdminMutation } from './useAdminMutation'
import { useListController } from './useListController'

export const useCouponListController = () =>
  useListController({ queryKey: ['admin', 'marketing', 'coupons'], queryFn: service.fetchCoupons })

const COUPONS = [['admin', 'marketing', 'coupons']]

export const useCouponWriteController = ({ onSaved } = {}) => ({
  create: useAdminMutation({
    mutationFn: service.createCoupon,
    invalidate: COUPONS,
    success: (coupon) => `${coupon.code} created`,
    onDone: onSaved,
  }),
  update: useAdminMutation({
    mutationFn: service.updateCoupon,
    invalidate: COUPONS,
    success: (coupon) => `${coupon.code} updated`,
    onDone: onSaved,
  }),
  setStatus: useAdminMutation({
    mutationFn: service.updateCouponStatus,
    invalidate: COUPONS,
    success: (coupon) => `${coupon.code} ${coupon.isActive ? 'activated' : 'deactivated'}`,
  }),
  remove: useAdminMutation({
    mutationFn: service.deleteCoupon,
    invalidate: COUPONS,
    success: 'Coupon removed',
  }),
})

export const useCouponWhatsappController = (couponId, { onSent, search = '', wantsCustomers = false } = {}) => {
  const stats = useQuery({
    queryKey: ['admin', 'marketing', 'coupons', couponId, 'whatsapp'],
    queryFn: () => service.fetchCouponWhatsapp(couponId),
    enabled: Boolean(couponId),
    // A send to "all customers" runs in the background; keep the counts moving.
    refetchInterval: (query) => (query.state.data?.sending > 0 ? 3000 : false),
  })
  const customers = useQuery({
    queryKey: ['admin', 'marketing', 'coupon-customers', search],
    queryFn: () => service.searchCouponCustomers(search),
    enabled: wantsCustomers,
  })
  const send = useAdminMutation({
    mutationFn: service.sendCouponWhatsapp,
    invalidate: [['admin', 'marketing', 'coupons', couponId, 'whatsapp']],
    success: (result) =>
      result.queued
        ? `Sending to ${result.recipients.toLocaleString('en-IN')} customer${result.recipients === 1 ? '' : 's'}`
        : `Sent to ${result.sent} customer${result.sent === 1 ? '' : 's'}`,
    describe: (result) =>
      [
        result.alreadySent ? `${result.alreadySent} already had it` : null,
        result.failed ? `${result.failed} failed` : null,
        result.ineligible ? `${result.ineligible} not eligible for this coupon` : null,
        result.noPhone ? `${result.noPhone} without a valid mobile` : null,
      ]
        .filter(Boolean)
        .join(' · ') || undefined,
    onDone: onSent,
  })
  return {
    stats: stats.data,
    isLoadingStats: stats.isLoading,
    customers: customers.data || [],
    isLoadingCustomers: customers.isLoading && wantsCustomers,
    send,
  }
}

export const useCampaignListController = () =>
  useListController({ queryKey: ['admin', 'marketing', 'campaigns'], queryFn: service.fetchCampaigns })

const CAMPAIGNS = [['admin', 'marketing', 'campaigns']]

export const useCampaignWriteController = ({ onSaved } = {}) => ({
  send: useAdminMutation({
    mutationFn: service.sendCampaign,
    invalidate: CAMPAIGNS,
    success: (campaign) => `Sent to ${campaign.audienceSize.toLocaleString('en-IN')} recipient${campaign.audienceSize === 1 ? '' : 's'}`,
    describe: (campaign) => `${campaign.delivered.toLocaleString('en-IN')} delivered`,
    onDone: onSaved,
  }),
})

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
