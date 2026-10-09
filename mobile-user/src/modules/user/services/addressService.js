// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import { addressSchema, addressListSchema } from '../schemas/addressSchema'

export async function fetchAddresses() {
  const response = await api.get('/user/addresses')
  return addressListSchema.parse(response.data.data.items)
}

export async function createAddress(payload) {
  const response = await api.post('/user/addresses', payload)
  return addressSchema.parse(response.data.data)
}

export async function updateAddress({ id, ...payload }) {
  const response = await api.put(`/user/addresses/${id}`, payload)
  return addressSchema.parse(response.data.data)
}

export async function setDefaultAddress(id) {
  const response = await api.patch(`/user/addresses/${id}/default`)
  return addressSchema.parse(response.data.data)
}

export async function removeAddress(id) {
  const response = await api.delete(`/user/addresses/${id}`)
  return response.data.data
}
