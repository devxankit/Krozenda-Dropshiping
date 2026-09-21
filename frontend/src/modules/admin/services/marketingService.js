// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import { fetchResource } from './mockTransport'
import * as fixtures from '../fixtures/marketing'
import {
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

export const fetchCoupons = (query) =>
  fetchResource({ path: '/admin/marketing/coupons', params: params(query), fixture: () => fixtures.couponListFixture(query), schema: couponListSchema, live: true })

export async function createCoupon(payload) {
  const { data } = await api.post('/admin/marketing/coupons', payload)
  return data.data
}

export async function updateCoupon({ id, ...payload }) {
  const { data } = await api.put(`/admin/marketing/coupons/${id}`, payload)
  return data.data
}

export async function updateCouponStatus({ id, isActive }) {
  const { data } = await api.patch(`/admin/marketing/coupons/${id}/status`, { isActive })
  return data.data
}

export async function deleteCoupon({ id }) {
  const { data } = await api.delete(`/admin/marketing/coupons/${id}`)
  return data.data
}

export const fetchReviews = (query) =>
  fetchResource({ path: '/admin/marketing/reviews', params: params(query), fixture: () => fixtures.reviewListFixture(query), schema: reviewListSchema, live: true })

export const fetchOffers = () =>
  fetchResource({ path: '/admin/marketing/offers', fixture: fixtures.offerListFixture, schema: offerListSchema })

// --- CMS Pages (real backend — dynamic) -----------------------------------

export async function fetchCmsPages(query = {}) {
  const { data } = await api.get('/admin/marketing/cms', { params: query })
  return data.data
}

export async function createCmsPage(payload) {
  const { data } = await api.post('/admin/marketing/cms', payload)
  return data.data
}

export async function updateCmsPage({ id, ...payload }) {
  const { data } = await api.put(`/admin/marketing/cms/${id}`, payload)
  return data.data
}

export async function updateCmsPageStatus({ id, status }) {
  const { data } = await api.patch(`/admin/marketing/cms/${id}/status`, { status })
  return data.data
}

export async function deleteCmsPage({ id }) {
  const { data } = await api.delete(`/admin/marketing/cms/${id}`)
  return data.data
}


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

// --- banners (real backend — no mocks) -------------------------------------

function toFormData(payload) {
  if (payload instanceof FormData) return payload
  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    formData.append(key, value)
  })
  return formData
}

export async function fetchBanners() {
  const { data } = await api.get('/admin/marketing/banners')
  return data.data
}

export async function createBanner(payload) {
  const body = payload instanceof FormData ? payload : toFormData(payload)
  const { data } = await api.post('/admin/marketing/banners', body)
  return data.data
}

export async function updateBanner({ id, ...payload }) {
  const body = payload instanceof FormData ? payload : toFormData(payload)
  const { data } = await api.put(`/admin/marketing/banners/${id}`, body)
  return data.data
}

export async function updateBannerStatus({ id, status }) {
  const { data } = await api.patch(`/admin/marketing/banners/${id}/status`, { status })
  return data.data
}

export async function deleteBanner({ id }) {
  const { data } = await api.delete(`/admin/marketing/banners/${id}`)
  return data.data
}

// --- FAQs (real backend — dynamic) -----------------------------------------

export async function fetchFaqs(query = {}) {
  const { data } = await api.get('/admin/marketing/faqs', { params: query })
  return data.data
}

export async function createFaq(payload) {
  const { data } = await api.post('/admin/marketing/faqs', payload)
  return data.data
}

export async function updateFaq({ id, ...payload }) {
  const { data } = await api.put(`/admin/marketing/faqs/${id}`, payload)
  return data.data
}

export async function updateFaqStatus({ id, status }) {
  const { data } = await api.patch(`/admin/marketing/faqs/${id}/status`, { status })
  return data.data
}

export async function deleteFaq({ id }) {
  const { data } = await api.delete(`/admin/marketing/faqs/${id}`)
  return data.data
}

// --- Campaigns (real backend — push only, see marketing/CampaignFormModal) -

export async function fetchCampaigns(query = {}) {
  const { data } = await api.get('/admin/marketing/campaigns', { params: params(query) })
  return campaignListSchema.parse(data.data)
}

export async function sendCampaign(payload) {
  const { data } = await api.post('/admin/marketing/campaigns', payload)
  return data.data
}
