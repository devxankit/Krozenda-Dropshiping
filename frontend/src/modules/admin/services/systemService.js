// Layer rule: services/ is the ONLY place that imports the axios instance.

import { api } from '../../../lib/axios'
import { fetchResource, mutateResource } from './mockTransport'
import * as fixtures from '../fixtures/system'
import { adminProfileSchema, auditLogSchema, backupSchema, businessRulesSchema, generalSettingsSchema, integrationListSchema, supportTicketDetailSchema, supportTicketListSchema, taxSettingsSchema } from '../schemas/systemSchema'

const params = (query) => ({
  tab: query.tab,
  page: query.page,
  rowsPerPage: query.rowsPerPage,
  ...query.filters,
})

const list = (path, fixture, schema, live = false) => (query) =>
  fetchResource({ path, params: params(query), fixture: () => fixture(query), schema, live })

// Real backend — every admin/staff write is recorded by Middlewares/adminAudit.js.
export const fetchAuditLog = list('/admin/system/audit-logs', fixtures.auditLogFixture, auditLogSchema, true)

// --- Support tickets (real backend — dynamic, see ticketController.js) ----

export const fetchSupportTickets = list(
  '/admin/support/tickets',
  fixtures.supportTicketFixture,
  supportTicketListSchema,
  true,
)

export async function fetchSupportTicketDetail(id) {
  const { data } = await api.get(`/admin/support/tickets/${encodeURIComponent(id)}`)
  return supportTicketDetailSchema.parse(data.data)
}

export async function sendSupportTicketMessage({ id, message, isInternal }) {
  const { data } = await api.post(`/admin/support/tickets/${encodeURIComponent(id)}/messages`, {
    message,
    isInternal,
  })
  return supportTicketDetailSchema.parse(data.data)
}

export async function updateSupportTicketStatus({ id, status, note }) {
  const { data } = await api.patch(`/admin/support/tickets/${encodeURIComponent(id)}/status`, { status, note })
  return supportTicketDetailSchema.parse(data.data)
}

export async function assignSupportTicket({ id, owner }) {
  const { data } = await api.patch(`/admin/support/tickets/${encodeURIComponent(id)}/assign`, { owner })
  return supportTicketDetailSchema.parse(data.data)
}

const one = (path, fixture, schema, live = false) => () => fetchResource({ path, fixture, schema, live })

// Business rules are the accounting policy the ledger and payout jobs run on.
export async function fetchBusinessRules() {
  const { data } = await api.get('/admin/accounting/config')
  return businessRulesSchema.parse(data.data)
}

export async function saveBusinessRules(changes) {
  const { data } = await api.patch('/admin/accounting/config', changes)
  return businessRulesSchema.parse(data.data)
}
export const fetchGeneralSettings = one(
  '/admin/settings/general',
  fixtures.generalSettingsFixture,
  generalSettingsSchema,
  true,
)

export async function updateGeneralSettings(payload) {
  return mutateResource({
    method: 'put',
    path: '/admin/settings/general',
    body: payload,
    fixture: () => ({ platform: payload, toggles: [] }),
    live: true,
  })
}

export async function updateAdminProfile(payload) {
  const isFormData = typeof FormData !== 'undefined' && payload instanceof FormData
  const { data } = await api.put('/admin/auth/profile', payload, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
  })
  return data.data
}

export async function changeAdminPassword(payload) {
  const { data } = await api.put('/admin/auth/change-password', payload)
  return data
}
export const fetchIntegrations = one(
  '/admin/settings/integrations',
  fixtures.integrationListFixture,
  integrationListSchema,
  true,
)
export const fetchTaxSettings = one(
  '/admin/settings/taxes',
  fixtures.taxSettingsFixture,
  taxSettingsSchema,
  true,
)
export const fetchBackups = one('/admin/system/backups', fixtures.backupFixture, backupSchema, true)

export const runBackupNow = () =>
  mutateResource({
    method: 'post',
    path: '/admin/system/backups/run',
    fixture: () => fixtures.backupFixture().runs[0],
    live: true,
  })

// Backup files are served through an authenticated endpoint (not a static
// path), so downloading needs the Authorization header the shared axios
// instance attaches — a plain <a href> link can't do that.
export async function downloadBackup(runId) {
  const response = await api.get(`/admin/system/backups/${encodeURIComponent(runId)}/download`, {
    responseType: 'blob',
  })
  const url = window.URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = runId
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

// The signed-in admin's own account. Sensitive fields never leave the server
// (the password is excluded by the model).
export async function fetchAdminProfile() {
  const { data } = await api.get('/admin/auth/me')
  const admin = data.data.admin || {}
  return adminProfileSchema.parse({
    name: admin.name || '',
    email: admin.email || '',
    mobileNumber: admin.mobileNumber || '',
    image: admin.image || null,
    role: admin.role || 'staff',
    roleName: admin.role === 'admin' ? 'Super admin' : admin.roleId?.name || 'Staff',
    joinedAt: admin.createdAt || null,
    permissionCount: (data.data.permissions || []).length,
  })
}
