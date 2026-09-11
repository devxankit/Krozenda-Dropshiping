// Layer rule: services/ is the ONLY place that imports the axios instance.
//
// Real backend (Controllers/roleController.js), same as staffService.js —
// no mock fixture path here.

import { api } from '../../../lib/axios'

export async function fetchRoleList() {
  const { data } = await api.get('/admin/roles')
  return data.data
}

export async function createRole(payload) {
  const { data } = await api.post('/admin/roles', payload)
  return data.data
}

export async function updateRole({ id, ...payload }) {
  const { data } = await api.put(`/admin/roles/${id}`, payload)
  return data.data
}

export async function deleteRole(id) {
  const { data } = await api.delete(`/admin/roles/${id}`)
  return data
}
