// Layer rule: services/ is the ONLY place that imports the axios instance.

import { fetchResource } from './mockTransport'
import * as fixtures from '../fixtures/marketing'
import {
  bannerListSchema,
  campaignListSchema,
  cmsPageListSchema,
  couponListSchema,
  offerListSchema,
  reportCatalogueSchema,
  reportRunSchema,
  reviewListSchema,
  templateListSchema,
} from '../schemas/marketingSchema'

const params = (query) => ({
  tab: query.tab,
  page: query.page,
  rowsPerPage: query.rowsPerPage,
  ...query.filters,
})

const list = (path, fixture, schema) => (query) =>
  fetchResource({ path, params: params(query), fixture: () => fixture(query), schema })

export const fetchCoupons = list('/admin/marketing/coupons', fixtures.couponListFixture, couponListSchema)
export const fetchCampaigns = list('/admin/marketing/campaigns', fixtures.campaignListFixture, campaignListSchema)
export const fetchReviews = list('/admin/marketing/reviews', fixtures.reviewListFixture, reviewListSchema)

export const fetchOffers = () =>
  fetchResource({ path: '/admin/marketing/offers', fixture: fixtures.offerListFixture, schema: offerListSchema })

export const fetchBanners = () =>
  fetchResource({ path: '/admin/marketing/banners', fixture: fixtures.bannerListFixture, schema: bannerListSchema })

export const fetchCmsPages = () =>
  fetchResource({ path: '/admin/marketing/cms', fixture: fixtures.cmsPageListFixture, schema: cmsPageListSchema })

export const fetchTemplates = () =>
  fetchResource({ path: '/admin/marketing/templates', fixture: fixtures.templateListFixture, schema: templateListSchema })

export const fetchReportCatalogue = () =>
  fetchResource({ path: '/admin/reports', fixture: fixtures.reportCatalogueFixture, schema: reportCatalogueSchema })

export const fetchReportRun = (reportKey) =>
  fetchResource({
    path: `/admin/reports/${reportKey}`,
    fixture: () => fixtures.reportRunFixture(reportKey),
    schema: reportRunSchema,
  })
