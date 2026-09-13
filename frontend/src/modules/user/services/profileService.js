// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import { profileSchema } from '../schemas/profileSchema'

export async function fetchProfile() {
  const response = await api.get('/auth/me')
  return profileSchema.parse(response.data.data.user)
}

export async function updateProfile(payload) {
  const response = await api.put('/auth/profile', payload)
  return profileSchema.parse(response.data.data.user)
}

export async function uploadProfileImage(file) {
  const formData = new FormData()
  formData.append('image', file)
  const response = await api.post('/auth/profile/image', formData)
  return profileSchema.parse(response.data.data.user)
}
