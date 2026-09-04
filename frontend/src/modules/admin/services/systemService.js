// Layer rule: services/ is the ONLY place that imports the axios instance.

import { fetchResource } from './mockTransport'
import * as fixtures from '../fixtures/system'
import {
  adminProfileSchema,
  auditLogSchema,
  backupSchema,
  businessRulesSchema,
  generalSettingsSchema,
  integrationListSchema,
  policySettingsSchema,
  securitySettingsSchema,
  supportTicketListSchema,
  taxSettingsSchema,
  webhookListSchema,
} from '../schemas/systemSchema'

const params = (query) => ({
  tab: query.tab,
  page: query.page,
  rowsPerPage: query.rowsPerPage,
  ...query.filters,
})

const list = (path, fixture, schema) => (query) =>
  fetchResource({ path, params: params(query), fixture: () => fixture(query), schema })

export const fetchAuditLog = list('/admin/system/audit-logs', fixtures.auditLogFixture, auditLogSchema)
export const fetchSupportTickets = list(
  '/admin/support/tickets',
  fixtures.supportTicketFixture,
  supportTicketListSchema,
)

const one = (path, fixture, schema) => () => fetchResource({ path, fixture, schema })

export const fetchBusinessRules = one(
  '/admin/settings/business-rules',
  fixtures.businessRulesFixture,
  businessRulesSchema,
)
export const fetchGeneralSettings = one(
  '/admin/settings/general',
  fixtures.generalSettingsFixture,
  generalSettingsSchema,
)
export const fetchIntegrations = one(
  '/admin/settings/integrations',
  fixtures.integrationListFixture,
  integrationListSchema,
)
export const fetchSecuritySettings = one(
  '/admin/settings/security',
  fixtures.securitySettingsFixture,
  securitySettingsSchema,
)
export const fetchWebhooks = one(
  '/admin/settings/api-webhooks',
  fixtures.webhookListFixture,
  webhookListSchema,
)
export const fetchPolicySettings = one(
  '/admin/settings/policies',
  fixtures.policySettingsFixture,
  policySettingsSchema,
)
export const fetchTaxSettings = one(
  '/admin/settings/taxes',
  fixtures.taxSettingsFixture,
  taxSettingsSchema,
)
export const fetchBackups = one('/admin/system/backups', fixtures.backupFixture, backupSchema)
export const fetchAdminProfile = one('/admin/profile', fixtures.adminProfileFixture, adminProfileSchema)
