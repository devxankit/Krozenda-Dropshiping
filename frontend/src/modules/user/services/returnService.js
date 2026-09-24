// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import { returnableListSchema, returnRequestSchema } from '../schemas/returnSchema'

export async function fetchReturnableItems() {
  const response = await api.get('/user/returns/returnable')
  return returnableListSchema.parse(response.data.data.items)
}

export async function submitReturnRequest({ orderId, productId, variantId = null, requestType, reason, photoFiles = [] }) {
  const formData = new FormData()
  formData.append('orderId', orderId)
  formData.append('productId', productId)
  if (variantId) formData.append('variantId', variantId)
  formData.append('requestType', requestType)
  formData.append('reason', reason)
  photoFiles.forEach((file) => formData.append('photos', file))

  const response = await api.post('/user/returns', formData)
  return returnRequestSchema.parse(response.data.data)
}
