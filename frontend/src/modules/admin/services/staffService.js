// Layer rule: services/ is the ONLY place that imports the axios instance.
//
// Unlike most admin screens, this feature is entirely real — Controllers/
// staffController.js already exists on the backend — so there is no mock
// fixture path here at all.

import { api } from '../../../lib/axios'

function toFormData(payload) {
  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    formData.append(key, value)
  })
  return formData
}

export async function fetchStaffList() {
  const { data } = await api.get('/admin/staff')
  return data.data
}

export async function createStaff(payload) {
  const { data } = await api.post('/admin/staff', toFormData(payload))
  return data.data
}

export async function updateStaff({ id, ...payload }) {
  const { data } = await api.put(`/admin/staff/${id}`, toFormData(payload))
  return data.data
}

export async function updateStaffStatus({ id, isActive }) {
  const { data } = await api.patch(`/admin/staff/${id}/status`, { isActive })
  return data.data
}

export async function updateStaffRole({ id, roleId }) {
  const { data } = await api.patch(`/admin/staff/${id}/role`, { roleId })
  return data.data
}

export async function updateStaffPassword({ id, password }) {
  const { data } = await api.patch(`/admin/staff/${id}/password`, { password })
  return data
}

export async function deleteStaff(id) {
  const { data } = await api.delete(`/admin/staff/${id}`)
  return data
}
