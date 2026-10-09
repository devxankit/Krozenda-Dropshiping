import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { api } from '../../../lib/axios'
import { appendFile } from '../../vendor-shared/lib/filePicker'

// CSV product import API. The admin panel and the seller panel run the same
// flow against different base paths:
//   admin  -> /admin/catalog/import
//   seller -> /vendor/products/import
// so every call takes the base path instead of hard-coding one.

export const IMPORT_BASE = Object.freeze({
  ADMIN: '/admin/catalog/import',
  VENDOR: '/vendor/products/import',
})

export async function fetchImports(base, { page = 1, limit = 10 } = {}) {
  const { data } = await api.get(base, { params: { page, limit } })
  return { items: data.data, pagination: data.pagination }
}

export async function fetchImport(base, id) {
  const { data } = await api.get(`${base}/${id}`)
  return data.data
}

export async function fetchImportRows(base, id, { page = 1, limit = 25, filter } = {}) {
  const { data } = await api.get(`${base}/${id}/rows`, { params: { page, limit, filter: filter || undefined } })
  return { items: data.data, pagination: data.pagination }
}

// `file` is a picked { uri, name, type } (what React Native's FormData uploads).
export async function uploadImport(base, { file, duplicateMode }) {
  const body = new FormData()
  appendFile(body, 'file', file)
  body.append('duplicateMode', duplicateMode)
  const { data } = await api.post(base, body, { headers: { 'Content-Type': 'multipart/form-data' } })
  return data
}

export async function setImportRowsExcluded(base, id, { rowIds, all = false, excluded }) {
  const { data } = await api.patch(`${base}/${id}/rows`, { rowIds, all, excluded })
  return data
}

export async function approveImport(base, id) {
  const { data } = await api.post(`${base}/${id}/approve`)
  return data
}

export async function rejectImport(base, id, reason) {
  const { data } = await api.post(`${base}/${id}/reject`, { reason })
  return data
}

// Native: the template is written to the cache directory and opened in the share sheet (the web
// downloads it through a temporary <a download>).
export async function downloadImportTemplate(base) {
  const response = await api.get(`${base}/template`, { responseType: 'text', transformResponse: [(raw) => raw] })
  const file = new File(Paths.cache, 'krozenda-product-import-template.csv')
  file.create({ overwrite: true })
  file.write(typeof response.data === 'string' ? response.data : String(response.data ?? ''))
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
      dialogTitle: 'krozenda-product-import-template.csv',
    })
  }
}

// Admin preview mode: make imported preview products live.
export async function approvePreviewProducts(base, { productIds, all = false }) {
  const { data } = await api.post(`${base}/approve-products`, { productIds, all })
  return data
}
