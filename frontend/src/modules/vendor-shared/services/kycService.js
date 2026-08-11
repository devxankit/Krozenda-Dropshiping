// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import { sellerProfileSchema } from '../schemas/kycSchema'

// The server wraps every response as { success, message, data } (see
// backend/src/lib/ApiResponse.js) — unwrap .data.data, not .data.
export async function fetchMySellerProfile() {
  const response = await api.get('/seller/me')
  return sellerProfileSchema.parse(response.data.data)
}

export async function registerSeller({ storeName, businessModel }) {
  const response = await api.post('/seller/register', { storeName, businessModel })
  return sellerProfileSchema.parse(response.data.data)
}

export async function uploadKycDocuments({ documentType, files }) {
  const formData = new FormData()
  formData.append('documentType', documentType)
  files.forEach((file) => formData.append('documents', file))

  const response = await api.post('/seller/kyc-documents', formData)
  return sellerProfileSchema.parse(response.data.data)
}
