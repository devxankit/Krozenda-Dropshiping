// Layer rule: services/ is the ONLY place that imports the axios instance.

import { fetchResource, mutateResource } from './mockTransport'
import * as fixtures from '../fixtures/finance'
import { commissionRuleListSchema } from '../schemas/financeSchema'

export const fetchCommissionRules = () =>
  fetchResource({
    path: '/admin/finance/commission-rules',
    fixture: fixtures.commissionRuleListFixture,
    schema: commissionRuleListSchema,
    live: true,
  })

export const updateCommissionRule = ({ id, value }) =>
  mutateResource({
    method: 'patch',
    path: `/admin/finance/commission-rules/${id}`,
    body: { value },
    fixture: () => fixtures.commissionRuleListFixture().items.find((r) => r.id === id),
    schema: commissionRuleListSchema.shape.items.element,
    live: true,
  })

// --- money movement -------------------------------------------------------
