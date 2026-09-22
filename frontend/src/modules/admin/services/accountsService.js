// Accounts MVP — a small, standalone service for the new /admin/accounts
// endpoints. Deliberately separate from services/accountingService.js and
// services/financeService.js (the existing, more complex modules).
//
// Layer rule: services/ is the ONLY place that imports the axios instance.
// Unlike the older services in this folder, this one calls the API directly
// with no mock/fixture/zod layer — the endpoints here are real from day one.

import { api } from '../../../lib/axios'

export const getDashboardSummary = async (params = {}) => {
  const { data } = await api.get('/admin/accounts/dashboard', { params })
  return data.data
}

export const listVendorPayouts = async (params = {}) => {
  const { data } = await api.get('/admin/accounts/payouts', { params })
  return data.data
}

export const createVendorPayout = async (payload) => {
  const { data } = await api.post('/admin/accounts/payouts', payload)
  return data.data
}

export const getVendorPayoutSummary = async (params = {}) => {
  const { data } = await api.get('/admin/accounts/payouts/summary', { params })
  return data.data
}

export const listTransactions = async (params = {}) => {
  const { data } = await api.get('/admin/accounts/transactions', { params })
  return data.data
}

export const createTransaction = async (payload) => {
  const { data } = await api.post('/admin/accounts/transactions', payload)
  return data.data
}

export const getLedger = async (params = {}) => {
  const { data } = await api.get('/admin/accounts/ledger', { params })
  return data.data
}
